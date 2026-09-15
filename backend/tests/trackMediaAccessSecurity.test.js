const mockResolvePurchasableItem = jest.fn();
const mockHasEntitlement = jest.fn();
const mockCreatorLean = jest.fn();

jest.mock("../services/catalogService", () => ({
  resolvePurchasableItem: (...args) => mockResolvePurchasableItem(...args),
}));

jest.mock("../services/entitlementService", () => ({
  hasEntitlement: (...args) => mockHasEntitlement(...args),
}));

jest.mock("../models/CreatorProfile", () => ({
  findById: jest.fn(() => ({
    select: jest.fn(() => ({
      lean: (...args) => mockCreatorLean(...args),
    })),
  })),
}));

const { authorizeTrackMediaDelivery } = require("../services/trackMediaAccessService");

const paidTrackItem = () => ({
  itemType: "track",
  itemId: "track-1",
  creatorId: "creator-1",
  price: 2500,
  payload: {
    _id: "track-1",
    creatorId: "creator-1",
    price: 2500,
    isPublished: true,
    publishedStatus: "published",
    archivedAt: null,
    audioUrl: "https://cdn.test/full-song.mp3",
    previewMedia: {
      secureUrl: "https://cdn.test/preview.mp3",
      duration: 30,
    },
    previewUrl: "https://cdn.test/preview.mp3",
  },
});

describe("paid track delivery authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolvePurchasableItem.mockResolvedValue(paidTrackItem());
    mockHasEntitlement.mockResolvedValue(false);
    mockCreatorLean.mockResolvedValue({ userId: "creator-owner" });
  });

  test("an old/tampered preview payload pointing at the master is replaced with the canonical 30-second preview", async () => {
    const payload = {
      itemType: "track",
      itemId: "track-1",
      accessType: "preview",
      uid: "unpaid-user",
      dl: false,
      src: "https://cdn.test/full-song.mp3",
    };

    const result = await authorizeTrackMediaDelivery(payload);

    expect(result.sourceUrl).toBe("https://cdn.test/preview.mp3");
    expect(payload.src).toBe("https://cdn.test/preview.mp3");
    expect(payload.src).not.toContain("full-song.mp3");
  });

  test("an unpaid user cannot request the full stream", async () => {
    const payload = {
      itemType: "track",
      itemId: "track-1",
      accessType: "stream",
      uid: "unpaid-user",
      dl: false,
    };

    await expect(authorizeTrackMediaDelivery(payload)).rejects.toMatchObject({
      status: 403,
      message: expect.stringMatching(/verified purchase|required to play/i),
    });
  });

  test("preview delivery is refused when the only preview is longer than 30 seconds", async () => {
    const item = paidTrackItem();
    item.payload.previewMedia.duration = 178;
    mockResolvePurchasableItem.mockResolvedValue(item);

    const payload = {
      itemType: "track",
      itemId: "track-1",
      accessType: "preview",
      uid: "unpaid-user",
      dl: false,
    };

    await expect(authorizeTrackMediaDelivery(payload)).rejects.toMatchObject({
      status: 404,
      message: expect.stringMatching(/30 seconds/i),
    });
    expect(payload.src).toBeUndefined();
  });
});
