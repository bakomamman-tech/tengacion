import { Fragment } from "react";

import { isSafeRichTextHref, normalizeRichTextMark } from "../../utils/richText";

const ALIGNMENTS = new Set(["left", "center", "right"]);

const renderTextNode = (node, key) => {
  let content = String(node?.text || "");
  const marks = (Array.isArray(node?.marks) ? node.marks : [])
    .map(normalizeRichTextMark)
    .filter(Boolean);

  marks.forEach((mark, index) => {
    const markKey = `${key}-mark-${index}`;

    if (mark === "bold") {
      content = <strong key={markKey}>{content}</strong>;
    } else if (mark === "italic") {
      content = <em key={markKey}>{content}</em>;
    } else if (mark === "underline") {
      content = <u key={markKey}>{content}</u>;
    } else if (mark?.type === "link" && isSafeRichTextHref(mark.href)) {
      const external = /^https?:/i.test(mark.href);
      content = (
        <a
          key={markKey}
          href={mark.href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {content}
        </a>
      );
    }
  });

  return <Fragment key={key}>{content}</Fragment>;
};

const renderNodes = (nodes = [], parentKey = "node") =>
  (Array.isArray(nodes) ? nodes : []).map((node, index) => {
    const key = `${parentKey}-${index}`;
    if (!node || typeof node !== "object") return null;

    if (node.type === "text") {
      return renderTextNode(node, key);
    }

    const align = ALIGNMENTS.has(node?.attrs?.align) ? node.attrs.align : undefined;
    const style = align ? { textAlign: align } : undefined;
    const children = renderNodes(node.content, key);

    if (node.type === "heading") {
      const level = [1, 2, 3].includes(Number(node?.attrs?.level))
        ? Number(node.attrs.level)
        : 2;
      const HeadingTag = `h${level}`;
      return <HeadingTag key={key} style={style}>{children}</HeadingTag>;
    }

    if (node.type === "blockquote") {
      return <blockquote key={key} style={style}>{children}</blockquote>;
    }

    if (node.type === "bulletList") {
      return <ul key={key}>{children}</ul>;
    }

    if (node.type === "orderedList") {
      return <ol key={key}>{children}</ol>;
    }

    if (node.type === "listItem") {
      return <li key={key}>{children}</li>;
    }

    if (node.type === "paragraph") {
      return <p key={key} style={style}>{children}</p>;
    }

    return null;
  });

export default function RichPostContent({ document, className = "" }) {
  if (!document || document.type !== "doc" || !Array.isArray(document.content)) {
    return null;
  }

  return (
    <div className={["post-rich-text", className].filter(Boolean).join(" ")}>
      {renderNodes(document.content, "rich")}
    </div>
  );
}
