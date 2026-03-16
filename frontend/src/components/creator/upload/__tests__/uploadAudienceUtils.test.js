import { describe, expect, it } from "vitest";

import {
  buildCreatorAudiencePath,
  buildUploadOutcome,
  getAudienceDestinationCopy,
} from "../uploadAudienceUtils";

describe("uploadAudienceUtils", () => {
  it("builds preview-aware audience links for published releases", () => {
    expect(
      buildCreatorAudiencePath({
        creatorProfileId: "creator123",
        categoryKey: "music",
        previewItemId: "track456",
      })
    ).toBe("/creators/creator123/music?previewItem=track456");
  });

  it("returns the correct audience experience copy for books and podcasts", () => {
    expect(getAudienceDestinationCopy({ itemType: "book" }).actions).toEqual([
      "Preview",
      "Buy",
      "Read",
      "Download",
    ]);
    expect(getAudienceDestinationCopy({ categoryKey: "podcast" }).pageLabel).toBe(
      "Public podcasts page"
    );
  });

  it("packages published upload outcomes with destination metadata", () => {
    expect(
      buildUploadOutcome({
        creatorProfileId: "creator123",
        categoryKey: "music",
        itemType: "album",
        itemId: "album789",
        title: "Sunrise EP",
        publishedStatus: "published",
      })
    ).toMatchObject({
      title: "Sunrise EP",
      audiencePageLabel: "Public music page",
      audienceActions: ["Preview", "Stream", "Buy", "Watch"],
      audiencePath: "/creators/creator123/music?previewItem=album789",
      detailPath: "/albums/album789",
    });
  });
});
