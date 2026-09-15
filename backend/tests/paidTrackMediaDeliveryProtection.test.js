process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-paid-track-media-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "paid-track-media-test-secret-1234567890";
process.env.MEDIA_SIGNING_SECRET = process.env.MEDIA_SIGNING_SECRET || "paid-track-media-signing-secret-1234567890";

jest.mock("../services/catalogService", () => ({
  resolvePurchasableItem: jest.fn(),
}));

jest.mock("../services/entitlementService", () => ({
  hasEntitlement: jest.fn(),
}));

const { resolvePurchasableItem } = require("../services/catalogService");
const { buildSignedMediaUrl, verifySignedMediaToken } = require("../services/mediaSigner");
const {
  authorizeTrackMediaDelivery,
  buildCloudinaryBoundedPreviewUrl,
  resolveProtectedTrackPreviewSource,
} = require("../services/trackMediaAccessService");

const requestStub = ({ fetchDest = "audio", fetchMode = "no-cors" } = {}) => ({
  protocol: "https",
  ip: "127.0.0.1",
  socket: { remoteAddress: "127.0.0.1" },
  headers: {
    "user-agent": "Tengacion test browser",
    "sec-fetch-dest": fetchDest,
    "sec-fetch-mode": fetchMode,
  },
  get: (name) => (String(name).toLowerCase() === "host" ? "tengacion.test" : ""),
});

const tokenFromUrl = (signedUrl) => {
  const pathname = new URL(signedUrl).pathname;
  return decodeURIComponent(pathname.split("/").pop());
};

const decodeSignedPayloadWithoutVerification = (token) => {
  const [encodedPayload] = String(token || "").split(".");
  return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
};

beforeEach(() => {
  jest.clearAllMocks();
});

test("protected track tokens never expose the raw storage URL", () => {
  const masterUrl = "https://private-storage.example.com/master/song.mp3";
  const signedUrl = buildSignedMediaUrl({
    sourceUrl: masterUrl,
    userId: "viewer-1",
    itemType: "track",
    itemId: "507f1f77bcf86cd799439011",
    accessType: "preview",
    req: requestStub(),
    expiresInSec: 300,
  });

  expect(signedUrl).toContain("/api/media/delivery/");

  const token = tokenFromUrl(signedUrl);
  const decoded = decodeSignedPayloadWithoutVerification(token);

  expect(decoded).toMatchObject({
    itemType: "track",
    itemId: "507f1f77bcf86cd799439011",
    accessType: "preview",
    dl: false,
  });
  expect(decoded).not.toHaveProperty("src");
  expect(JSON.stringify(decoded)).not.toContain(masterUrl);
  expect(verifySignedMediaToken(token)).toMatchObject({
    itemType: "track",
    accessType: "preview",
  });
});

test("non-track signed media keeps its source because protection is scoped", () => {
  const sourceUrl = "https://cdn.example.com/images/cover.jpg";
  const signedUrl = buildSignedMediaUrl({
    sourceUrl,
    itemType: "image",
    itemId: "cover-1",
    req: requestStub(),
  });

  const decoded = decodeSignedPayloadWithoutVerification(tokenFromUrl(signedUrl));
  expect(decoded.src).toBe(sourceUrl);
});

test("direct browser navigation to protected preview and stream URLs is rejected", () => {
  const signedUrl = buildSignedMediaUrl({
    sourceUrl: "https://private-storage.example.com/master/song.mp3",
    itemType: "track",
    itemId: "507f1f77bcf86cd799439011",
    accessType: "preview",
    req: requestStub(),
  });
  const token = tokenFromUrl(signedUrl);

  expect(() =>
    verifySignedMediaToken(token, {
      req: requestStub({ fetchDest: "document", fetchMode: "navigate" }),
    })
  ).toThrow("Protected media must be played inside Tengacion");

  expect(() =>
    verifySignedMediaToken(token, {
      req: requestStub({ fetchDest: "audio", fetchMode: "no-cors" }),
    })
  ).not.toThrow();
});

