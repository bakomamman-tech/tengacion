const LEGACY_PLACEHOLDER_IDS = new Set([
  "artists-hub",
  "afrobeat-producers",
  "live-session-organizers",
  "songwriters-community",
]);

export const LEGACY_GROUP_STORAGE_KEYS = [
  "tengacion:user-groups:v1",
  "tengacion:group-shares",
];

const cleanText = (value = "") => String(value || "").trim();

const normalizeMember = (member = {}) => ({
  id: cleanText(member?.id || member?._id || member?.username),
  name: cleanText(member?.name || member?.username || "Tengacion member"),
  username: cleanText(member?.username).replace(/^@+/, ""),
  avatar: cleanText(member?.avatar),
  role: cleanText(member?.role || "Member"),
});

const normalizePost = (post = {}) => ({
  id: cleanText(post?.id || post?._id),
  text: cleanText(post?.text),
  createdAt: cleanText(post?.createdAt),
  author: normalizeMember(post?.author),
});

export const normalizeGroup = (group = {}) => {
  const id = cleanText(group?.id || group?._id);
  if (!id || LEGACY_PLACEHOLDER_IDS.has(id)) {
    return null;
  }

  return {
    id,
    name: cleanText(group?.name || "Untitled group"),
    description: cleanText(group?.description),
    privacy: group?.privacy === "private" ? "private" : "public",
    coverImage: cleanText(group?.coverImage),
    createdAt: cleanText(group?.createdAt),
    updatedAt: cleanText(group?.updatedAt),
    owner: normalizeMember(group?.owner),
    members: Array.isArray(group?.members)
      ? group.members.map(normalizeMember).filter((member) => member.id || member.name)
      : [],
    posts: Array.isArray(group?.posts)
      ? group.posts.map(normalizePost).filter((post) => post.id && post.text)
      : [],
  };
};

export const normalizeGroups = (groups = []) =>
  (Array.isArray(groups) ? groups : []).map(normalizeGroup).filter(Boolean);

export const purgeLegacyGroupArtifacts = () => {
  if (typeof window === "undefined") {
    return [];
  }

  const removed = [];
  LEGACY_GROUP_STORAGE_KEYS.forEach((key) => {
    try {
      if (window.localStorage.getItem(key) !== null) {
        window.localStorage.removeItem(key);
        removed.push(key);
      }
    } catch {
      // Storage cleanup is best-effort and must never block server-backed Groups.
    }
  });
  return removed;
};
