describe("videoStorage full path", () => {
  const resetModules = () => {
    jest.resetModules();
  };

  const applyBaseEnv = () => {
    process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-test";
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
  };

  afterEach(() => {
    delete process.env.USE_LOCAL_VIDEO_MOCK;
    delete process.env.LOCAL_VIDEO_MOCK_URL;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_REGION;
    delete process.env.AWS_S3_BUCKET;
    resetModules();
  });

  test("returns mock payload when USE_LOCAL_VIDEO_MOCK is true", async () => {
    process.env.USE_LOCAL_VIDEO_MOCK = "true";
    process.env.LOCAL_VIDEO_MOCK_URL = "https://example.com/mock-video.mp4";
    applyBaseEnv();
    resetModules();

    const { createVideoUploadPayload } = require("../services/videoStorage");
    const payload = await createVideoUploadPayload({
      filename: "test-video.mp4",
      contentType: "video/mp4",
      sizeBytes: 1024,
    });

    expect(payload.isMockUpload).toBe(true);
    expect(payload.fileUrl).toBe("https://example.com/mock-video.mp4");
    expect(payload.uploadUrl).toBe("");
  });

  test("throws when bucket is missing and mock is disabled", async () => {
    process.env.USE_LOCAL_VIDEO_MOCK = "false";
    applyBaseEnv();
    resetModules();

    const { createVideoUploadPayload } = require("../services/videoStorage");

    await expect(
      createVideoUploadPayload({
        filename: "test.mp4",
        contentType: "video/mp4",
        sizeBytes: 512,
      })
    ).rejects.toThrow("S3 bucket configuration is incomplete");
  });
});
