const { buildCreatorActivationProgress } = require("../services/creatorActivationService");

const completeProfile = {
  _id: "creator-1",
  userId: "user-1",
  displayName: "Creator Example",
  fullName: "Creator Example",
  accountNumber: "0048044805",
  country: "Nigeria",
  countryOfResidence: "Nigeria",
  creatorTypes: ["music"],
  acceptedTerms: true,
  acceptedCopyrightDeclaration: true,
  onboardingCompleted: true,
  profileCompletionScore: 100,
};

describe("creatorActivationService", () => {
  test("builds the next activation step for a creator without lanes", () => {
    const activation = buildCreatorActivationProgress({
      profile: {
        _id: "creator-1",
        userId: "user-1",
        displayName: "Creator Example",
      },
      user: { _id: "user-1", name: "Creator Example" },
    });

    expect(activation).toMatchObject({
      status: "in_progress",
      completedCount: 1,
      totalSteps: 6,
      progressPercent: 17,
      nextStep: expect.objectContaining({
        key: "creator_lane_selected",
        actionTo: "/creator/categories",
      }),
    });
  });

  test("distinguishes first upload started from first upload completed", () => {
    const activation = buildCreatorActivationProgress({
      profile: completeProfile,
      creatorTypes: ["music"],
      content: {
        musicTracks: [{ _id: "track-1", publishedStatus: "draft" }],
      },
    });

    expect(activation.firstUploadStarted).toBe(true);
    expect(activation.firstUploadCompleted).toBe(false);
    expect(activation.nextStep).toMatchObject({
      key: "first_upload_completed",
      actionTo: "/creator/music/upload",
    });
  });

  test("marks activation complete once setup, upload, and payout setup exist", () => {
    const activation = buildCreatorActivationProgress({
      profile: completeProfile,
      creatorTypes: ["music"],
      content: {
        musicTracks: [{ _id: "track-1", publishedStatus: "published" }],
      },
      payoutReadiness: {
        status: "ready",
        ready: true,
      },
    });

    expect(activation).toMatchObject({
      status: "complete",
      completedCount: 6,
      totalSteps: 6,
      progressPercent: 100,
      nextStep: null,
      firstUploadStarted: true,
      firstUploadCompleted: true,
    });
  });
});
