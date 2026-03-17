import { useEffect, useState } from "react";

const formatAudioDuration = (value = 0) => {
  const totalSeconds = Math.max(0, Math.round(Number(value || 0)));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export default function useAudioFileMetadata(file) {
  const [metadata, setMetadata] = useState({
    durationSec: 0,
    formattedDuration: "",
  });

  useEffect(() => {
    if (!file) {
      setMetadata({ durationSec: 0, formattedDuration: "" });
      return undefined;
    }

    const objectUrl = URL.createObjectURL(file);
    const audio = document.createElement("audio");

    const clear = () => {
      URL.revokeObjectURL(objectUrl);
      audio.removeAttribute("src");
      audio.load();
    };

    audio.preload = "metadata";
    audio.src = objectUrl;
    audio.onloadedmetadata = () => {
      const durationSec = Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0;
      setMetadata({
        durationSec,
        formattedDuration: durationSec > 0 ? formatAudioDuration(durationSec) : "",
      });
      clear();
    };
    audio.onerror = () => {
      setMetadata({ durationSec: 0, formattedDuration: "" });
      clear();
    };

    return () => {
      clear();
    };
  }, [file]);

  return metadata;
}
