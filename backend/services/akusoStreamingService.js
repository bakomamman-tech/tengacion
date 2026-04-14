const { sanitizeMultilineText, sanitizePlainText } = require("./assistant/outputSanitizer");

const STREAM_CHUNK_TARGET = 72;
const STREAM_CHUNK_DELAY_MS = process.env.NODE_ENV === "test" ? 0 : 18;

const wait = (ms = 0) =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

const setAkusoStreamHeaders = (res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
};

const writeAkusoStreamEvent = (res, eventName = "message", data = {}) => {
  if (!res || res.writableEnded) {
    return;
  }

  const event = sanitizePlainText(eventName, 40) || "message";
  const payload = JSON.stringify(data && typeof data === "object" ? data : {});
  res.write(`event: ${event}\n`);
  res.write(`data: ${payload}\n\n`);
};

const splitAkusoStreamText = (value = "", target = STREAM_CHUNK_TARGET) => {
  const safeText = sanitizeMultilineText(value, 1600);
  if (!safeText) {
    return [];
  }

  const chunks = [];
  const tokens = safeText.split(/(\s+)/).filter(Boolean);
  let current = "";

  for (const token of tokens) {
    const next = `${current}${token}`;
    if (current && next.length > target) {
      chunks.push(current);
      current = token.trimStart();
      continue;
    }
    current = next;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.filter(Boolean);
};

const streamAkusoChatResponse = async ({
  req,
  res,
  response = {},
  traceId = "",
  includePrelude = true,
} = {}) => {
  let closed = false;
  const onClose = () => {
    closed = true;
  };

  req?.on?.("close", onClose);

  try {
    if (!res.headersSent) {
      setAkusoStreamHeaders(res);
    }
    if (includePrelude) {
      writeAkusoStreamEvent(res, "ready", { traceId: sanitizePlainText(traceId, 80) });
      writeAkusoStreamEvent(res, "status", {
        phase: "streaming",
        label: "Streaming grounded reply",
      });
    }

    writeAkusoStreamEvent(res, "message_start", {
      responseId: sanitizePlainText(response?.traceId || "", 80),
      conversationId: sanitizePlainText(response?.conversationId || "", 80),
      mode: sanitizePlainText(response?.mode || "", 40),
      category: sanitizePlainText(response?.category || "", 60),
    });

    for (const chunk of splitAkusoStreamText(response?.answer || "")) {
      if (closed || res.writableEnded) {
        return;
      }

      writeAkusoStreamEvent(res, "message_delta", {
        delta: chunk,
      });
      await wait(STREAM_CHUNK_DELAY_MS);
    }

    if (closed || res.writableEnded) {
      return;
    }

    writeAkusoStreamEvent(res, "complete", {
      response,
    });
    res.end();
  } finally {
    req?.off?.("close", onClose);
  }
};

module.exports = {
  setAkusoStreamHeaders,
  splitAkusoStreamText,
  streamAkusoChatResponse,
  writeAkusoStreamEvent,
};
