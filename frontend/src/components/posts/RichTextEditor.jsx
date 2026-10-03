import { useCallback, useEffect, useRef, useState } from "react";

import {
  getRichTextPlainText,
  isSafeRichTextHref,
  serializeRichTextElement,
} from "../../utils/richText";

const TOOLBAR_ACTIONS = [
  { key: "bold", label: "B", title: "Bold", command: "bold" },
  { key: "italic", label: "I", title: "Italic", command: "italic" },
  { key: "underline", label: "U", title: "Underline", command: "underline" },
  { key: "h1", label: "H1", title: "Heading 1", command: "formatBlock", value: "h1" },
  { key: "h2", label: "H2", title: "Heading 2", command: "formatBlock", value: "h2" },
  { key: "h3", label: "H3", title: "Heading 3", command: "formatBlock", value: "h3" },
  { key: "bullet", label: "• List", title: "Bullet list", command: "insertUnorderedList" },
  { key: "numbered", label: "1. List", title: "Numbered list", command: "insertOrderedList" },
  { key: "quote", label: "❝", title: "Block quote", command: "formatBlock", value: "blockquote" },
  { key: "left", label: "L", title: "Align left", command: "justifyLeft" },
  { key: "center", label: "C", title: "Align center", command: "justifyCenter" },
  { key: "right", label: "R", title: "Align right", command: "justifyRight" },
  { key: "undo", label: "↶", title: "Undo", command: "undo" },
  { key: "redo", label: "↷", title: "Redo", command: "redo" },
];

const normalizeLinkInput = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const candidate =
    /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("/")
      ? raw
      : `https://${raw}`;

  try {
    const url = new URL(candidate, window.location.origin);
    if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) {
      return "";
    }
    return raw.startsWith("/") ? url.pathname + url.search + url.hash : url.href;
  } catch {
    return "";
  }
};

const appendMarkedText = (parent, node) => {
  let current = document.createTextNode(String(node?.text || ""));
  const marks = Array.isArray(node?.marks) ? node.marks : [];

  marks.forEach((mark) => {
    let wrapper = null;

    if (mark === "bold") {
      wrapper = document.createElement("strong");
    } else if (mark === "italic") {
      wrapper = document.createElement("em");
    } else if (mark === "underline") {
      wrapper = document.createElement("u");
    } else if (mark?.type === "link" && isSafeRichTextHref(mark.href)) {
      wrapper = document.createElement("a");
      wrapper.setAttribute("href", String(mark.href));
      wrapper.setAttribute("rel", "noopener noreferrer");
    }

    if (wrapper) {
      wrapper.appendChild(current);
      current = wrapper;
    }
  });

  parent.appendChild(current);
};

const appendInlineContent = (parent, content = []) => {
  (Array.isArray(content) ? content : []).forEach((node) => {
    if (node?.type === "text") {
      appendMarkedText(parent, node);
    }
  });
};

const appendRichTextBlock = (parent, node) => {
  if (!node || typeof node !== "object") return;

  if (node.type === "bulletList" || node.type === "orderedList") {
    const list = document.createElement(node.type === "orderedList" ? "ol" : "ul");
    (Array.isArray(node.content) ? node.content : []).forEach((item) => {
      if (item?.type !== "listItem") return;
      const li = document.createElement("li");
      (Array.isArray(item.content) ? item.content : []).forEach((child) => {
        if (child?.type === "bulletList" || child?.type === "orderedList") {
          appendRichTextBlock(li, child);
          return;
        }

        if (child?.type === "paragraph") {
          appendInlineContent(li, child.content);
        }
      });
      list.appendChild(li);
    });
    parent.appendChild(list);
    return;
  }

  let tagName = "p";
  if (node.type === "heading") {
    const level = [1, 2, 3].includes(Number(node?.attrs?.level))
      ? Number(node.attrs.level)
      : 2;
    tagName = `h${level}`;
  } else if (node.type === "blockquote") {
    tagName = "blockquote";
  }

  const block = document.createElement(tagName);
  const align = String(node?.attrs?.align || "").toLowerCase();
  if (["left", "center", "right"].includes(align)) {
    block.style.textAlign = align;
  }
  appendInlineContent(block, node.content);
  parent.appendChild(block);
};

