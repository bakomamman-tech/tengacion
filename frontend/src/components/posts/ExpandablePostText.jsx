import { useEffect, useId, useRef, useState } from "react";

const joinClasses = (...values) => values.filter(Boolean).join(" ");

const scheduleFrame = (callback) => {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    const frameId = window.requestAnimationFrame(callback);
    return () => window.cancelAnimationFrame?.(frameId);
  }

  const timeoutId = setTimeout(callback, 0);
  return () => clearTimeout(timeoutId);
};

const isOverflowing = (node) => {
  if (!node) {
    return false;
  }

  const heightOverflow = node.scrollHeight - node.clientHeight > 1;
  const widthOverflow = node.scrollWidth - node.clientWidth > 1;
  return heightOverflow || widthOverflow;
};

export default function ExpandablePostText({
  text,
  component = "p",
  wrapperClassName = "",
  className = "",
  toggleClassName = "",
  collapsedLines = 5,
  moreLabel = "More",
  lessLabel = "Less",
  toggleAlign = "start",
  justify = true,
}) {
  const normalizedText = String(text ?? "").replace(/\r\n/g, "\n");
  const TextTag = component;
  const contentId = useId();
  const wrapperRef = useRef(null);
  const measureRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [normalizedText, collapsedLines]);

  useEffect(() => {
    if (!normalizedText.trim()) {
      setCanExpand(false);
      return undefined;
    }

    let cancelScheduled = () => {};
    let resizeObserver = null;

    const updateOverflow = () => {
      setCanExpand(isOverflowing(measureRef.current));
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

      if (measureRef.current) {
        resizeObserver.observe(measureRef.current);
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
  }, [collapsedLines, normalizedText]);

  if (!normalizedText.trim()) {
    return null;
  }

  const lineClampStyle = {
    "--expandable-post-lines": collapsedLines,
  };

  const contentClassName = joinClasses(
    "expandable-post-text__content",
    justify && "expandable-post-text__content--justified",
    !expanded && canExpand && "expandable-post-text__content--collapsed",
    className
  );

  const measureClassName = joinClasses(
    "expandable-post-text__measure",
    "expandable-post-text__content",
    "expandable-post-text__content--collapsed",
    justify && "expandable-post-text__content--justified",
    className
  );

  return (
      <div ref={wrapperRef} className={joinClasses("expandable-post-text", wrapperClassName)}>
      <TextTag id={contentId} className={contentClassName} style={lineClampStyle}>
        {normalizedText}
      </TextTag>

      <TextTag aria-hidden="true" className={measureClassName} ref={measureRef} style={lineClampStyle}>
        {normalizedText}
      </TextTag>

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
