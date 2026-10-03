"use strict";

const INLINE_MARKS = new Set(["bold", "italic", "underline"]);
const ALIGNMENTS = new Set(["left", "center", "right"]);
const MAX_RICH_TEXT_NODES = 800;
const MAX_RICH_TEXT_DEPTH = 8;
const MAX_LINK_LENGTH = 500;

const parseRichText = (value) => {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string" || value.length > 100000) return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const normalizeHref = (value = "") => {
  const href = String(value || "").trim().slice(0, MAX_LINK_LENGTH);
  if (!href) return "";

  try {
    const url = new URL(href, "https://tengacion.com");
    if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) {
      return "";
    }

    if (href.startsWith("/")) {
      return `${url.pathname}${url.search}${url.hash}`;
    }

    return url.href;
  } catch {
    return "";
  }
};

const normalizeMarks = (marks) => {
  const output = [];

  for (const mark of Array.isArray(marks) ? marks : []) {
    if (typeof mark === "string" && INLINE_MARKS.has(mark)) {
      if (!output.includes(mark)) output.push(mark);
      continue;
    }

    if (mark && typeof mark === "object" && mark.type === "link") {
      const href = normalizeHref(mark.href);
      if (href && !output.some((entry) => entry?.type === "link")) {
        output.push({ type: "link", href });
      }
    }
  }

  return output;
};

const normalizeAlignAttrs = (attrs = {}) => {
  const align = ALIGNMENTS.has(String(attrs?.align || "").toLowerCase())
    ? String(attrs.align).toLowerCase()
    : "";

  return align ? { align } : {};
};

const normalizeRichTextInternal = (value, maxTextChars) => {
  const parsed = parseRichText(value);
  if (!parsed || parsed.type !== "doc" || !Array.isArray(parsed.content)) {
    return null;
  }

  let remaining = Math.max(1, Number(maxTextChars) || 5000);
  let nodeCount = 0;

  const claimNode = (depth) => {
    nodeCount += 1;
    return nodeCount <= MAX_RICH_TEXT_NODES && depth <= MAX_RICH_TEXT_DEPTH;
  };

  const normalizeInline = (node, depth) => {
    if (!claimNode(depth) || !node || node.type !== "text" || remaining <= 0) {
      return null;
    }

    const raw = String(node.text || "");
    if (!raw) return null;

    const text = raw.slice(0, remaining);
    remaining -= text.length;
    if (!text) return null;

    const marks = normalizeMarks(node.marks);
    return {
      type: "text",
      text,
      ...(marks.length ? { marks } : {}),
    };
  };

  const normalizeInlineContent = (content, depth) =>
    (Array.isArray(content) ? content : [])
      .map((node) => normalizeInline(node, depth + 1))
      .filter(Boolean);

  const normalizeBlock = (node, depth) => {
    if (!claimNode(depth) || !node || typeof node !== "object") {
      return null;
    }

    if (node.type === "paragraph" || node.type === "blockquote") {
      const content = normalizeInlineContent(node.content, depth);
      if (!content.length) return null;
      const attrs = normalizeAlignAttrs(node.attrs);
      return {
        type: node.type,
        ...(Object.keys(attrs).length ? { attrs } : {}),
        content,
      };
    }

    if (node.type === "heading") {
      const content = normalizeInlineContent(node.content, depth);
      if (!content.length) return null;
      const level = [1, 2, 3].includes(Number(node?.attrs?.level))
        ? Number(node.attrs.level)
        : 2;
      return {
        type: "heading",
        attrs: { ...normalizeAlignAttrs(node.attrs), level },
        content,
      };
    }

    if (node.type === "bulletList" || node.type === "orderedList") {
      const content = (Array.isArray(node.content) ? node.content : [])
        .map((item) => normalizeListItem(item, depth + 1))
        .filter(Boolean);
      return content.length ? { type: node.type, content } : null;
    }

    return null;
  };

  const normalizeListItem = (node, depth) => {
    if (!claimNode(depth) || !node || node.type !== "listItem") {
      return null;
    }

    const content = (Array.isArray(node.content) ? node.content : [])
      .map((child) => normalizeBlock(child, depth + 1))
      .filter(Boolean);

    return content.length ? { type: "listItem", content } : null;
  };

  const content = parsed.content
    .map((node) => normalizeBlock(node, 1))
    .filter(Boolean);

  return content.length ? { type: "doc", version: 1, content } : null;
};

const richTextToPlainText = (document) => {
  if (!document || document.type !== "doc") return "";

  const walk = (node) => {
    if (!node || typeof node !== "object") return "";
    if (node.type === "text") return String(node.text || "");

    const content = (Array.isArray(node.content) ? node.content : [])
      .map(walk)
      .join("");

    if (["paragraph", "heading", "blockquote", "listItem"].includes(node.type)) {
      return `${content}\n`;
    }

    return content;
  };

  return (Array.isArray(document.content) ? document.content : [])
    .map(walk)
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const normalizeRichText = (value, maxTextChars = 5000) => {
  const document = normalizeRichTextInternal(value, maxTextChars);
  if (!document) return null;
  return richTextToPlainText(document) ? document : null;
};

module.exports = {
  normalizeRichText,
  richTextToPlainText,
};
