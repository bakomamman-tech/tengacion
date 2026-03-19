import { useEffect, useEffectEvent, useRef, useState } from "react";

import {
  cancelAmbientWelcome,
  buildWelcomeVoiceText,
  getWelcomeVoicePlaybackKey,
  hasPlayedWelcomeVoice,
  markWelcomeVoicePlayed,
  normalizeWelcomeVoicePrefs,
  speakAmbientWelcome,
} from "../services/welcomeVoice";

export default function useAmbientWelcomeVoice({ user, active = true }) {
  const [pendingInteraction, setPendingInteraction] = useState(false);
  const inFlightKeyRef = useRef("");

  const prefs = normalizeWelcomeVoicePrefs(user?.audioPrefs);
  const playbackKey = getWelcomeVoicePlaybackKey({
    userId: user?._id || user?.id,
    sessionId: user?.activeSessionId,
  });
  const welcomeText = buildWelcomeVoiceText(user);
  const canPlay =
    Boolean(active) &&
    Boolean(playbackKey) &&
    Boolean(welcomeText) &&
    Boolean(prefs.welcomeVoiceEnabled);

  const attemptPlayback = useEffectEvent(async () => {
    if (!canPlay || hasPlayedWelcomeVoice(playbackKey)) {
      setPendingInteraction(false);
      return;
    }

    if (inFlightKeyRef.current === playbackKey) {
      return;
    }

    inFlightKeyRef.current = playbackKey;
    const result = await speakAmbientWelcome({
      text: welcomeText,
      volume: prefs.welcomeVoiceVolume,
    });

    if (result?.ok && result.started) {
      markWelcomeVoicePlayed(playbackKey);
      setPendingInteraction(false);
    } else if (result?.reason === "blocked_or_timeout") {
      setPendingInteraction(true);
    } else {
      setPendingInteraction(false);
    }

    if (inFlightKeyRef.current === playbackKey) {
      inFlightKeyRef.current = "";
    }
  });

  useEffect(() => {
    if (!prefs.welcomeVoiceEnabled) {
      setPendingInteraction(false);
      cancelAmbientWelcome();
    }
  }, [prefs.welcomeVoiceEnabled]);

  useEffect(() => {
    inFlightKeyRef.current = "";
  }, [playbackKey]);

  useEffect(() => {
    if (!canPlay) {
      setPendingInteraction(false);
      return;
    }

    if (hasPlayedWelcomeVoice(playbackKey)) {
      setPendingInteraction(false);
      return;
    }

    attemptPlayback();
  }, [attemptPlayback, canPlay, playbackKey, prefs.welcomeVoiceVolume, welcomeText]);

  useEffect(() => {
    if (!pendingInteraction || !canPlay || hasPlayedWelcomeVoice(playbackKey)) {
      return;
    }

    const retryPlayback = () => {
      attemptPlayback();
    };

    window.addEventListener("pointerdown", retryPlayback, { passive: true });
    window.addEventListener("keydown", retryPlayback);
    window.addEventListener("touchstart", retryPlayback, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", retryPlayback);
      window.removeEventListener("keydown", retryPlayback);
      window.removeEventListener("touchstart", retryPlayback);
    };
  }, [attemptPlayback, canPlay, pendingInteraction, playbackKey]);

  return {
    pendingInteraction,
  };
}
