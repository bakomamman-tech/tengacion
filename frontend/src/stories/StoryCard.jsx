import { useState } from "react";
import StoryViewer from "./StoryViewer";
import { resolveImage } from "../api";

export default function StoryCard({
  story,
  stories = [],
  hasUnseen = false,
  isOwner = false,
  onSeen,
}) {
  const [open, setOpen] = useState(false);
  const cover = resolveImage(story?.thumbnailUrl || story?.mediaUrl || story?.image);
  const mediaType = story?.mediaType || (String(story?.mediaUrl || "").includes(".mp4") ? "video" : "image");

  const avatarSrc = story?.avatar
    ? resolveImage(story.avatar)
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(
        story?.username || "User"
      )}`;

  const wrapperClass = [
    "story-card",
    hasUnseen && !isOwner ? "updated" : "seen",
  ].join(" ");

  return (
    <>
      <div className={wrapperClass} onClick={() => setOpen(true)}>
        {cover ? (
          mediaType === "video" ? (
            <video src={cover} muted playsInline preload="metadata" />
          ) : (
            <img
              src={cover}
              alt="Story"
            />
          )
        ) : (
          <div className="story-card-text-fallback">
            {story?.text || "New story"}
          </div>
        )}

        <div className="story-avatar">
          <img src={avatarSrc} alt={story?.username || "User"} />
        </div>

        <div className="story-name">
          {story?.username}
        </div>

        {hasUnseen && !isOwner && (
          <span className="story-updated-pill">Updated</span>
        )}
      </div>

      {open && (
        <StoryViewer
          story={story}
          stories={stories}
          onClose={() => setOpen(false)}
          onSeen={onSeen}
        />
      )}
    </>
  );
}
