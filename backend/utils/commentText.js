const COMMENT_WORD_LIMIT = 5000;
const COMMENT_MAX_CHARS = 120000;

const normalizeCommentText = (value, maxWords = COMMENT_WORD_LIMIT) => {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const wordMatches = trimmed.match(/\S+/g);
  if (!wordMatches || wordMatches.length <= maxWords) {
    return trimmed;
  }

  let count = 0;
  const wordPattern = /\S+/g;
  let match;
  let endIndex = trimmed.length;

  while ((match = wordPattern.exec(trimmed)) !== null) {
    count += 1;
    if (count === maxWords) {
      endIndex = match.index + match[0].length;
      break;
    }
  }

  return trimmed.slice(0, endIndex);
};

module.exports = {
  COMMENT_WORD_LIMIT,
  COMMENT_MAX_CHARS,
  normalizeCommentText,
};
