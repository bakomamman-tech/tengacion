const {
  normalizePublicText,
  uniquePublicActivity,
} = require("../utils/publicText");

describe("public text utilities", () => {
  test("repairs malformed abbreviated dollar amounts", () => {
    expect(normalizePublicText("Funding reached .6BN")).toBe("Funding reached $0.6BN");
    expect(normalizePublicText("The estimate is USD .653bn")).toBe("The estimate is $0.653bn");
  });

  test("removes duplicate public captions", () => {
    expect(
      uniquePublicActivity([
        { text: "Creator update" },
        { text: " Creator   update " },
        { text: "Another update" },
      ])
    ).toHaveLength(2);
  });
});
