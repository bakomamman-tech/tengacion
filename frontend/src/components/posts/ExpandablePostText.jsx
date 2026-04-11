import { useEffect, useId, useMemo, useRef, useState } from "react";

const joinClasses = (...values) => values.filter(Boolean).join(" ");

const WORD_TOKEN_PATTERN = /\S+|\s+/g;

const scheduleFrame = (callback) => {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    const frameId = window.requestAnimationFrame(callback);
    return () => window.cancelAnimationFrame?.(frameId);
  }

  const timeoutId = setTimeout(callback, 0);
  return () => clearTimeout(timeoutId);
};

const getNodeHeight = (node) => {
  if (!node) {
    return 0;
  }

  const rectHeight = Number(node.getBoundingClientRect?.().height || 0);
  return Math.max(rectHeight, Number(node.scrollHeight || 0), Number(node.clientHeight || 0));
};

const isOverflowing = (fullNode, collapsedNode) => {
  if (!fullNode || !collapsedNode) {
    return false;
  }

  const heightOverflow = getNodeHeight(fullNode) - getNodeHeight(collapsedNode) > 1;
  const widthOverflow = Number(fullNode.scrollWidth || 0) - Number(collapsedNode.clientWidth || 0) > 1;
  return heightOverflow || widthOverflow;
};

const countWords = (value = "") => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).filter(Boolean).length;
};

const truncateByWords = (value = "", limit = 500) => {
  const clean = String(value || "");
  const safeLimit = Math.max(1, Number(limit) || 500);
  const wordCount = countWords(clean);

  if (!clean.trim() || wordCount <= safeLimit) {
    return {
      hasOverflow: false,
      preview: clean.trim(),
      wordCount,
    };
  }

  const tokens = clean.match(WORD_TOKEN_PATTERN) || [];
  let wordsSeen = 0;
  let preview = "";

  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      if (wordsSeen > 0) {
        preview += token;
      }
      continue;
    }

    if (wordsSeen >= safeLimit) {
      break;
    }

    preview += token;
    wordsSeen += 1;
  }

  return {
    hasOverflow: true,
    preview: `${preview.trimEnd()}...`,
    wordCount,
  };
};

export default function ExpandablePostText({
  text,
  component = "p",
  wrapperClassName = "",
  className = "",
  toggleClassName = "",
  collapseMode = "lines",
  collapsedLines = 5,
  collapsedWords = 500,
  moreLabel = "More",
  lessLabel = "Less",
  toggleAlign = "start",
  justify = true,
}) {
  const normalizedText = String(text ?? "").replace(/\r\n/g, "\n");
  const trimmedText = normalizedText.trim();
  const isWordMode = collapseMode === "words";
  const TextTag = component;
  const contentId = useId();
  const wrapperRef = useRef(null);
  const fullMeasureRef = useRef(null);
  const collapsedMeasureRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [lineCanExpand, setLineCanExpand] = useState(false);

  const wordSummary = useMemo(
    () => truncateByWords(normalizedText, collapsedWords),
    [collapsedWords, normalizedText]
  );
  const canExpand = isWordMode ? wordSummary.hasOverflow : lineCanExpand;
  const renderedText =
    !expanded && isWordMode && wordSummary.hasOverflow ? wordSummary.preview : normalizedText;

  useEffect(() => {
    setExpanded(false);
  }, [collapseMode, collapsedLines, collapsedWords, normalizedText]);

  useEffect(() => {
    if (isWordMode) {
      setLineCanExpand(false);
      return undefined;
    }

    if (!trimmedText) {
      setLineCanExpand(false);
      return undefined;
    }

    let cancelScheduled = () => {};
    let resizeObserver = null;

    const updateOverflow = () => {
      setLineCanExpand(isOverflowing(fullMeasureRef.current, collapsedMeasureRef.current));
    };

    const scheduleOverflowCheck = () => {
      cancelScheduled();
      cancelScheduled = scheduleFrame(updateOverflow);
    };

    scheduleOverflowCheck();

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        scheduleOverflowCheck();
      });

      if (wrapperRef.current) {
        resizeObserver.observe(wrapperRef.current);
      }

      if (fullMeasureRef.current) {
        resizeObserver.observe(fullMeasureRef.current);
      }

      if (collapsedMeasureRef.current) {
        resizeObserver.observe(collapsedMeasureRef.current);
      }
    } else if (typeof window !== "undefined") {
      window.addEventListener("resize", scheduleOverflowCheck);
    }

    return () => {
      cancelScheduled();
      resizeObserver?.disconnect();
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", scheduleOverflowCheck);
      }
    };
  }, [collapsedLines, isWordMode, normalizedText, trimmedText]);

  if (!trimmedText) {
    return null;
  }

  const lineClampStyle = {
    "--expandable-post-lines": collapsedLines,
  };
  const contentStyle = isWordMode ? undefined : lineClampStyle;

  const contentClassName = joinClasses(
    "expandable-post-text__content",
    justify && "expandable-post-text__content--justified",
    !isWordMode && !expanded && "expandable-post-text__content--collapsed",
    className
  );

  const fullMeasureClassName = joinClasses(
    "expandable-post-text__measure",
    "expandable-post-text__content",
    justify && "expandable-post-text__content--justified",
    className
  );

  const collapsedMeasureClassName = joinClasses(
    "expandable-post-text__measure",
    "expandable-post-text__measure--collapsed",
    "expandable-post-text__content",
    "expandable-post-text__content--collapsed",
    justify && "expandable-post-text__content--justified",
    className
  );

  return (
    <div ref={wrapperRef} className={joinClasses("expandable-post-text", wrapperClassName)}>
      <TextTag id={contentId} className={contentClassName} style={contentStyle}>
        {renderedText}
      </TextTag>

      {!isWordMode ? (
        <>
          <TextTag
            aria-hidden="true"
            className={fullMeasureClassName}
            ref={fullMeasureRef}
            style={lineClampStyle}
          >
            {normalizedText}
          </TextTag>

          <TextTag
            aria-hidden="true"
            className={collapsedMeasureClassName}
            ref={collapsedMeasureRef}
            style={lineClampStyle}
          >
            {normalizedText}
          </TextTag>
        </>
      ) : null}

      {canExpand ? (
        <div
          className={joinClasses(
            "expandable-post-text__toggle-row",
            toggleAlign === "end"
              ? "expandable-post-text__toggle-row--end"
              : "expandable-post-text__toggle-row--start"
          )}
        >
          <button
            type="button"
            className={joinClasses("expandable-post-text__toggle", toggleClassName)}
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? lessLabel : moreLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
