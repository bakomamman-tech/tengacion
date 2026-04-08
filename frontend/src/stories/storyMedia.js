import { resolveImage } from "../api";

const VIDEO_URL_PATTERN = /\.(mp4|webm|ogg|mov|m4v|avi|mkv)(?:$|[?#])/i;

export const getStoryMedia = (story = {}) => {
  const media = story?.media || {};
  const blurPreviewUrl = resolveImage(
    story?.blurPreviewUrl || media?.restrictedPreviewUrl || ""
  );
  const baseMediaUrl = resolveImage(
    story?.mediaUrl
      || story?.image
      || media?.secureUrl
      || media?.secure_url
      || media?.url
      || ""
  );
  const rawMediaType = String(story?.mediaType || media?.type || "").trim().toLowerCase();
  const mediaType = rawMediaType || (VIDEO_URL_PATTERN.test(baseMediaUrl) ? "video" : "image");
  const baseThumbnailUrl = resolveImage(
    story?.thumbnailUrl
      || media?.previewUrl
      || media?.thumbnailUrl
      || (mediaType === "image" ? baseMediaUrl : "")
  );
  const shouldUseBlurPreview =
    String(story?.moderationStatus || "").trim() === "RESTRICTED_BLURRED" && blurPreviewUrl;

  return {
    blurPreviewUrl,
    mediaType,
    mediaUrl: shouldUseBlurPreview ? blurPreviewUrl : baseMediaUrl,
    thumbnailUrl: shouldUseBlurPreview ? blurPreviewUrl : baseThumbnailUrl,
  };
};
