const {
  classifyRecordMedia,
  inspectMediaField,
  isCloudinaryMedia,
  isLegacyLocalMedia,
} = require("../services/mediaAuditService");

describe("mediaAuditService", () => {
  test("detects cloudinary-backed media values", () => {
    const value = {
      publicId: "tengacion/profiles/avatar-1",
      secureUrl: "https://res.cloudinary.com/demo/image/upload/v1/tengacion/profiles/avatar-1.jpg",
      provider: "cloudinary",
    };

    expect(isCloudinaryMedia(value)).toBe(true);
    expect(inspectMediaField(value, "avatar")).toMatchObject({
      status: "cloudinary",
      field: "avatar",
    });
  });

  test("detects legacy local media strings", () => {
    expect(isLegacyLocalMedia("/uploads/legacy/avatar.jpg")).toBe(true);
    expect(inspectMediaField("/uploads/legacy/avatar.jpg", "avatar")).toMatchObject({
      status: "legacyLocal",
      field: "avatar",
    });
  });

  test("marks mixed object states when cloudinary and legacy markers coexist", () => {
    const mixed = inspectMediaField(
      {
        publicId: "tengacion/posts/images/post-1",
        secureUrl: "https://res.cloudinary.com/demo/image/upload/v1/tengacion/posts/images/post-1.jpg",
        legacyPath: "/uploads/posts/post-1.jpg",
      },
      "media[0]"
    );

    expect(mixed).toMatchObject({
      status: "mixed",
      field: "media[0]",
    });
  });

  test("classifies record media with nested arrays safely", () => {
    const source = {
      model: { modelName: "Post" },
      extract(doc) {
        return [
          { field: "media", value: doc.media },
          { field: "video", value: doc.video },
        ];
      },
    };

    const record = classifyRecordMedia(
      {
        _id: "post-1",
        media: [
          "/uploads/legacy/cover.jpg",
          {
            publicId: "tengacion/posts/images/post-1",
            secureUrl: "https://res.cloudinary.com/demo/image/upload/v1/tengacion/posts/images/post-1.jpg",
          },
        ],
        video: null,
      },
      source
    );

    expect(record.status).toBe("mixed");
    expect(record.legacyFields).toEqual(expect.arrayContaining(["media[0]"]));
    expect(record.cloudinaryFields).toEqual(expect.arrayContaining(["media[1]"]));
  });

  test("treats malformed media-shaped values as unknown instead of crashing", () => {
    const inspected = inspectMediaField(
      {
        attachments: [{ provider: "mystery-cdn", url: "blob:preview-asset" }],
      },
      "attachments"
    );

    expect(inspected.status).toBe("unknown");
  });
});
