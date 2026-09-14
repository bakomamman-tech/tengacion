import { forwardRef, useImperativeHandle, useRef, useState } from "react";

const formatTime = (value) => {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
};

// Downloads belong to the purchase-checked action, never the browser media menu.
const ProtectedAudioPlayer = forwardRef(function ProtectedAudioPlayer(
  { className = "", controls: _controls, controlsList: _controlsList, onPlay, onPause,
    onEnded, onTimeUpdate, onLoadedMetadata, onDurationChange, onError, ...props }, ref
) {
  const audioRef = useRef(null);
  useImperativeHandle(ref, () => audioRef.current);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [error, setError] = useState("");
  const sync = () => {
    const audio = audioRef.current;
    setPlaying(Boolean(audio && !audio.paused && !audio.ended));
    setDuration(Number.isFinite(audio?.duration) ? audio.duration : 0);
    setPosition(audio?.currentTime || 0);
  };
  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) { return; }
    setError("");
    if (!audio.paused) { audio.pause(); return; }
    try { await audio.play(); } catch { setError("Audio could not play. Please try again."); }
  };
  return (
    <div className={className}>
      <audio {...props} ref={audioRef} controls={false} controlsList="nodownload noplaybackrate"
        onContextMenu={(event) => event.preventDefault()}
        onEmptied={() => { sync(); setError(""); }}
        onPlay={(event) => { onPlay?.(event); sync(); }}
        onPause={(event) => { onPause?.(event); sync(); }}
        onEnded={(event) => { onEnded?.(event); sync(); }}
        onLoadedMetadata={(event) => { onLoadedMetadata?.(event); sync(); }}
        onDurationChange={(event) => { onDurationChange?.(event); sync(); }}
        onTimeUpdate={(event) => { onTimeUpdate?.(event); sync(); }}
        onError={(event) => { onError?.(event); setError("Audio is unavailable. Please try again."); sync(); }}
      />
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-100 p-3 text-slate-900" role="group" aria-label="Audio playback">
        <button type="button" onClick={toggle} disabled={!props.src}
          className="rounded-lg bg-slate-900 px-4 py-2 text-white" aria-label={playing ? "Pause audio" : "Play audio"}>
          {playing ? "Pause" : "Play"}
        </button>
        <input type="range" aria-label="Audio position" min="0" max={duration || 0} step="0.1"
          value={Math.min(position, duration)} disabled={!duration} className="min-w-20 flex-1"
          onChange={(event) => { audioRef.current.currentTime = Number(event.target.value); sync(); }} />
        <span className="text-xs tabular-nums">{formatTime(position)} / {formatTime(duration)}</span>
        <input type="range" aria-label="Audio volume" min="0" max="1" step="0.05" defaultValue="1"
          className="w-20" onChange={(event) => { audioRef.current.volume = Number(event.target.value); }} />
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
});
export default ProtectedAudioPlayer;
