import { forwardRef, useEffect } from "react";
import VideoControlsOverlay from "./VideoControlsOverlay";

const VideoPlayer = forwardRef(function VideoPlayer(
  {
    wrapperRef,
    src,
    sourceType,
    poster,
    isMuted,
    setIsMuted,
    isPlaying,
    setIsPlaying,
    onWaiting,
    onPlaying,
    onPlay,
    onPause,
    onError,
  },
  videoRef
) {
  useEffect(() => {
    const video = videoRef?.current;
    if (!video) {
      return;
    }
    video.pause();
    setIsPlaying(false);
  }, [setIsPlaying, src, videoRef]);

  return (
    <div ref={wrapperRef}>
      <video
        ref={videoRef}
        poster={poster || undefined}
        className="post-video"
        muted={isMuted}
        controls={false}
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        onWaiting={onWaiting}
        onPlaying={onPlaying}
        onPlay={onPlay}
        onPause={onPause}
        onError={onError}
      >
        <source src={src} type={sourceType || "video/mp4"} />
      </video>

      <VideoControlsOverlay
        videoRef={videoRef}
        wrapperRef={wrapperRef}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
      />
    </div>
  );
});

export default VideoPlayer;
