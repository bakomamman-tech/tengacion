const INLINE_MARKS = new Set(["bold", "italic", "underline"]);
const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
]);

const normalizeAlign = (value = "") =>
  ["left", "center", "right"].includes(String(value || "").toLowerCase())
    ? String(value).toLowerCase()
    : "";

const normalizeHref = (value = "") => {
  const href = String(value || "").trim();
  if (!href) return "";

  const withProtocol =
    /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("/")
      ? href
      : `https://${href}`;

  try {
    const url = new URL(withProtocol, window.location.origin);
    if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) {
      return "";
    }
    return href.startsWith("/") ? url.pathname + url.search + url.hash : url.href;
  } catch {
    return "";
  }
};

const readInlineMarks = (element, inherited = []) => {
  const marks = [...inherited];
  const tag = element.tagName?.toLowerCase?.() || "";
  const style = element.style || {};

  const add = (mark) => {
    if (!marks.some((entry) => (typeof entry === "string" ? entry === mark : entry?.type === mark))) {
      marks.push(mark);
    }
  };

  if (tag === "strong" || tag === "b" || String(style.fontWeight || "") === "bold") add("bold");
  if (tag === "em" || tag === "i" || String(style.fontStyle || "") === "italic") add("italic");
  if (
    tag === "u" ||
    String(style.textDecoration || "").includes("underline") ||
    String(style.textDecorationLine || "").includes("underline")
  ) {
    add("underline");
  }

  if (tag === "a") {
    const href = normalizeHref(element.getAttribute("href") || "");
    if (href) {
      marks.push({ type: "link", href });
    }
  }

  return marks;
};

const serializeInlineNodes = (parent, inheritedMarks = []) => {
  const nodes = [];

  parent.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const value = child.nodeValue || "";
      if (value) {
        nodes.push({
          type: "text",
          text: value,
          ...(inheritedMarks.length ? { marks: inheritedMarks } : {}),
        });
      }
      return;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) return;

    const tag = child.tagName.toLowerCase();
    if (tag === "br") {
      nodes.push({
        type: "text",
        text: "\n",
        ...(inheritedMarks.length ? { marks: inheritedMarks } : {}),
      });
      return;
    }

    if (["ul", "ol", "p", "div", "h1", "h2", "h3", "blockquote"].includes(tag)) {
      const text = child.innerText || child.textContent || "";
      if (text) {
        nodes.push({
          type: "text",
          text,
          ...(inheritedMarks.length ? { marks: inheritedMarks } : {}),
        });
      }
      return;
    }

    const marks = readInlineMarks(child, inheritedMarks);
    nodes.push(...serializeInlineNodes(child, marks));
  });

  return nodes;
};

const serializeListItem = (element) => {
  const inlineContainer = element.cloneNode(true);
  inlineContainer.querySelectorAll(":scope > ul, :scope > ol").forEach((node) => node.remove());
  const inline = serializeInlineNodes(inlineContainer);

  const content = [];
  if (inline.some((entry) => String(entry?.text || "").length > 0)) {
    content.push({ type: "paragraph", content: inline });
  }

  Array.from(element.children).forEach((child) => {
    const tag = child.tagName.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      content.push(serializeList(child));
    }
  });

  return { type: "listItem", content };
};

const serializeList = (element) => ({
  type: element.tagName.toLowerCase() === "ol" ? "orderedList" : "bulletList",
  content: Array.from(element.children)
    .filter((child) => child.tagName?.toLowerCase() === "li")
    .map(serializeListItem),
});

const serializeBlock = (node) => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue || "";
    return text.trim()
      ? { type: "paragraph", content: [{ type: "text", text }] }
      : null;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const tag = node.tagName.toLowerCase();
  if (tag === "ul" || tag === "ol") {
    return serializeList(node);
  }

  if (tag === "br") {
    return { type: "paragraph", content: [{ type: "text", text: "\n" }] };
  }

  const align = normalizeAlign(node.style?.textAlign);
  const attrs = align ? { align } : undefined;
  const inline = serializeInlineNodes(node);

  if (["h1", "h2", "h3"].includes(tag)) {
    return {
      type: "heading",
      attrs: { ...(attrs || {}), level: Number(tag.slice(1)) },
      content: inline,
    };
  }

  if (tag === "blockquote") {
    return { type: "blockquote", ...(attrs ? { attrs } : {}), content: inline };
  }

  return {
    type: "paragraph",
    ...(attrs ? { attrs } : {}),
    content: inline,
  };
};

export const serializeRichTextElement = (element) => {
  if (!element) return null;

  const content = Array.from(element.childNodes)
    .map(serializeBlock)
    .filter(Boolean)
    .filter((node) => BLOCK_TYPES.has(node.type));

  const hasText = String(element.innerText || element.textContent || "").trim().length > 0;
  return hasText ? { type: "doc", version: 1, content } : null;
};

export const getRichTextPlainText = (element) =>
  String(element?.innerText || element?.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .trim();

export const encodeRichTextTransport = (document, fallbackText = "") =>
  document
    ? `__TENGACION_RICH_TEXT_V1__${JSON.stringify(document)}`
    : String(fallbackText || "");

export const isSafeRichTextHref = (value = "") => {
  const href = String(value || "").trim();
  if (!href) return false;
  try {
    const url = new URL(href, "https://tengacion.com");
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol);
  } catch {
    return false;
  }
};

export const normalizeRichTextMark = (mark) => {
  if (typeof mark === "string" && INLINE_MARKS.has(mark)) {
    return mark;
  }
  if (mark && mark.type === "link" && isSafeRichTextHref(mark.href)) {
    return { type: "link", href: String(mark.href) };
  }
  return null;
};
