const DEFAULT_WELCOME_VOICE_ENABLED = true;
const DEFAULT_WELCOME_VOICE_VOLUME = 0.22;
const MIN_WELCOME_VOICE_VOLUME = 0;
const MAX_WELCOME_VOICE_VOLUME = 0.45;

const clampWelcomeVoiceVolume = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_WELCOME_VOICE_VOLUME;
  }

  return Math.min(
    MAX_WELCOME_VOICE_VOLUME,
    Math.max(MIN_WELCOME_VOICE_VOLUME, Number(numeric.toFixed(2)))
  );
};

const normalizeAudioPrefs = (value) => {
  const source =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};

  return {
    welcomeVoiceEnabled:
      typeof source.welcomeVoiceEnabled === "boolean"
        ? source.welcomeVoiceEnabled
        : DEFAULT_WELCOME_VOICE_ENABLED,
    welcomeVoiceVolume: clampWelcomeVoiceVolume(source.welcomeVoiceVolume),
  };
};

module.exports = {
  DEFAULT_WELCOME_VOICE_ENABLED,
  DEFAULT_WELCOME_VOICE_VOLUME,
  MIN_WELCOME_VOICE_VOLUME,
  MAX_WELCOME_VOICE_VOLUME,
  clampWelcomeVoiceVolume,
  normalizeAudioPrefs,
};
