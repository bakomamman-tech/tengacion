jest.mock("../config/env", () => ({
  config: {
    MEDIA_SIGNING_SECRET: "test-media-signing-secret",
    JWT_SECRET: "test-jwt-secret",
    NODE_ENV: "test",
  },
}));

const {
  buildSignedMediaUrl,
  verifySignedMediaToken,
} = require("../services/mediaSigner");

const req = {
  protocol: "https",
  ip: "127.0.0.1",
  headers: { "user-agent": "jest" },
  socket: {},
  get: (name) => (name === "host" ? "tengacion.test" : ""),
};

const extractToken = (url) => decodeURIComponent(url.split("/api/media/delivery/")[1]);
const decodePayload = (token) =>
  JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));

describe("track media token privacy", () => {
  test("protected track tokens do not reveal the backing storage URL", () => {
    const masterUrl = "https://res.cloudinary.com/example/video/upload/private-master.mp3";
    const url = buildSignedMediaUrl({
      sourceUrl: masterUrl,
      userId: "user-1",
      itemType: "track",
      itemId: "track-1",
      accessType: "preview",
      req,
    });

    const token = extractToken(url);
    const payload = decodePayload(token);

    expect(payload.src).toBeUndefined();
    expect(payload.itemType).toBe("track");
    expect(payload.itemId).toBe("track-1");
    expect(payload.accessType).toBe("preview");
    expect(JSON.stringify(payload)).not.toContain(masterUrl);
    expect(verifySignedMediaToken(token, { req })).toEqual(
      expect.objectContaining({ itemId: "track-1", accessType: "preview" })
    );
  });

  test("non-track signed media keeps its source for existing delivery flows", () => {
    const sourceUrl = "https://cdn.test/image.jpg";
    const url = buildSignedMediaUrl({ sourceUrl, itemType: "image", req });
    const payload = decodePayload(extractToken(url));

    expect(payload.src).toBe(sourceUrl);
  });
});
