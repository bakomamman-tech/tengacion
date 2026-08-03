import { describe, expect, it } from "vitest";

import {
  CREATOR_PUBLIC_ROUTE_CONTRACT,
  buildArtistCompatibilityTarget,
  buildCreatorIdPath,
  buildCreatorPublicPath,
} from "../publicRoutes";

describe("public creator route contract", () => {
  it("uses a normalized username as the canonical public route", () => {
    expect(
      buildCreatorPublicPath({
        creatorId: "creator-id",
        username: "@Creator.Example",
        tab: "books",
      })
    ).toBe("/creator/creator.example/books");
    expect(
      buildCreatorPublicPath({ creatorId: "creator-id", username: "Creator.Example", tab: "posts" })
    ).toBe("/creator/creator.example/posts");
    expect(CREATOR_PUBLIC_ROUTE_CONTRACT).toEqual(
      expect.objectContaining({
        canonicalPath: "/creator/:username",
        readAccess: "public",
      })
    );
  });

  it("keeps creator IDs as compatibility paths when no safe username is available", () => {
    expect(buildCreatorIdPath({ creatorId: "creator-id", tab: "music" })).toBe(
      "/creators/creator-id/music"
    );
    expect(
      buildCreatorPublicPath({ creatorId: "creator-id", username: "dashboard" })
    ).toBe("/creators/creator-id");
  });

  it("maps the artist compatibility path onto the public creator contract", () => {
    expect(buildArtistCompatibilityTarget({ username: "@Creator.Example" })).toBe(
      "/creator/creator.example"
    );
    expect(buildArtistCompatibilityTarget({ username: "music" })).toBe("/creators/music");
  });
});
