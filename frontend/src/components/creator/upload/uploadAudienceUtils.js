const AUDIENCE_DESTINATION_COPY = {
  music: {
    pageLabel: "Public music page",
    description:
      "Published music lands on your public creator page where listeners can preview, stream, buy, or watch your releases.",
    actions: ["Preview", "Stream", "Buy", "Watch"],
  },
  bookPublishing: {
    pageLabel: "Public books page",
    description:
      "Published books appear on your public creator page where readers can preview, buy, download, and read them.",
    actions: ["Preview", "Buy", "Read", "Download"],
  },
  podcast: {
    pageLabel: "Public podcasts page",
    description:
      "Published podcast episodes land on your public creator page where listeners can preview, stream, or unlock them.",
    actions: ["Preview", "Stream", "Unlock"],
  },
};

export const buildCreatorAudiencePath = ({
  creatorProfileId = "",
  categoryKey = "music",
  previewItemId = "",
}) => {
  const creatorId = String(creatorProfileId || "").trim();
  if (!creatorId) {
    return "";
  }

  const suffix =
    categoryKey === "bookPublishing"
      ? "/books"
      : categoryKey === "podcast"
        ? "/podcasts"
        : "/music";

  const basePath = `/creators/${encodeURIComponent(creatorId)}${suffix}`;
  if (!previewItemId) {
    return basePath;
  }

  const params = new URLSearchParams({ previewItem: String(previewItemId || "") });
  return `${basePath}?${params.toString()}`;
};

export const buildReleaseDetailPath = ({ itemType = "", itemId = "", fallbackPath = "" }) => {
  const id = String(itemId || "").trim();
  if (!id) {
    return fallbackPath;
  }

  if (itemType === "album") {
    return `/albums/${encodeURIComponent(id)}`;
  }
  if (itemType === "book") {
    return `/books/${encodeURIComponent(id)}`;
  }
  if (itemType === "track" || itemType === "podcast") {
    return `/tracks/${encodeURIComponent(id)}`;
  }

  return fallbackPath;
};

export const getAudienceDestinationCopy = ({ categoryKey = "", itemType = "" } = {}) => {
  if (itemType === "book") {
    return AUDIENCE_DESTINATION_COPY.bookPublishing;
  }
  if (itemType === "podcast") {
    return AUDIENCE_DESTINATION_COPY.podcast;
  }
  if (itemType === "track" || itemType === "album" || itemType === "video") {
    return AUDIENCE_DESTINATION_COPY.music;
  }

  return AUDIENCE_DESTINATION_COPY[categoryKey] || AUDIENCE_DESTINATION_COPY.music;
};

export const buildUploadOutcome = ({
  creatorProfileId = "",
  categoryKey = "music",
  itemType = "",
  itemId = "",
  title = "",
  publishedStatus = "",
}) => {
  const normalizedStatus = String(publishedStatus || "").trim().toLowerCase() || "draft";
  const audienceCopy = getAudienceDestinationCopy({ categoryKey, itemType });
  const audiencePath = buildCreatorAudiencePath({
    creatorProfileId,
    categoryKey,
    previewItemId: normalizedStatus === "published" ? itemId : "",
  });

  return {
    title: String(title || "").trim() || "New release",
    itemType,
    itemId: String(itemId || "").trim(),
    categoryKey,
    publishedStatus: normalizedStatus,
    audiencePath,
    audiencePageLabel: audienceCopy.pageLabel,
    audienceDescription: audienceCopy.description,
    audienceActions: audienceCopy.actions,
    detailPath: buildReleaseDetailPath({
      itemType,
      itemId,
      fallbackPath: audiencePath,
    }),
  };
};
