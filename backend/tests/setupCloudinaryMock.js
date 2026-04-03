process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
process.env.CLOUDINARY_API_KEY = "test-api-key";
process.env.CLOUDINARY_API_SECRET = "test-api-secret";

jest.mock("cloudinary", () => {
  const { Writable } = require("stream");
  const uploads = [];

  const buildSecureUrl = (publicId, resourceType, format) =>
    `https://res.cloudinary.com/test-cloud/${resourceType}/upload/v1/${publicId}.${format}`;

  const uploadStream = jest.fn((options = {}, callback = () => {}) => {
    const chunks = [];
    return new Writable({
      write(chunk, _encoding, next) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        next();
      },
      final(done) {
        const resourceType = String(options.resource_type || "image").trim() || "image";
        const folder = String(options.folder || "tengacion/test").trim() || "tengacion/test";
        const uploadNumber = uploads.length + 1;
        const format =
          resourceType === "image" ? "jpg" : resourceType === "raw" ? "bin" : "mp4";
        const publicId = `${folder}/mock-${uploadNumber}`;
        const bytes = Buffer.concat(chunks).length;
        const result = {
          public_id: publicId,
          secure_url: buildSecureUrl(publicId, resourceType, format),
          url: buildSecureUrl(publicId, resourceType, format),
          resource_type: resourceType,
          format,
          bytes,
          width: resourceType === "image" ? 1200 : 0,
          height: resourceType === "image" ? 800 : 0,
          duration: resourceType === "video" ? 42 : 0,
          folder,
        };

        uploads.push({ options: { ...options }, result });
        callback(null, result);
        done();
      },
    });
  });

  const destroy = jest.fn(async (publicId, options = {}) => ({
    result: publicId ? "ok" : "not found",
    publicId,
    options,
  }));

  const config = jest.fn();
  const cloudinary = {
    config,
    uploader: {
      upload_stream: uploadStream,
      destroy,
    },
    __uploads: uploads,
    __reset() {
      uploads.splice(0, uploads.length);
      uploadStream.mockClear();
      destroy.mockClear();
      config.mockClear();
    },
  };

  return { v2: cloudinary };
});

beforeEach(() => {
  const { v2: cloudinary } = require("cloudinary");
  cloudinary.__reset();
});
