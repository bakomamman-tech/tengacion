const {
  VOICEBRIDGE_AUDIO_MAX_BYTES,
  detectAudioContainer,
  validateCodeswitchAudioFile,
} = require("../middleware/codeswitchAudioUpload");

const wavBuffer = () => Buffer.from("RIFF0000WAVEvoicebridge");

describe("VoiceBridge in-memory audio validation", () => {
  test("accepts a WAV only when extension, MIME, and signature agree", () => {
    const file = {
      originalname: "authorized-sample.wav",
      mimetype: "audio/wav",
      size: wavBuffer().length,
      buffer: wavBuffer(),
    };

    expect(validateCodeswitchAudioFile(file)).toEqual({
      detectedContainer: "wav",
      extension: ".wav",
      mimeType: "audio/wav",
    });
    expect(detectAudioContainer(file.buffer)).toBe("wav");
  });

  test("does not trust a supported filename with mismatched content", () => {
    expect(() =>
      validateCodeswitchAudioFile({
        originalname: "not-really-audio.wav",
        mimetype: "audio/wav",
        size: 14,
        buffer: Buffer.from("plain text data"),
      })
    ).toThrow(/does not match/i);
  });

  test("rejects unsupported MIME and extension combinations", () => {
    expect(() =>
      validateCodeswitchAudioFile({
        originalname: "sample.txt",
        mimetype: "text/plain",
        size: wavBuffer().length,
        buffer: wavBuffer(),
      })
    ).toThrow(/unsupported audio format/i);
  });

  test("rejects files above the 25MB in-memory limit", () => {
    try {
      validateCodeswitchAudioFile({
        originalname: "large.wav",
        mimetype: "audio/wav",
        size: VOICEBRIDGE_AUDIO_MAX_BYTES + 1,
        buffer: wavBuffer(),
      });
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(error).toMatchObject({ statusCode: 413 });
      expect(error.message).toMatch(/25MB/i);
    }
  });
});
