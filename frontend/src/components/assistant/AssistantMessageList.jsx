import { useCallback, useEffect, useRef, useState } from "react";

function AssistantSpark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.4 13.6 8.4 18.6 10 13.6 11.6 12 16.6 10.4 11.6 5.4 10 10.4 8.4z" />
    </svg>
  );
}

function AssistantCopyIcon({ copied = false }) {
  if (copied) {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="m4.25 10.25 3.35 3.35 8.15-8.15" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="7" y="5" width="9" height="11" rx="2" />
      <path d="M4 13V6a2 2 0 0 1 2-2h7" />
    </svg>
  );
}

function AssistantThumbIcon({ down = false }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M6.25 8.5v7" />
      <path d="M3.75 8.5h2.5v7h-2.5z" />
      <path
        d={
          down
            ? "M6.25 14.75h6.5a1.5 1.5 0 0 0 1.42-1.03l1.12-3.36a1.5 1.5 0 0 0-1.42-1.97H10.5l.44-2.29a1.35 1.35 0 0 0-.72-1.45l-.27-.14-3.7 4.24"
            : "M6.25 5.25h6.5a1.5 1.5 0 0 1 1.42 1.03l1.12 3.36a1.5 1.5 0 0 1-1.42 1.97H10.5l.44 2.29a1.35 1.35 0 0 1-.72 1.45l-.27.14-3.7-4.24"
        }
      />
    </svg>
  );
}

function AssistantFlagIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 16V4.75" />
      <path d="M5 5h7.25l-.85 2.25.85 2.25H5" />
    </svg>
  );
}

function TypingIndicator({ label = "Akuso is thinking" }) {
  return (
    <div className="tg-assistant-message tg-assistant-message--assistant">
      <div className="tg-assistant-message__meta">
        <span className="tg-assistant-message__avatar" aria-hidden="true">
          <AssistantSpark />
        </span>
        <span>Akuso</span>
      </div>
      <div className="tg-assistant-message__bubble tg-assistant-message__bubble--assistant tg-assistant-message__bubble--loading" aria-live="polite">
        <span className="tg-assistant-typing" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="tg-assistant-typing__text">{label}</span>
      </div>
    </div>
  );
}

