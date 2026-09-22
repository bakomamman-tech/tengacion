import { describe, expect, it } from "vitest";

import { MEBIBYTE } from "../../../../config/uploadLimits";
import { musicUploadSchema } from "../uploadSchemas";

const buildMusicValues = (releaseMediaFile) => ({
  releaseMediaType: "video",
  trackTitle: "Limit Test",
  artistName: "",
  genre: "",
  description: "",
  price: 0,
  releaseType: "single",
  explicitContent: false,
  featuringArtists: "",
  producerCredits: "",
  songwriterCredits: "",
  releaseDate: "",
  lyrics: "",
  previewStartSec: 0,
  coverImageFile: null,
  releaseMediaFile,
  previewSampleFile: null,
});

describe("creator upload schemas", () => {
  it("accepts a creator video at the 200MB limit", () => {
    const result = musicUploadSchema.safeParse(
      buildMusicValues({ name: "release.mp4", size: 200 * MEBIBYTE })
    );

    expect(result.success).toBe(true);
  });

  it("rejects a creator video above the 200MB limit", () => {
    const result = musicUploadSchema.safeParse(
      buildMusicValues({ name: "release.mp4", size: 200 * MEBIBYTE + 1 })
    );

    expect(result.success).toBe(false);
    expect(result.error.issues.some((issue) => /200MB or smaller/i.test(issue.message))).toBe(true);
  });
});
