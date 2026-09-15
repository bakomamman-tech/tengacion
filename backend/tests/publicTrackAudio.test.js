const {buildPublicTrackAudio} = require("../services/publicTrackAudioService");
const full = "https://media.example/full.mp3";
const preview = "https://media.example/preview.mp3";
test.each([
  [2500, preview, preview],
  [2500, "", ""],
  [2500, full, ""],
  [0, "", full],
  [undefined, "", ""],
])("public feed projection for price %s and preview %s", (price, previewUrl, expected) => {
  const audio = buildPublicTrackAudio({_id: "track-1", price, audioUrl: full, previewUrl});
  expect(audio.url).toBe(expected);
  if (price !== 0) expect(JSON.stringify(audio)).not.toContain(full);
});
