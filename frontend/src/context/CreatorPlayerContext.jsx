import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { savePlayerProgress } from "../api";

const SESSION_KEY = "creator_hub_player_state_v1";

const CreatorPlayerContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useCreatorPlayer = () => useContext(CreatorPlayerContext);

export function CreatorPlayerProvider({ children }) {
  const audioRef = useRef(null);
  const lastSavedRef = useRef(0);

  const [currentItem, setCurrentItem] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueOpen, setQueueOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [unlockRequired, setUnlockRequired] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) {return;}
      const parsed = JSON.parse(raw);
      if (parsed?.currentItem) {setCurrentItem(parsed.currentItem);}
      if (Array.isArray(parsed?.queue)) {setQueue(parsed.queue);}
      if (Number.isFinite(parsed?.currentIndex)) {setCurrentIndex(parsed.currentIndex);}
      if (Number.isFinite(parsed?.volume)) {setVolume(Math.max(0, Math.min(1, parsed.volume)));}
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ currentItem, queue, currentIndex, volume })
      );
    } catch {
      // ignore
    }
  }, [currentItem, queue, currentIndex, volume]);

  const persistProgress = useCallback(
    async (force = false) => {
      if (!currentItem?.id || !["song", "podcast"].includes(currentItem.type)) {return;}
      const now = Date.now();
      if (!force && now - lastSavedRef.current < 12000) {return;}
      lastSavedRef.current = now;
      try {
        await savePlayerProgress({
          itemType: currentItem.type,
          itemId: currentItem.id,
          creatorId: currentItem.creatorId,
          positionSec: Math.floor(position || 0),
          durationSec: Math.floor(duration || currentItem.durationSec || 0),
        });
      } catch {
        // ignore transient progress write errors
      }
    },
    [currentItem, duration, position]
  );

  const loadAndPlay = useCallback(async (item) => {
    const audio = audioRef.current;
    if (!audio || !item?.streamUrl) {return;}

    setUnlockRequired(false);
    if (audio.src !== item.streamUrl) {
      audio.src = item.streamUrl;
      audio.currentTime = 0;
    }
    await audio.play();
  }, []);

  const playItem = useCallback(
    async (item, nextQueue = null) => {
      if (!item?.streamUrl) {return;}
      if (Array.isArray(nextQueue)) {
        setQueue(nextQueue);
        const idx = Math.max(0, nextQueue.findIndex((entry) => entry.id === item.id));
        setCurrentIndex(idx < 0 ? 0 : idx);
      }
      setCurrentItem(item);
      await loadAndPlay(item);
    },
    [loadAndPlay]
  );

  const playByIndex = useCallback(
    async (idx) => {
      if (!Array.isArray(queue) || idx < 0 || idx >= queue.length) {return;}
      const item = queue[idx];
      setCurrentIndex(idx);
      setCurrentItem(item);
      await loadAndPlay(item);
    },
    [loadAndPlay, queue]
  );

  const playNext = useCallback(async () => {
    if (!queue.length) {return;}
    const next = currentIndex + 1;
    if (next >= queue.length) {
      setIsPlaying(false);
      return;
    }
    await playByIndex(next);
  }, [currentIndex, playByIndex, queue.length]);

  const playPrev = useCallback(async () => {
    if (!queue.length) {return;}
    const prev = currentIndex - 1;
    if (prev < 0) {return;}
    await playByIndex(prev);
  }, [currentIndex, playByIndex, queue.length]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) {return;}
    if (audio.paused) {
      await audio.play();
      return;
    }
    audio.pause();
  }, []);

  const seekTo = useCallback((nextPosition) => {
    const audio = audioRef.current;
    if (!audio) {return;}
    audio.currentTime = Math.max(0, Number(nextPosition) || 0);
  }, []);

  const moveQueueItem = useCallback((from, to) => {
    setQueue((prev) => {
      if (from < 0 || to < 0 || from >= prev.length || to >= prev.length) {return prev;}
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setCurrentIndex((prev) => {
      if (prev === from) {return to;}
      if (from < prev && to >= prev) {return prev - 1;}
      if (from > prev && to <= prev) {return prev + 1;}
      return prev;
    });
  }, []);

  const removeQueueItem = useCallback((index) => {
    setQueue((prev) => prev.filter((_, idx) => idx !== index));
    setCurrentIndex((prev) => {
      if (index < prev) {return prev - 1;}
      if (index === prev) {return Math.max(0, prev - 1);}
      return prev;
    });
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.volume = volume;
    audioRef.current = audio;

    const onTime = () => {
      const currentTime = Number(audio.currentTime || 0);
      setPosition(currentTime);
      persistProgress(false);
      const previewLimitSec = Number(currentItem?.previewLimitSec || 0);
      if (previewLimitSec > 0 && currentItem?.lockedPreview && currentTime >= previewLimitSec) {
        audio.pause();
        setUnlockRequired(true);
      }
    };
    const onLoaded = () => setDuration(Number(audio.duration || 0));
    const onPlay = () => setIsPlaying(true);
    const onPause = () => {
      setIsPlaying(false);
      persistProgress(true);
    };
    const onEnded = () => {
      setIsPlaying(false);
      persistProgress(true);
      playNext();
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      persistProgress(true);
      audio.pause();
      audio.src = "";
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [currentItem?.lockedPreview, currentItem?.previewLimitSec, persistProgress, playNext, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {return;}
    audio.volume = volume;
  }, [volume]);

  const value = useMemo(
    () => ({
      currentItem,
      queue,
      currentIndex,
      queueOpen,
      isPlaying,
      position,
      duration,
      volume,
      unlockRequired,
      setUnlockRequired,
      setVolume,
      setQueueOpen,
      playItem,
      playByIndex,
      playNext,
      playPrev,
      togglePlay,
      seekTo,
      moveQueueItem,
      removeQueueItem,
      setQueue,
      setCurrentItem,
      setCurrentIndex,
    }),
    [
      currentItem,
      queue,
      currentIndex,
      queueOpen,
      isPlaying,
      position,
      duration,
      volume,
      unlockRequired,
      playItem,
      playByIndex,
      playNext,
      playPrev,
      togglePlay,
      seekTo,
      moveQueueItem,
      removeQueueItem,
    ]
  );

  return <CreatorPlayerContext.Provider value={value}>{children}</CreatorPlayerContext.Provider>;
}
