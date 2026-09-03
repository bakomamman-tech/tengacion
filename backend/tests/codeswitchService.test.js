const {
  UNDEFINED_WER_REASON,
  calculateWordErrorRate,
  normalizeTranscript,
} = require("../services/codeswitchService");

describe("VoiceBridge transcript normalization", () => {
  test("normalizes the mandatory order-support example", () => {
    expect(normalizeTranscript("Please check my order!")).toBe(
      "please check my order"
    );
  });

  test("normalizes capitalization, punctuation, and repeated whitespace", () => {
    expect(normalizeTranscript("  PLEASE,\tcheck\nmy   order!!!  ")).toBe(
      "please check my order"
    );
  });

  test("preserves Hausa and Nigerian Pidgin lexical content", () => {
    expect(normalizeTranscript("Don Allah, duba odà na!")).toBe(
      "don allah duba odà na"
    );
    expect(normalizeTranscript("Abeg, no change wetin I talk.")).toBe(
      "abeg no change wetin i talk"
    );
  });

  test("uses canonical Unicode composition", () => {
    expect(normalizeTranscript("KA\u0301DUNA")).toBe("káduna");
  });

  test("normalizes empty and punctuation-only input to an empty transcript", () => {
    expect(normalizeTranscript("")).toBe("");
    expect(normalizeTranscript("... — !!!")).toBe("");
  });
});

describe("VoiceBridge normalized word error rate", () => {
  test("returns zero for the mandatory normalized match", () => {
    expect(
      calculateWordErrorRate({
        reference: "Please check my order!",
        hypothesis: "please check my order",
      })
    ).toEqual({
      wer: 0,
      substitutions: 0,
      deletions: 0,
      insertions: 0,
      referenceWordCount: 4,
      normalizedReference: "please check my order",
      normalizedHypothesis: "please check my order",
    });
  });

  test("counts one substitution", () => {
    expect(
      calculateWordErrorRate({
        reference: "I need rice",
        hypothesis: "I need beans",
      })
    ).toEqual(
      expect.objectContaining({
        wer: 1 / 3,
        substitutions: 1,
        deletions: 0,
        insertions: 0,
      })
    );
  });

  test("counts one insertion", () => {
    expect(
      calculateWordErrorRate({
        reference: "I need rice",
        hypothesis: "I really need rice",
      })
    ).toEqual(
      expect.objectContaining({
        wer: 1 / 3,
        substitutions: 0,
        deletions: 0,
        insertions: 1,
      })
    );
  });

  test("counts one deletion and handles an empty hypothesis", () => {
    expect(
      calculateWordErrorRate({
        reference: "I need rice",
        hypothesis: "I rice",
      })
    ).toEqual(
      expect.objectContaining({
        wer: 1 / 3,
        substitutions: 0,
        deletions: 1,
        insertions: 0,
      })
    );

    expect(
      calculateWordErrorRate({
        reference: "don allah",
        hypothesis: "",
      })
    ).toEqual(
      expect.objectContaining({
        wer: 1,
        substitutions: 0,
        deletions: 2,
        insertions: 0,
      })
    );
  });

  test("ignores punctuation, capitalization, whitespace, and canonical Unicode differences", () => {
    expect(
      calculateWordErrorRate({
        reference: "  DON Allah, ka je KA\u0301DUNA! ",
        hypothesis: "don allah ka je káduna",
      })
    ).toEqual(
      expect.objectContaining({
        wer: 0,
        substitutions: 0,
        deletions: 0,
        insertions: 0,
        normalizedReference: "don allah ka je káduna",
        normalizedHypothesis: "don allah ka je káduna",
      })
    );
  });

  test("scores Nigerian Pidgin tokens without rewriting them", () => {
    expect(
      calculateWordErrorRate({
        reference: "Abeg, wetin happen?",
        hypothesis: "abeg wetin happen",
      })
    ).toEqual(
      expect.objectContaining({
        wer: 0,
        normalizedReference: "abeg wetin happen",
        normalizedHypothesis: "abeg wetin happen",
      })
    );
  });

  test.each([
    ["", "", 0],
    ["...", "Abeg", 1],
  ])(
    "returns an explicitly undefined WER when reference %p normalizes empty",
    (reference, hypothesis, insertions) => {
      expect(calculateWordErrorRate({ reference, hypothesis })).toEqual(
        expect.objectContaining({
          wer: null,
          substitutions: 0,
          deletions: 0,
          insertions,
          referenceWordCount: 0,
          undefinedReason: UNDEFINED_WER_REASON,
        })
      );
    }
  );
});
