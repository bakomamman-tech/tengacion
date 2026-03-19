export const DEFAULT_WELCOME_VOICE_ENABLED = true;
export const DEFAULT_WELCOME_VOICE_VOLUME = 0.22;
export const MIN_WELCOME_VOICE_VOLUME = 0;
export const MAX_WELCOME_VOICE_VOLUME = 0.45;

const PLAYED_KEY_PREFIX = "tengacion:welcome-voice:played:";
const FEMALE_LEANING_HINTS = [
  "female",
  "woman",
  "samantha",
  "zira",
  "aria",
  "ava",
  "allison",
  "jenny",
  "serena",
  "victoria",
  "susan",
  "joanna",
  "ivy",
  "salli",
  "natasha",
  "moira",
  "karen",
];
const PREMIUM_HINTS = ["natural", "premium", "enhanced", "neural", "studio", "wave"];

let activeUtterance = null;
let voicesPromise = null;
const playedCache = new Set();

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const clampWelcomeVoiceVolume = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_WELCOME_VOICE_VOLUME;
  }

  return Number(
    clamp(numeric, MIN_WELCOME_VOICE_VOLUME, MAX_WELCOME_VOICE_VOLUME).toFixed(2)
  );
};

export const normalizeWelcomeVoicePrefs = (value) => {
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

export const resolveOfficialRegisteredName = (user) =>
  String(user?.name || user?.displayName || "")
    .replace(/\s+/g, " ")
    .trim();

export const buildWelcomeVoiceText = (userOrName) => {
  const name =
    typeof userOrName === "string"
      ? String(userOrName || "").replace(/\s+/g, " ").trim()
      : resolveOfficialRegisteredName(userOrName);

  return name ? `Welcome to Tengacion, ${name}` : "Welcome to Tengacion";
};

export const getWelcomeVoicePlaybackKey = ({ userId = "", sessionId = "" } = {}) => {
  const safeUserId = String(userId || "").trim();
  if (!safeUserId) {
    return "";
  }

  const safeSessionId = String(sessionId || "default").trim() || "default";
  return `${safeUserId}:${safeSessionId}`;
};

export const hasPlayedWelcomeVoice = (playbackKey = "") => {
  const key = String(playbackKey || "").trim();
  if (!key) {
    return false;
  }

  if (playedCache.has(key)) {
    return true;
  }

  if (typeof window === "undefined") {
    return false;
  }

  try {
    const stored = sessionStorage.getItem(`${PLAYED_KEY_PREFIX}${key}`);
    if (stored === "1") {
      playedCache.add(key);
      return true;
    }
  } catch {
    // Ignore storage access issues.
  }

  return false;
};

export const markWelcomeVoicePlayed = (playbackKey = "") => {
  const key = String(playbackKey || "").trim();
  if (!key) {
    return;
  }

  playedCache.add(key);
  if (typeof window === "undefined") {
    return;
  }

  try {
    sessionStorage.setItem(`${PLAYED_KEY_PREFIX}${key}`, "1");
  } catch {
    // Ignore storage access issues.
  }
};

export const supportsSpeechSynthesis = () =>
  typeof window !== "undefined" &&
  typeof window.speechSynthesis !== "undefined" &&
  typeof window.SpeechSynthesisUtterance !== "undefined";

const getVoices = () => {
  if (!supportsSpeechSynthesis()) {
    return [];
  }

  try {
    return window.speechSynthesis.getVoices().filter(Boolean);
  } catch {
    return [];
  }
};

export const pickAmbientVoice = (voices = []) => {
  const candidates = Array.isArray(voices) ? voices.filter(Boolean) : [];
  if (!candidates.length) {
    return null;
  }

  const scored = candidates
    .map((voice) => {
      const searchable = `${voice?.name || ""} ${voice?.voiceURI || ""}`.toLowerCase();
      const lang = String(voice?.lang || "").toLowerCase();
      let score = 0;

      if (lang === "en-us") {
        score += 40;
      } else if (lang.startsWith("en-")) {
        score += 26;
      } else if (lang.startsWith("en")) {
        score += 18;
      }

      if (voice?.localService) {
        score += 12;
      }
      if (voice?.default) {
        score += 4;
      }

      if (FEMALE_LEANING_HINTS.some((hint) => searchable.includes(hint))) {
        score += 24;
      }
      if (PREMIUM_HINTS.some((hint) => searchable.includes(hint))) {
        score += 10;
      }
      if (searchable.includes("male")) {
        score -= 6;
      }

      return { voice, score };
    })
    .sort((left, right) => right.score - left.score);

  return scored[0]?.voice || candidates[0] || null;
};

export const waitForWelcomeVoices = (timeoutMs = 1200) => {
  if (!supportsSpeechSynthesis()) {
    return Promise.resolve([]);
  }

  const existing = getVoices();
  if (existing.length > 0) {
    return Promise.resolve(existing);
  }

  if (voicesPromise) {
    return voicesPromise;
  }

  voicesPromise = new Promise((resolve) => {
    const synth = window.speechSynthesis;
    let finished = false;

    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      window.clearTimeout(timer);
      if (typeof synth.removeEventListener === "function") {
        synth.removeEventListener("voiceschanged", handleVoicesChanged);
      }
      resolve(getVoices());
    };

    const handleVoicesChanged = () => finish();
    const timer = window.setTimeout(finish, timeoutMs);

    if (typeof synth.addEventListener === "function") {
      synth.addEventListener("voiceschanged", handleVoicesChanged);
    }
  }).finally(() => {
    voicesPromise = null;
  });

  return voicesPromise;
};

