import { Link } from "react-router-dom";

import { getProfilePath, normalizeProfileUsername } from "../../utils/profile";

export default function ProfileNameLink({
  name = "",
  username = "",
  className = "",
  children = null,
  ariaLabel = "",
  title = "",
  showHandle = false,
  ...props
}) {
  const normalizedUsername = normalizeProfileUsername(username);
  const profilePath = getProfilePath(normalizedUsername);
  const displayName = String(name || "").trim();
  const fallbackLabel = displayName || (normalizedUsername ? `@${normalizedUsername}` : "User");
  const label = ariaLabel || `Open ${fallbackLabel}'s profile`;
  const hasCustomChildren =
    children !== null &&
    children !== undefined &&
    !(typeof children === "string" && !children.trim());

  const content =
    hasCustomChildren ? (
      children
    ) : (
      <>
        <span className="profile-name-link__label">
          {displayName || normalizedUsername || "User"}
        </span>
        {showHandle && normalizedUsername ? (
          <span className="profile-name-link__handle">@{normalizedUsername}</span>
        ) : null}
      </>
    );

  const sharedProps = {
    className: `profile-name-link ${className}`.trim(),
    title: title || label,
    "aria-label": label,
    ...props,
  };

  if (!profilePath) {
    return <span {...sharedProps}>{content}</span>;
  }

  return (
    <Link to={profilePath} {...sharedProps}>
      {content}
    </Link>
  );
}
