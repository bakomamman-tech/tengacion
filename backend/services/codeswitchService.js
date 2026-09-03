const MAX_TRANSCRIPT_CHARS = 20000;
const MAX_TRANSCRIPT_WORDS = 1000;
const NORMALIZATION_VERSION = "voicebridge-nwer-v1";
const UNDEFINED_WER_REASON =
  "Normalized reference contains no words; WER requires at least one reference word.";

const assertTranscript = (value, fieldName = "transcript") => {
  if (typeof value !== "string") {
    throw new TypeError(`${fieldName} must be a string.`);
  }

  if (value.length > MAX_TRANSCRIPT_CHARS) {
    throw new RangeError(
      `${fieldName} must not exceed ${MAX_TRANSCRIPT_CHARS} characters.`
    );
  }
};

/**
 * Apply the single provider-neutral normalization policy used by VoiceBridge.
 * Punctuation becomes a boundary rather than joining the words on either side.
 */
const normalizeTranscript = (text) => {
  assertTranscript(text, "text");

  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/\p{P}+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
};

const tokenize = (normalizedText) =>
  normalizedText ? normalizedText.split(" ") : [];

const addOperation = (cell, operation) => ({
  cost: cell.cost + 1,
  substitutions: cell.substitutions + (operation === "substitution" ? 1 : 0),
  deletions: cell.deletions + (operation === "deletion" ? 1 : 0),
  insertions: cell.insertions + (operation === "insertion" ? 1 : 0),
});

const selectLowestCost = (candidates) =>
  candidates.reduce((best, candidate) =>
    candidate.cost < best.cost ? candidate : best
  );

/**
 * Calculate word-level Levenshtein distance while retaining S/D/I counts.
 * The dynamic-programming rows keep memory bounded to O(hypothesis words).
 */
const alignWords = (referenceWords, hypothesisWords) => {
  let previous = Array.from({ length: hypothesisWords.length + 1 }, (_, index) => ({
    cost: index,
    substitutions: 0,
    deletions: 0,
    insertions: index,
  }));

  for (let referenceIndex = 1; referenceIndex <= referenceWords.length; referenceIndex += 1) {
    const current = [
      {
        cost: referenceIndex,
        substitutions: 0,
        deletions: referenceIndex,
        insertions: 0,
      },
    ];

    for (
      let hypothesisIndex = 1;
      hypothesisIndex <= hypothesisWords.length;
      hypothesisIndex += 1
    ) {
      if (
        referenceWords[referenceIndex - 1] === hypothesisWords[hypothesisIndex - 1]
      ) {
        current[hypothesisIndex] = { ...previous[hypothesisIndex - 1] };
        continue;
      }

      // Candidate order is the deterministic tie-break policy: S, then D, then I.
      current[hypothesisIndex] = selectLowestCost([
        addOperation(previous[hypothesisIndex - 1], "substitution"),
        addOperation(previous[hypothesisIndex], "deletion"),
        addOperation(current[hypothesisIndex - 1], "insertion"),
      ]);
    }

    previous = current;
  }

  return previous[hypothesisWords.length];
};

const calculateWordErrorRate = ({ reference, hypothesis }) => {
  assertTranscript(reference, "reference");
  assertTranscript(hypothesis, "hypothesis");

  const normalizedReference = normalizeTranscript(reference);
  const normalizedHypothesis = normalizeTranscript(hypothesis);
  const referenceWords = tokenize(normalizedReference);
  const hypothesisWords = tokenize(normalizedHypothesis);

  if (
    referenceWords.length > MAX_TRANSCRIPT_WORDS ||
    hypothesisWords.length > MAX_TRANSCRIPT_WORDS
  ) {
    throw new RangeError(
      `Normalized transcripts must not exceed ${MAX_TRANSCRIPT_WORDS} words each.`
    );
  }

  const alignment = alignWords(referenceWords, hypothesisWords);
  const referenceWordCount = referenceWords.length;

  return {
    wer: referenceWordCount === 0 ? null : alignment.cost / referenceWordCount,
    substitutions: alignment.substitutions,
    deletions: alignment.deletions,
    insertions: alignment.insertions,
    referenceWordCount,
    normalizedReference,
    normalizedHypothesis,
    normalizationVersion: NORMALIZATION_VERSION,
    ...(referenceWordCount === 0
      ? { undefinedReason: UNDEFINED_WER_REASON }
      : {}),
  };
};

module.exports = {
  MAX_TRANSCRIPT_CHARS,
  MAX_TRANSCRIPT_WORDS,
  NORMALIZATION_VERSION,
  UNDEFINED_WER_REASON,
  calculateWordErrorRate,
  normalizeTranscript,
};
