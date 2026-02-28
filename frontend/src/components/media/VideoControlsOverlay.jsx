import { useEffect, useMemo, useState } from "react";
import styles from "./VideoPlayer.module.css";

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

const formatTime = (value) => {
  const total = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

export default function VideoControlsOverlay({
  videoRef,
  wrapperRef,
  isPlaying,
  setIsPlaying,
  isMuted,
  setIsMuted,
  disableAutoplay,
}) {
  const [visible, setVisible] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [captionsVisible, setCaptionsVisible] = useState(false);
  const [hasCaptions, setHasCaptions] = useState(false);
  const [pipAvailable, setPipAvailable] = useState(false);
  const [inPip, setInPip] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return undefined;
    }

    const onLoadedMeta = () => {
      setDuration(video.duration || 0);
      setVolume(Number.isFinite(video.volume) ? video.volume : 1);
      const tracks = video.textTracks;
      setHasCaptions(Boolean(tracks && tracks.length > 0));
      setCaptionsVisible(
        Boolean(
          tracks &&
            Array.from({ length: tracks.length }).some(
              (_, index) => tracks[index].mode === "showing"
            )
        )
      );
    };

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime || 0);
      try {
        const buf = video.buffered;
        if (buf && buf.length > 0) {
          setBufferedEnd(buf.end(buf.length - 1));
        }
      } catch {
        setBufferedEnd(0);
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onVolumeChange = () => {
      setVolume(Number.isFinite(video.volume) ? video.volume : 1);
      setIsMuted(Boolean(video.muted));
    };
    const onRateChange = () => {
      setPlaybackRate(Number.isFinite(video.playbackRate) ? video.playbackRate : 1);
    };
    const onEnterPiP = () => setInPip(true);
    const onLeavePiP = () => setInPip(false);

    setPipAvailable(
      Boolean(
        document.pictureInPictureEnabled &&
          typeof video.requestPictureInPicture === "function"
      )
    );

    video.addEventListener("loadedmetadata", onLoadedMeta);
    video.addEventListener("durationchange", onLoadedMeta);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("progress", onTimeUpdate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("volumechange", onVolumeChange);
    video.addEventListener("ratechange", onRateChange);
    video.addEventListener("enterpictureinpicture", onEnterPiP);
    video.addEventListener("leavepictureinpicture", onLeavePiP);

    onLoadedMeta();
    onTimeUpdate();

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMeta);
      video.removeEventListener("durationchange", onLoadedMeta);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("progress", onTimeUpdate);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("volumechange", onVolumeChange);
      video.removeEventListener("ratechange", onRateChange);
      video.removeEventListener("enterpictureinpicture", onEnterPiP);
      video.removeEventListener("leavepictureinpicture", onLeavePiP);
    };
  }, [setIsMuted, setIsPlaying, videoRef]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return undefined;
    }

    let hideTimer = null;
    const ping = () => {
      setVisible(true);
      if (hideTimer) {
        window.clearTimeout(hideTimer);
      }
      if (isPlaying && !showSettings) {
        hideTimer = window.setTimeout(() => setVisible(false), 2500);
      }
    };

    wrapper.addEventListener("mousemove", ping);
    wrapper.addEventListener("mouseenter", ping);
    wrapper.addEventListener("touchstart", ping, { passive: true });
    wrapper.addEventListener("click", ping);
    ping();

    return () => {
      wrapper.removeEventListener("mousemove", ping);
      wrapper.removeEventListener("mouseenter", ping);
      wrapper.removeEventListener("touchstart", ping);
      wrapper.removeEventListener("click", ping);
      if (hideTimer) {
        window.clearTimeout(hideTimer);
      }
    };
  }, [isPlaying, showSettings, wrapperRef]);

  const progressPct = useMemo(() => {
    if (!duration) return 0;
    return Math.min(100, (currentTime / duration) * 100);
  }, [currentTime, duration]);

  const bufferedPct = useMemo(() => {
    if (!duration) return 0;
    return Math.min(100, (bufferedEnd / duration) * 100);
  }, [bufferedEnd, duration]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const seekTo = (nextTime) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(nextTime)) return;
    video.currentTime = Math.min(Math.max(nextTime, 0), duration || 0);
  };

  const onSeekChange = (event) => {
    const next = Number(event.target.value);
    seekTo(next);
  };

  const onVolumeChange = (event) => {
    const next = Number(event.target.value);
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.min(Math.max(next, 0), 1);
    if (video.volume > 0 && video.muted) {
      video.muted = false;
      setIsMuted(false);
    }
  };

  const toggleCaptions = () => {
    const video = videoRef.current;
    if (!video || !video.textTracks || !video.textTracks.length) return;
    const nextState = !captionsVisible;
    for (let i = 0; i < video.textTracks.length; i += 1) {
      video.textTracks[i].mode = nextState ? "showing" : "hidden";
    }
    setCaptionsVisible(nextState);
  };

  const applyPlaybackRate = (rate) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      return;
    }
    if (video.requestFullscreen) {
      video.requestFullscreen().catch(() => {});
    } else if (video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    }
  };

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video || !pipAvailable) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      // ignore unsupported runtime failures
    }
  };

  return (
    <div
      className={`${styles.overlay} ${visible || !isPlaying ? styles.visible : ""}`}
      aria-hidden={visible || !isPlaying ? "false" : "true"}
    >
      <div className={styles.gradient} />
      <div className={styles.controls}>
        <div className={styles.progressWrap}>
          <input
            type="range"
            min={0}
            max={Math.max(duration, 0)}
            step="0.01"
            value={Math.min(currentTime, duration || 0)}
            className={styles.progress}
            onChange={onSeekChange}
            aria-label="Seek"
          />
          <div className={styles.progressRail}>
            <span className={styles.buffered} style={{ width: `${bufferedPct}%` }} />
            <span className={styles.played} style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.cluster}>
            <button type="button" className={styles.iconBtn} onClick={togglePlayPause} aria-label={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? "❚❚" : "▶"}
            </button>
            <button type="button" className={styles.iconBtn} onClick={toggleMute} aria-label={isMuted ? "Unmute" : "Mute"}>
              {isMuted ? "🔇" : "🔊"}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={onVolumeChange}
              className={styles.volume}
              aria-label="Volume"
            />
          </div>

          <div className={styles.time}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          <div className={styles.cluster}>
            {hasCaptions && (
              <button type="button" className={styles.iconBtn} onClick={toggleCaptions} aria-label="Toggle captions">
                CC
              </button>
            )}
            <div className={styles.settingsWrap}>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setShowSettings((prev) => !prev)}
                aria-label="Settings"
              >
                ⚙
              </button>
              {showSettings && (
                <div className={styles.settingsMenu}>
                  <p>Speed</p>
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      className={`${styles.settingItem} ${playbackRate === rate ? styles.active : ""}`}
                      onClick={() => applyPlaybackRate(rate)}
                    >
                      {rate}x
                    </button>
                  ))}
                  <p className={styles.settingsHint}>Quality: Auto</p>
                </div>
              )}
            </div>
            {pipAvailable && !disableAutoplay && (
              <button type="button" className={styles.iconBtn} onClick={togglePiP} aria-label="Picture in picture">
                {inPip ? "⧉" : "▣"}
              </button>
            )}
            <button type="button" className={styles.iconBtn} onClick={toggleFullscreen} aria-label="Fullscreen">
              ⛶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
