const {
  decodeRichTextTransport,
  normalizeRichText,
  richTextToPlainText,
} = require("../utils/richText");

describe("rich text normalization", () => {
  test("keeps supported formatting and derives the visible plain text", () => {
    const document = normalizeRichText({
      type: "doc",
      version: 1,
      content: [
        {
          type: "heading",
          attrs: { level: 2, align: "center" },
          content: [
            { type: "text", text: "Welcome", marks: ["bold", "underline"] },
          ],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "to Tengacion" }],
        },
      ],
    });

    expect(document).toEqual({
      type: "doc",
      version: 1,
      content: [
        {
          type: "heading",
          attrs: { level: 2, align: "center" },
          content: [
            { type: "text", text: "Welcome", marks: ["bold", "underline"] },
          ],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "to Tengacion" }],
        },
      ],
    });
    expect(richTextToPlainText(document)).toBe("Welcome\nto Tengacion");
  });

  test("drops unsafe links and unsupported nodes", () => {
    const document = normalizeRichText({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Safe text",
              marks: [{ type: "link", href: "javascript:alert(1)" }, "bold"],
            },
          ],
        },
        {
          type: "script",
          content: [{ type: "text", text: "ignored" }],
        },
      ],
    });

    expect(document.content).toHaveLength(1);
    expect(document.content[0].content[0]).toEqual({
      type: "text",
      text: "Safe text",
      marks: ["bold"],
    });
  });

  test("decodes the media-upload transport envelope", () => {
    const payload = {
      type: "doc",
      version: 1,
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Formatted media caption" }] },
      ],
    };

    expect(
      decodeRichTextTransport(
        `__TENGACION_RICH_TEXT_V1__${JSON.stringify(payload)}`
      )
    ).toEqual(payload);
    expect(decodeRichTextTransport("plain text")).toBeNull();
  });
});