export const cancelAmbientWelcome = () => {
  if (!supportsSpeechSynthesis()) {
    return;
  }

  activeUtterance = null;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore synthesis cancellation issues.
  }
};

export const speakAmbientWelcome = async ({
  text = "",
  volume = DEFAULT_WELCOME_VOICE_VOLUME,
} = {}) => {
  const spokenText = String(text || "").trim();
  if (!spokenText) {
    return { ok: false, reason: "missing_text" };
  }

  if (!supportsSpeechSynthesis()) {
    return { ok: false, reason: "unsupported" };
  }

  const voices = await waitForWelcomeVoices();
  const selectedVoice = pickAmbientVoice(voices);
  const synth = window.speechSynthesis;

  cancelAmbientWelcome();

  const utterance = new window.SpeechSynthesisUtterance(spokenText);
  activeUtterance = utterance;
  utterance.volume = clampWelcomeVoiceVolume(volume);
  utterance.rate = 0.9;
  utterance.pitch = 1.02;
  utterance.lang = selectedVoice?.lang || "en-US";
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  return new Promise((resolve) => {
    let settled = false;

    const settle = (payload) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({
        voiceName: selectedVoice?.name || "",
        ...payload,
      });
    };

    const clearCurrentUtterance = () => {
      if (activeUtterance === utterance) {
        activeUtterance = null;
      }
    };

    const timeout = window.setTimeout(() => {
      clearCurrentUtterance();
      try {
        synth.cancel();
      } catch {
        // Ignore cancellation issues.
      }
      settle({ ok: false, reason: "blocked_or_timeout" });
    }, 1400);

    utterance.onstart = () => {
      window.clearTimeout(timeout);
      settle({ ok: true, started: true });
    };

    utterance.onerror = (event) => {
      window.clearTimeout(timeout);
      clearCurrentUtterance();
      settle({ ok: false, reason: event?.error || "synthesis_error" });
    };

    utterance.onend = () => {
      window.clearTimeout(timeout);
      clearCurrentUtterance();
      if (!settled) {
        settle({ ok: true, started: false, ended: true });
      }
    };

    try {
      synth.speak(utterance);
    } catch (error) {
      window.clearTimeout(timeout);
      clearCurrentUtterance();
      settle({ ok: false, reason: error?.message || "speak_failed" });
    }
  });
};
