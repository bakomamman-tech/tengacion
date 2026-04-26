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
          return <Heading key={`heading-${index}`}>{block.text}</Heading>;
        }

        if (block.type === "ordered") {
          return (
            <ol key={`ordered-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{item}</li>
              ))}
            </ol>
          );
        }

        if (block.type === "unordered") {
          return (
            <ul key={`unordered-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "code") {
          return (
            <pre key={`code-${index}`}>
              <code>{block.text}</code>
            </pre>
          );
        }

        return <p key={`paragraph-${index}`}>{block.text}</p>;
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
              <div className="tg-assistant-message__bubble">{message?.content}</div>
            ) : (
              <div className="tg-assistant-message__reply">
                <button
                  type="button"
                  className={`tg-assistant-message__copy${copied ? " is-copied" : ""}`}
                  onClick={() => handleCopy(message)}
                  aria-label={copied ? "Akuso response copied" : "Copy Akuso response"}
                  title={copied ? "Copied" : "Copy response"}
                >
                  <AssistantCopyIcon copied={copied} />
                  <span className="tg-assistant-visually-hidden">
                    {copied ? "Copied" : "Copy"}
                  </span>
                </button>

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
