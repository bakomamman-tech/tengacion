const normalizeKnowledgeText = (
  value
) =>
  String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

const estimateTokens = (
  text
) =>
  Math.max(
    1,
    Math.ceil(
      String(text || "").length / 4
    )
  );

const chooseBoundary = ({
  text,
  start,
  proposedEnd,
  minEnd,
}) => {
  const section =
    text.slice(
      start,
      proposedEnd
    );

  const candidates = [
    section.lastIndexOf("\n\n"),
    section.lastIndexOf(". "),
    section.lastIndexOf("? "),
    section.lastIndexOf("! "),
    section.lastIndexOf(" "),
  ];

  const best =
    Math.max(...candidates);

  if (
    best < 0 ||
    start + best < minEnd
  ) {
    return proposedEnd;
  }

  return start + best + 1;
};

const chunkKnowledgeText = (
  value,
  {
    maxChars = 1800,
    overlapChars = 220,
  } = {}
) => {
  const text =
    normalizeKnowledgeText(value);

  if (!text) {
    return [];
  }

  const safeMaxChars =
    Math.max(
      500,
      Number(maxChars) || 1800
    );

  const safeOverlap =
    Math.min(
      Math.max(
        0,
        Number(overlapChars) || 0
      ),
      Math.floor(
        safeMaxChars / 3
      )
    );

  if (
    text.length <= safeMaxChars
  ) {
    return [text];
  }

  const chunks = [];

  let start = 0;

  while (start < text.length) {
    const proposedEnd =
      Math.min(
        start + safeMaxChars,
        text.length
      );

    let end =
      proposedEnd;

    if (
      proposedEnd < text.length
    ) {
      end =
        chooseBoundary({
          text,
          start,
          proposedEnd,
          minEnd:
            start +
            Math.floor(
              safeMaxChars * 0.6
            ),
        });
    }

    const chunk =
      text
        .slice(start, end)
        .trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= text.length) {
      break;
    }

    const nextStart =
      Math.max(
        0,
        end - safeOverlap
      );

    start =
      nextStart > start
        ? nextStart
        : end;
  }

  return chunks;
};

module.exports = {
  chunkKnowledgeText,
  estimateTokens,
  normalizeKnowledgeText,
};