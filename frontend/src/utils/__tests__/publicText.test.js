import { describe, expect, it } from "vitest";

import { normalizePublicText, uniquePublicActivity } from "../publicText";

describe("public text utilities", () => {
  it("repairs finance shorthand that is missing a dollar sign and leading zero", () => {
    expect(normalizePublicText("Funding reached .6BN this year")).toBe(
      "Funding reached $0.6BN this year"
    );
    expect(normalizePublicText("The estimate is USD .653bn")).toBe(
      "The estimate is $0.653bn"
    );
    expect(normalizePublicText("Sales crossed $.8million")).toBe(
      "Sales crossed $0.8million"
    );
  });

  it("removes exact duplicate captions from a public activity sample", () => {
    expect(
      uniquePublicActivity([
        { _id: "one", text: "A creator update" },
        { _id: "two", text: " A creator   update " },
        { _id: "three", text: "A different update" },
      ])
    ).toHaveLength(2);
  });
});