const hydrateEditor = (editor, documentValue, fallbackText = "") => {
  editor.replaceChildren();

  if (
    documentValue?.type === "doc"
    && Array.isArray(documentValue.content)
    && documentValue.content.length > 0
  ) {
    documentValue.content.forEach((node) => appendRichTextBlock(editor, node));
    return;
  }

  const plainText = String(fallbackText || "");
  if (!plainText) return;

  plainText.split("\n").forEach((line) => {
    const paragraph = document.createElement("p");
    if (line) {
      paragraph.textContent = line;
    } else {
      paragraph.appendChild(document.createElement("br"));
    }
    editor.appendChild(paragraph);
  });
};

export default function RichTextEditor({
  placeholder = "What's on your mind?",
  onChange,
  autoFocus = false,
  maxLength = 5000,
  initialText = "",
  initialDocument = null,
}) {
  const editorRef = useRef(null);
  const initializedRef = useRef(false);
  const [empty, setEmpty] = useState(true);

  const syncValue = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const text = getRichTextPlainText(editor);
    if (text.length > maxLength) {
      document.execCommand?.("undo");
      window.setTimeout(syncValue, 0);
      return;
    }

    setEmpty(!text);
    onChange?.({
      text,
      document: serializeRichTextElement(editor),
    });
  }, [maxLength, onChange]);

  useEffect(() => {
    if (initializedRef.current || !editorRef.current) return;

    hydrateEditor(editorRef.current, initialDocument, initialText);
    setEmpty(!getRichTextPlainText(editorRef.current));
    initializedRef.current = true;
  }, [initialDocument, initialText]);

  useEffect(() => {
    if (autoFocus) {
      const timer = window.setTimeout(() => editorRef.current?.focus(), 40);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [autoFocus]);

  const runCommand = (command, value = null) => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    document.execCommand?.(command, false, value);
    syncValue();
  };

  const addLink = () => {
    const selection = window.getSelection?.();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }

    const input = window.prompt("Enter the link address");
    if (input === null) return;

    const href = normalizeLinkInput(input);
    if (!href) {
      window.alert("Please enter a valid http, https, mailto, or tel link.");
      return;
    }

    runCommand("createLink", href);
  };

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar" role="toolbar" aria-label="Post formatting">
        {TOOLBAR_ACTIONS.slice(0, 9).map((action) => (
          <button
            key={action.key}
            type="button"
            className={`rich-text-toolbar__button rich-text-toolbar__button--${action.key}`}
            title={action.title}
            aria-label={action.title}
            onMouseDown={(event) => {
              event.preventDefault();
              runCommand(action.command, action.value || null);
            }}
          >
            {action.label}
          </button>
        ))}

        <button
          type="button"
          className="rich-text-toolbar__button"
          title="Add link"
          aria-label="Add link"
          onMouseDown={(event) => {
            event.preventDefault();
            addLink();
          }}
        >
          🔗
        </button>

        {TOOLBAR_ACTIONS.slice(9).map((action) => (
          <button
            key={action.key}
            type="button"
            className={`rich-text-toolbar__button rich-text-toolbar__button--${action.key}`}
            title={action.title}
            aria-label={action.title}
            onMouseDown={(event) => {
              event.preventDefault();
              runCommand(action.command, action.value || null);
            }}
          >
            {action.label}
          </button>
        ))}
      </div>

      <div
        ref={editorRef}
        className="pc-textarea composer-textarea rich-text-editor__surface"
        role="textbox"
        aria-multiline="true"
        aria-label="Post text"
        contentEditable
        suppressContentEditableWarning
        data-empty={empty ? "true" : "false"}
        data-placeholder={placeholder}
        onInput={syncValue}
        onBlur={syncValue}
        onPaste={() => window.setTimeout(syncValue, 0)}
      />
    </div>
  );
}
