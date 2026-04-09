const express = require("express");
const request = require("supertest");

const MEDIA_ID = "64f000000000000000000001";

const mockStreamGridFsMedia = jest.fn();
const mockGetLatestCaseForMediaId = jest.fn();
const mockIsHiddenFromPublic = jest.fn();
const mockIsRestrictedForPublic = jest.fn();

jest.mock("../services/mediaDeliveryService", () => ({
  streamGridFsMedia: (...args) => mockStreamGridFsMedia(...args),
  streamSourceMedia: jest.fn(),
}));

jest.mock("../services/moderationService", () => ({
  getLatestCaseForMediaId: (...args) => mockGetLatestCaseForMediaId(...args),
  isHiddenFromPublic: (...args) => mockIsHiddenFromPublic(...args),
  isRestrictedForPublic: (...args) => mockIsRestrictedForPublic(...args),
  shouldDeferPublicUserReportCase: jest.requireActual("../services/moderationService").shouldDeferPublicUserReportCase,
}));

const mediaRouter = require("../routes/media");

describe("media moderation route", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use("/api/media", mediaRouter);

    mockGetLatestCaseForMediaId.mockResolvedValue(null);
    mockIsHiddenFromPublic.mockReturnValue(false);
    mockIsRestrictedForPublic.mockReturnValue(false);
    mockStreamGridFsMedia.mockImplementation(async ({ res, headOnly = false }) => {
      if (headOnly) {
        res.status(200).end();
        return true;
      }

      res.status(200).send("streamed");
      return true;
    });
  });

  test("keeps post media visible while a user report is only pending review", async () => {
    mockGetLatestCaseForMediaId.mockResolvedValue({
      queue: "user_reported_sensitive_content",
      status: "HOLD_FOR_REVIEW",
      media: [{ mediaId: MEDIA_ID }],
    });
    mockIsHiddenFromPublic.mockReturnValue(true);

    const response = await request(app).get(`/api/media/${MEDIA_ID}`).expect(200);

    expect(response.text).toBe("streamed");
    expect(mockStreamGridFsMedia).toHaveBeenCalledTimes(1);
  });

  test("still hides media when moderation explicitly blocks it from public view", async () => {
    mockGetLatestCaseForMediaId.mockResolvedValue({
      queue: "explicit_pornography",
      status: "HOLD_FOR_REVIEW",
      media: [{ mediaId: MEDIA_ID }],
    });
    mockIsHiddenFromPublic.mockReturnValue(true);

    await request(app).get(`/api/media/${MEDIA_ID}`).expect(404);

    expect(mockStreamGridFsMedia).not.toHaveBeenCalled();
  });
});
