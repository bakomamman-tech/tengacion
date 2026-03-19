import {
  buildWelcomeVoiceText,
  getWelcomeVoicePlaybackKey,
  markWelcomeVoicePlayed,
  hasPlayedWelcomeVoice,
  normalizeWelcomeVoicePrefs,
  pickAmbientVoice,
} from "../welcomeVoice";

describe("welcomeVoice service", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("normalizes default welcome voice preferences", () => {
    expect(normalizeWelcomeVoicePrefs()).toEqual({
      welcomeVoiceEnabled: true,
      welcomeVoiceVolume: 0.22,
    });
  });

  it("clamps welcome voice volume into the supported ambient range", () => {
    expect(
      normalizeWelcomeVoicePrefs({
        welcomeVoiceEnabled: false,
        welcomeVoiceVolume: 1,
      })
    ).toEqual({
      welcomeVoiceEnabled: false,
      welcomeVoiceVolume: 0.45,
    });
  });

  it("builds the spoken line from the official registered name and falls back cleanly", () => {
    expect(buildWelcomeVoiceText({ name: "  Ada   Lovelace " })).toBe(
      "Welcome to Tengacion, Ada Lovelace"
    );
    expect(buildWelcomeVoiceText({})).toBe("Welcome to Tengacion");
  });

  it("remembers when the welcome voice has already played for a session", () => {
    const playbackKey = getWelcomeVoicePlaybackKey({
      userId: "user-1",
      sessionId: "session-1",
    });

    expect(hasPlayedWelcomeVoice(playbackKey)).toBe(false);
    markWelcomeVoicePlayed(playbackKey);
    expect(hasPlayedWelcomeVoice(playbackKey)).toBe(true);
  });

  it("prefers a feminine-leaning English voice when one is available", () => {
    const selected = pickAmbientVoice([
      { name: "Google UK English Male", voiceURI: "male", lang: "en-GB" },
      { name: "Microsoft Aria Online (Natural)", voiceURI: "aria", lang: "en-US" },
      { name: "Deutsch", voiceURI: "de", lang: "de-DE" },
    ]);

    expect(selected?.name).toBe("Microsoft Aria Online (Natural)");
  });
});