test("Cloudinary paid previews are converted to a server-bounded 30-second asset", () => {
  const fullSource =
    "https://res.cloudinary.com/tengacion/video/upload/v1750000000/tengacion/creators/audio/song.mp3";

  const preview = buildCloudinaryBoundedPreviewUrl({
    sourceUrl: fullSource,
    startSec: 42,
    limitSec: 90,
  });

  expect(preview).not.toBe(fullSource);
  expect(preview).toContain("/video/upload/so_42,du_30/");
});

test("paid non-Cloudinary media never falls back to the full master as its preview", () => {
  const fullSource = "https://media.example.com/tengacion/master/song.mp3";

  expect(
    resolveProtectedTrackPreviewSource(
      {
        price: 2500,
        audioUrl: fullSource,
        previewUrl: fullSource,
        previewStartSec: 0,
        previewLimitSec: 30,
      },
      { price: 2500 }
    )
  ).toBe("");
});

test("a paid track with a distinct preview source never authorizes the full master for preview", async () => {
  const fullSource = "https://media.example.com/tengacion/master/song.mp3";
  const previewSource = "https://media.example.com/tengacion/previews/song-30s.mp3";

  resolvePurchasableItem.mockResolvedValue({
    itemType: "track",
    itemId: "507f1f77bcf86cd799439011",
    creatorId: "507f191e810c19729de860ea",
    price: 2500,
    payload: {
      price: 2500,
      audioUrl: fullSource,
      fullAudioUrl: fullSource,
      previewUrl: previewSource,
      previewSampleUrl: previewSource,
      previewStartSec: 0,
      previewLimitSec: 30,
    },
  });

  const payload = {
    itemType: "track",
    itemId: "507f1f77bcf86cd799439011",
    uid: "",
    accessType: "preview",
    dl: false,
  };

  const result = await authorizeTrackMediaDelivery(payload);

  expect(result.previewOnly).toBe(true);
  expect(payload.src).toBe(previewSource);
  expect(payload.src).not.toBe(fullSource);
  expect(payload.disposition).toBe("inline");
  expect(payload.dl).toBe(false);
});

test("a paid track without a protected preview fails closed", async () => {
  const fullSource = "https://media.example.com/tengacion/master/song.mp3";

  resolvePurchasableItem.mockResolvedValue({
    itemType: "track",
    itemId: "507f1f77bcf86cd799439011",
    creatorId: "507f191e810c19729de860ea",
    price: 2500,
    payload: {
      price: 2500,
      audioUrl: fullSource,
      fullAudioUrl: fullSource,
      previewUrl: fullSource,
      previewStartSec: 0,
      previewLimitSec: 30,
    },
  });

  await expect(
    authorizeTrackMediaDelivery({
      itemType: "track",
      itemId: "507f1f77bcf86cd799439011",
      uid: "",
      accessType: "preview",
      dl: false,
    })
  ).rejects.toMatchObject({
    status: 403,
    message: "This paid song does not yet have a protected 30-second preview",
  });
});

test("preview tokens cannot be upgraded into download requests", async () => {
  resolvePurchasableItem.mockResolvedValue({
    itemType: "track",
    itemId: "507f1f77bcf86cd799439011",
    creatorId: "507f191e810c19729de860ea",
    price: 2500,
    payload: {
      price: 2500,
      audioUrl: "https://media.example.com/tengacion/master/song.mp3",
      previewUrl: "https://media.example.com/tengacion/previews/song-30s.mp3",
    },
  });

  await expect(
    authorizeTrackMediaDelivery({
      itemType: "track",
      itemId: "507f1f77bcf86cd799439011",
      uid: "",
      accessType: "preview",
      dl: true,
    })
  ).rejects.toMatchObject({
    status: 403,
    message: "Preview links cannot be used for downloads",
  });
});
