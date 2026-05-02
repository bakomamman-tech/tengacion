const {
  sanitizeMultilineText,
  sanitizePlainText,
} = require("./assistant/outputSanitizer");
const { transcribeAudioAttachment } = require("./akusoOpenAIService");
const {
  classifyAkusoFile,
  flattenFiles,
} = require("../middleware/akusoMediaUpload");

const toText = (value) => String(value || "").trim();

const buildDataUrl = (file = {}) =>
  `data:${toText(file.mimetype).toLowerCase()};base64,${file.buffer.toString("base64")}`;

const describeFile = (file = {}, type = "file") => ({
  type,
  name: sanitizePlainText(file.originalname || type, 120),
  mimeType: sanitizePlainText(file.mimetype || "", 80),
  size: Number(file.size || 0),
});

const buildDefaultPrompt = ({ imageCount = 0, audioCount = 0 } = {}) => {
  if (imageCount > 0 && audioCount > 0) {
    return "Please assess the attached image and reply to the voice message.";
  }
  if (imageCount > 0) {
    return "Please assess the attached image.";
  }
  if (audioCount > 0) {
    return "Please reply to this voice message.";
  }
  return "";
};

const buildMediaInstructionBlock = ({ images = [], audio = [], transcripts = [] } = {}) => {
  const lines = [];
  if (images.length > 0) {
    lines.push(
      `Attached images: ${images.length}. Assess only what is visible in the image, including composition, text, quality, likely context, and any user-requested improvements. Do not invent unseen details.`
    );
    images.forEach((image, index) => {
      lines.push(
        `Image ${index + 1}: ${image.name || "image"} (${image.mimeType || "image"}, ${image.size || 0} bytes).`
      );
    });
  }

  if (audio.length > 0) {
    const transcriptText = transcripts
      .map((entry) => sanitizeMultilineText(entry, 2400))
      .filter(Boolean)
      .join("\n\n");
    lines.push(
      transcriptText
        ? `Voice transcript:\n${transcriptText}`
        : "Voice transcript: unavailable. Ask the user to retry or type the voice message if the reply needs exact words."
    );
  }

  return lines.join("\n");
};

const prepareAkusoMediaInput = async ({ req, input = {} } = {}) => {
  const files = flattenFiles(req?.files);
  if (files.length === 0) {
    return {
      input,
      hasMedia: false,
      imageInputs: [],
      warnings: [],
      media: {
        images: [],
        audio: [],
        transcripts: [],
      },
    };
  }

  const images = [];
  const audio = [];
  const warnings = [];

  files.forEach((file) => {
    const classification = classifyAkusoFile(file);
    if (classification?.type === "image") {
      images.push({
        ...describeFile(file, "image"),
        dataUrl: buildDataUrl(file),
      });
    } else if (classification?.type === "audio") {
      audio.push({
        file,
        ...describeFile(file, "audio"),
      });
    }
  });

  const transcripts = [];
  for (const voice of audio) {
    try {
      const transcript = await transcribeAudioAttachment({ file: voice.file });
      if (transcript) {
        transcripts.push(transcript);
      } else {
        warnings.push("Voice transcription needs Akuso's model layer to be configured.");
      }
    } catch {
      warnings.push("Akuso could not transcribe the voice message, so it used the available text and media context.");
    }
  }

  const baseMessage = toText(input.message);
  const mediaBlock = buildMediaInstructionBlock({
    images: images.map(({ dataUrl, ...image }) => image),
    audio: audio.map(({ file, ...voice }) => voice),
    transcripts,
  });
  const message = [baseMessage || buildDefaultPrompt({
    imageCount: images.length,
    audioCount: audio.length,
  }), mediaBlock]
    .filter(Boolean)
    .join("\n\n");

  const media = {
    images: images.map(({ dataUrl, ...image }) => image),
    audio: audio.map(({ file, ...voice }) => voice),
    transcripts,
  };

  return {
    input: {
      ...input,
      message,
      media,
    },
    hasMedia: true,
    imageInputs: images.map((image) => ({
      dataUrl: image.dataUrl,
      detail: "auto",
    })),
    warnings,
    media,
  };
};

module.exports = {
  prepareAkusoMediaInput,
};