function AssistantMessageAttachments({ attachments = [] }) {
  const media = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
  if (media.length === 0) {
    return null;
  }

  return (
    <div className="tg-assistant-message__attachments">
      {media.map((attachment) => {
        const isImage = attachment?.type === "image";
        return (
          <div
            key={attachment.id || attachment.previewUrl || attachment.name}
            className={`tg-assistant-message__attachment${isImage ? " is-image" : " is-audio"}`}
          >
            {isImage && attachment.previewUrl ? (
              <img src={attachment.previewUrl} alt={attachment.name || "Attached image"} />
            ) : (
              <>
                <span className="tg-assistant-message__attachment-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 4.75a3.25 3.25 0 0 0-3.25 3.25v3.2a3.25 3.25 0 0 0 6.5 0V8A3.25 3.25 0 0 0 12 4.75z" />
                    <path d="M6.5 11.25a5.5 5.5 0 0 0 11 0" />
                    <path d="M12 16.75v2.5" />
                  </svg>
                </span>
                <span>{attachment.name || "Voice message"}</span>
                {attachment.previewUrl ? (
                  <audio controls src={attachment.previewUrl}>
                    Your browser cannot play this voice message.
                  </audio>
                ) : null}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

const SAFETY_LABELS = {
  safe: "Safe",
  caution: "Use caution",
  refusal: "Refused",
  emergency: "Urgent",
};

const CODE_FENCE_PATTERN = /^```([a-zA-Z0-9_-]+)?\s*$/;
const HEADING_PATTERN = /^(#{1,4})\s+(.+)$/;
const NUMBERED_LIST_PATTERN = /^\s*\d+[.)]\s+(.+)$/;
const BULLET_LIST_PATTERN = /^\s*[-*]\s+(.+)$/;
const SUPERSCRIPT_DIGITS = {
  0: "⁰",
  1: "¹",
  2: "²",
  3: "³",
  4: "⁴",
  5: "⁵",
  6: "⁶",
  7: "⁷",
  8: "⁸",
  9: "⁹",
};

const formatClassroomMath = (value = "") =>
  String(value || "")
    .replace(/(-?\d+)\s*\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1 $2⁄$3")
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1⁄$2")
    .replace(/\bsqrt\s*\(/gi, "√(")
    .replace(/\btheta\b/gi, "θ")
    .replace(/<=/g, "≤")
    .replace(/>=/g, "≥")
    .replace(/\s+\*\s+/g, " × ")
    .replace(/\s+-\s+/g, " − ")
    .replace(/\^(\d+)/g, (_, digits) =>
      String(digits)
        .split("")
        .map((digit) => SUPERSCRIPT_DIGITS[digit] || digit)
        .join("")
    );

const renderClassroomMath = (value = "") => {
  const text = String(value || "");
  const mixedNumberPattern = /(-?\d+)\s+(\d+)[/\u2044](\d+)/g;
  const parts = [];
  let lastIndex = 0;

  for (const match of text.matchAll(mixedNumberPattern)) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const [matchedText, whole, numerator, denominator] = match;
    parts.push(
      <span
        key={`${matchedText}-${match.index}`}
        className="tg-assistant-message__mixed-number"
        aria-label={`Mixed number ${whole} and ${numerator} over ${denominator}`}
      >
        <span className="tg-assistant-message__mixed-whole" aria-hidden="true">
          {whole}
        </span>
        <span className="tg-assistant-message__mixed-fraction" aria-hidden="true">
          <span className="tg-assistant-message__mixed-numerator">{numerator}</span>
          <span className="tg-assistant-message__mixed-denominator">{denominator}</span>
        </span>
      </span>
    );
    lastIndex = match.index + matchedText.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

const parseClassroomMathLines = (value = "") =>
  String(value || "")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      const boxed = trimmed.match(/^\\boxed\{(.+)\}$/);
      return {
        isFinalAnswer: Boolean(boxed),
        text: formatClassroomMath(boxed?.[1] || trimmed),
      };
    })
    .filter((line) => line.text);

const renderInlineFormatting = (value = "") =>
  String(value || "")
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
      ) : (
        part
      )
    );

const flushParagraph = (blocks, paragraph) => {
  if (paragraph.length === 0) {
    return;
  }

  blocks.push({
    type: "paragraph",
    text: paragraph.join("\n"),
  });
  paragraph.splice(0, paragraph.length);
};

const flushList = (blocks, list) => {
  if (!list || list.items.length === 0) {
    return null;
  }

  blocks.push(list);
  return null;
};

const parseAssistantContent = (content = "") => {
  const normalized = String(content || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const blocks = [];
  const paragraph = [];
  let list = null;
  let code = null;

  normalized.split("\n").forEach((line) => {
    const fenceMatch = line.match(CODE_FENCE_PATTERN);
    if (fenceMatch) {
      if (code) {
        blocks.push({
          type: "code",
          language: code.language,
          text: code.lines.join("\n"),
        });
        code = null;
      } else {
        flushParagraph(blocks, paragraph);
        list = flushList(blocks, list);
        code = {
          language: fenceMatch[1] || "",
          lines: [],
        };
      }
      return;
    }

    if (code) {
      code.lines.push(line);
      return;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph(blocks, paragraph);
      list = flushList(blocks, list);
      return;
    }

    const headingMatch = trimmed.match(HEADING_PATTERN);
    if (headingMatch) {
      flushParagraph(blocks, paragraph);
      list = flushList(blocks, list);
      blocks.push({
        type: "heading",
        level: Math.min(4, headingMatch[1].length + 2),
        text: headingMatch[2].trim(),
      });
      return;
    }

    const numberedMatch = line.match(NUMBERED_LIST_PATTERN);
    if (numberedMatch) {
      flushParagraph(blocks, paragraph);
      if (!list || list.type !== "ordered") {
        list = flushList(blocks, list) || { type: "ordered", items: [] };
      }
      list.items.push(numberedMatch[1].trim());
      return;
    }

    const bulletMatch = line.match(BULLET_LIST_PATTERN);
    if (bulletMatch) {
      flushParagraph(blocks, paragraph);
      if (!list || list.type !== "unordered") {
        list = flushList(blocks, list) || { type: "unordered", items: [] };
      }
      list.items.push(bulletMatch[1].trim());
      return;
    }

    list = flushList(blocks, list);
    paragraph.push(trimmed);
  });

  if (code) {
    blocks.push({
      type: "code",
      language: code.language,
      text: code.lines.join("\n"),
    });
  }
  flushParagraph(blocks, paragraph);
  flushList(blocks, list);

  return blocks;
};

function AssistantFormattedContent({ content = "" }) {
  const blocks = parseAssistantContent(content);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="tg-assistant-message__formatted">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Heading = `h${block.level}`;
          return (
            <Heading key={`heading-${index}`}>{renderInlineFormatting(block.text)}</Heading>
          );
        }

        if (block.type === "ordered") {
          return (
            <ol key={`ordered-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{renderInlineFormatting(item)}</li>
              ))}
            </ol>
          );
        }

        if (block.type === "unordered") {
          return (
            <ul key={`unordered-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{renderInlineFormatting(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "code") {
          if (String(block.language || "").toLowerCase() === "math") {
            const mathLines = parseClassroomMathLines(block.text);
            return (
              <div key={`math-${index}`} className="tg-assistant-message__formula">
                {mathLines.map((line, lineIndex) => (
                  <span
                    key={`${line.text}-${lineIndex}`}
                    className={`tg-assistant-message__formula-line${line.isFinalAnswer ? " is-final-answer" : ""}`}
                    aria-label={line.isFinalAnswer ? "Final answer" : undefined}
                  >
                    {renderClassroomMath(line.text)}
                  </span>
                ))}
              </div>
            );
          }

          return (
            <pre key={`code-${index}`}>
              <code>{block.text}</code>
            </pre>
          );
        }

        return <p key={`paragraph-${index}`}>{renderInlineFormatting(block.text)}</p>;
      })}
    </div>
  );
}

const copyTextToClipboard = async (text = "") => {
  const value = String(text || "").trim();
  if (!value) {
    return false;
  }

  const clipboard =
    typeof window !== "undefined"
      ? window.navigator?.clipboard
      : typeof navigator !== "undefined"
        ? navigator.clipboard
        : null;

  if (clipboard?.writeText) {
    await clipboard.writeText(value);
    return true;
  }

  if (typeof document === "undefined" || !document.body || !document.execCommand) {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
};

export default function AssistantMessageList({
  messages = [],
  loading = false,
  streamingLabel = "",
  onFeedback,
  feedbackStatusByMessageId = {},
}) {
  const endRef = useRef(null);
  const copyTimeoutRef = useRef(null);
  const [copiedMessageId, setCopiedMessageId] = useState("");

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  useEffect(
    () => () => {
      window.clearTimeout(copyTimeoutRef.current);
    },
    []
  );

  const handleCopy = useCallback(async (message) => {
    let copied = false;
    try {
      copied = await copyTextToClipboard(message?.content || "");
    } catch {
      copied = false;
    }

    if (!copied) {
      return;
    }

    const nextCopiedId = message?.id || `${message?.role || "assistant"}-${message?.content || ""}`;
    setCopiedMessageId(nextCopiedId);
    window.clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopiedMessageId("");
    }, 1800);
  }, []);

  return (
    <div className="tg-assistant-thread" role="log" aria-live="polite" aria-relevant="additions text">
      {messages.map((message) => {
        const isUser = message?.role === "user";
        const safety = message?.safety || { level: "safe", notice: "", escalation: "" };
        const messageId = message?.id || `${message?.role || "assistant"}-${message?.content || ""}`;
        const copied = copiedMessageId === messageId;
        const feedbackKey = message?.responseId || messageId;
        const feedbackStatus =
          feedbackStatusByMessageId[feedbackKey] || feedbackStatusByMessageId[messageId] || "";
        const feedbackBusy = feedbackStatus === "sending";
        const feedbackDisabled = feedbackBusy || typeof onFeedback !== "function";
        const isHelpful = feedbackStatus === "helpful";
        const isNotHelpful = feedbackStatus === "not_helpful";
        const isReported = feedbackStatus === "report";
        return (
          <article
            key={messageId}
            className={`tg-assistant-message${isUser ? " tg-assistant-message--user" : " tg-assistant-message--assistant"}`}
          >
            <div className="tg-assistant-message__meta">
              {isUser ? (
                <span>You</span>
              ) : (
                <>
                  <span className="tg-assistant-message__avatar" aria-hidden="true">
                    <AssistantSpark />
                  </span>
                  <span>Akuso</span>
                  {message?.mode ? (
                    <span className="tg-assistant-message__meta-tag">{message.mode}</span>
                  ) : null}
                </>
              )}
            </div>

            {isUser ? (
              <div className="tg-assistant-message__bubble">
                {message?.content ? <span>{message.content}</span> : null}
                <AssistantMessageAttachments attachments={message?.attachments} />
              </div>
            ) : (
              <div className="tg-assistant-message__reply">
                <div
                  className="tg-assistant-message__actions"
                  role="group"
                  aria-label="Akuso response actions"
                >
                  <button
                    type="button"
                    className={`tg-assistant-message__action${copied ? " is-copied" : ""}`}
                    onClick={() => handleCopy(message)}
                    aria-label={copied ? "Akuso response copied" : "Copy Akuso response"}
                    title={copied ? "Copied" : "Copy response"}
                  >
                    <AssistantCopyIcon copied={copied} />
                    <span className="tg-assistant-visually-hidden">
                      {copied ? "Copied" : "Copy"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`tg-assistant-message__action${isHelpful ? " is-active" : ""}`}
                    onClick={() => onFeedback?.(message, "helpful")}
                    disabled={feedbackDisabled}
                    aria-label={
                      isHelpful ? "Akuso response marked helpful" : "Mark Akuso response helpful"
                    }
                    title={isHelpful ? "Marked helpful" : "Helpful"}
                  >
                    <AssistantThumbIcon />
                  </button>
                  <button
                    type="button"
                    className={`tg-assistant-message__action${isNotHelpful ? " is-active" : ""}`}
                    onClick={() => onFeedback?.(message, "not_helpful")}
                    disabled={feedbackDisabled}
                    aria-label={
                      isNotHelpful
                        ? "Akuso response marked not helpful"
                        : "Mark Akuso response not helpful"
                    }
                    title={isNotHelpful ? "Marked not helpful" : "Not helpful"}
                  >
                    <AssistantThumbIcon down />
                  </button>
                  <button
                    type="button"
                    className={`tg-assistant-message__action tg-assistant-message__action--report${isReported ? " is-reported" : ""}`}
                    onClick={() => onFeedback?.(message, "report")}
                    disabled={feedbackDisabled}
                    aria-label={isReported ? "Akuso response reported" : "Report Akuso response"}
                    title={isReported ? "Reported" : "Report offensive or unsafe content"}
                  >
                    <AssistantFlagIcon />
                  </button>
                </div>

                <div className="tg-assistant-message__bubble tg-assistant-message__bubble--assistant">
                  <AssistantFormattedContent content={message?.content} />
                </div>
              </div>
            )}

            {!isUser && safety?.level && safety.level !== "safe" ? (
              <div className={`tg-assistant-safety tg-assistant-safety--${safety.level}`}>
                <strong>{SAFETY_LABELS[safety.level] || "Notice"}</strong>
                <p>{safety.notice || "Akuso added a cautionary note for this answer."}</p>
              </div>
            ) : null}
          </article>
        );
      })}

      {loading ? <TypingIndicator label={streamingLabel || "Akuso is thinking"} /> : null}
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}
