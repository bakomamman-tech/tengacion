import { useEffect, useState } from "react";

const formatDuration = (value = 0) => {
  const totalSeconds = Math.max(0, Math.round(Number(value || 0)));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export default function useMediaFileMetadata(file, mediaType = "audio") {
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
    const media = document.createElement(mediaType === "video" ? "video" : "audio");

    const clear = () => {
      URL.revokeObjectURL(objectUrl);
      media.removeAttribute("src");
      media.load();
    };

    media.preload = "metadata";
    media.src = objectUrl;
    media.onloadedmetadata = () => {
      const durationSec = Number.isFinite(media.duration) ? Math.round(media.duration) : 0;
      setMetadata({
        durationSec,
        formattedDuration: durationSec > 0 ? formatDuration(durationSec) : "",
      });
      clear();
    };
    media.onerror = () => {
      setMetadata({ durationSec: 0, formattedDuration: "" });
      clear();
    };

    return () => {
      clear();
    };
  }, [file, mediaType]);

  return metadata;
}
