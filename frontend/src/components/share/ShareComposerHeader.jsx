import { resolveImage } from "../../api";
import ShareAudienceSelector from "./ShareAudienceSelector";
import ShareDestinationSelector from "./ShareDestinationSelector";
import { fallbackAvatar } from "./postShareUtils";

export default function ShareComposerHeader({
  user,
  destination,
  onDestinationChange,
  privacy,
  onPrivacyChange,
  privacyDisabled = false,
  helperText = "",
}) {
  const avatar =
    resolveImage(user?.avatar || user?.profilePic || "") ||
    fallbackAvatar(user?.name || user?.username);
  const displayName = user?.name || user?.username || "You";

  return (
    <div className="tg-share-composer-head">
      <div className="tg-share-composer-user">
        <img src={avatar} alt={displayName} />
        <div className="tg-share-composer-copy">
          <strong>{displayName}</strong>
          <span>Choose where this post should go.</span>
        </div>
      </div>

      <div className="tg-share-control-stack">
        <div className="tg-share-control-block">
          <span className="tg-share-control-label">Destination</span>
          <ShareDestinationSelector value={destination} onChange={onDestinationChange} />
        </div>

        <div className="tg-share-control-block">
          <span className="tg-share-control-label">Audience</span>
          <ShareAudienceSelector
            value={privacy}
            onChange={onPrivacyChange}
            disabled={privacyDisabled}
          />
        </div>
      </div>

      {helperText ? <p className="tg-share-helper">{helperText}</p> : null}
    </div>
  );
}
