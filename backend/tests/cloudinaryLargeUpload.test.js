const { v2: cloudinary } = require("cloudinary");
const { uploadFileToCloudinary } = require("../services/cloudinaryMediaService");

const video = (size) => ({
  originalname: "clip.mp4",
  mimetype: "video/mp4",
  buffer: Buffer.from("small test payload"),
  size,
});

describe("Cloudinary video upload transport", () => {
  test("uses the regular stream for videos at 100MB", async () => {
    const result = await uploadFileToCloudinary(video(100 * 1024 * 1024), {
      source: "creator_video",
    });
    expect(result.url).toContain("cloudinary.com");
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(1);
    expect(cloudinary.uploader.upload_chunked_stream).not.toHaveBeenCalled();
  });

  test("uses chunked streaming for videos larger than 100MB", async () => {
    const result = await uploadFileToCloudinary(video(200 * 1024 * 1024), {
      source: "creator_video",
    });
    expect(result.url).toContain("cloudinary.com");
    expect(cloudinary.uploader.upload_chunked_stream).toHaveBeenCalledWith(
      expect.objectContaining({
        resource_type: "video",
        chunk_size: 20 * 1024 * 1024,
      }),
      expect.any(Function)
    );
  });
});
