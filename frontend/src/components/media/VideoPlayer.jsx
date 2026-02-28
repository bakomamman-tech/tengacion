import { forwardRef } from "react";
import VideoControlsOverlay from "./VideoControlsOverlay";

const VideoPlayer = forwardRef(function VideoPlayer(
  {
    wrapperRef,
    src,
    sourceType,
    poster,
    disableAutoplay,
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
  return (
    <div ref={wrapperRef}>
      <video
        ref={videoRef}
        poster={poster || undefined}
        className="post-video"
        muted={disableAutoplay ? false : isMuted}
        controls={false}
        autoPlay={!disableAutoplay}
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
        disableAutoplay={disableAutoplay}
      />
    </div>
  );
});

export default VideoPlayer;
