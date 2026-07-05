export const GROUPS_STORAGE_KEY = "tengacion:user-groups:v1";
export const GROUPS_CHANGED_EVENT = "tengacion:groups-changed";

const LEGACY_PLACEHOLDER_IDS = new Set([
  "artists-hub",
  "afrobeat-producers",
  "live-session-organizers",
  "songwriters-community",
]);

const cleanText = (value = "") => String(value || "").trim();

export const getGroupOwnerKey = (user = {}) =>
  cleanText(user?._id || user?.id || user?.username || user?.email || "local-user").toLowerCase();

const normalizeMember = (member = {}) => ({
  id: cleanText(member?.id || member?._id || member?.username),
  name: cleanText(member?.name || member?.username || "Tengacion member"),
  username: cleanText(member?.username).replace(/^@+/, ""),
  avatar: cleanText(member?.avatar),
  role: cleanText(member?.role || "Member"),
});

const normalizePost = (post = {}) => ({
  id: cleanText(post?.id),
  text: cleanText(post?.text),
  createdAt: cleanText(post?.createdAt),
  author: normalizeMember(post?.author),
});

export const normalizeGroup = (group = {}) => {
  const id = cleanText(group?.id);
  if (!id || LEGACY_PLACEHOLDER_IDS.has(id)) {
    return null;
  }

  return {
    id,
    ownerKey: cleanText(group?.ownerKey).toLowerCase(),
    name: cleanText(group?.name || "Untitled group"),
    description: cleanText(group?.description),
    privacy: group?.privacy === "private" ? "private" : "public",
    coverImage: cleanText(group?.coverImage),
    createdAt: cleanText(group?.createdAt),
    updatedAt: cleanText(group?.updatedAt),
    members: Array.isArray(group?.members)
      ? group.members.map(normalizeMember).filter((member) => member.id || member.name)
      : [],
    posts: Array.isArray(group?.posts)
      ? group.posts.map(normalizePost).filter((post) => post.id && post.text)
      : [],
  };
};

const readAllGroups = () => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(GROUPS_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeGroup).filter(Boolean) : [];
  } catch {
    return [];
  }
};

const writeAllGroups = (groups = []) => {
  if (typeof window === "undefined") {
    return;
  }

  const cleanGroups = groups.map(normalizeGroup).filter(Boolean);
  window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(cleanGroups));
  window.dispatchEvent(new CustomEvent(GROUPS_CHANGED_EVENT, { detail: cleanGroups }));
};

export const readStoredGroups = (user = {}) => {
  const ownerKey = getGroupOwnerKey(user);
  return readAllGroups().filter((group) => group.ownerKey === ownerKey);
};

export const replaceStoredGroups = (groups = [], user = {}) => {
  const ownerKey = getGroupOwnerKey(user);
  const otherUsersGroups = readAllGroups().filter((group) => group.ownerKey !== ownerKey);
  const currentUserGroups = groups
    .map((group) => normalizeGroup({ ...group, ownerKey }))
    .filter(Boolean);
  writeAllGroups([...otherUsersGroups, ...currentUserGroups]);
  return currentUserGroups;
};

const createId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

export const createStoredGroup = (draft = {}, user = {}) => {
  const ownerKey = getGroupOwnerKey(user);
  const now = new Date().toISOString();
  const owner = normalizeMember({
    id: cleanText(user?._id || user?.id || user?.username || ownerKey),
    name: cleanText(user?.name || user?.username || "Group admin"),
    username: user?.username,
    avatar: user?.avatar,
    role: "Admin",
  });
  const group = normalizeGroup({
    id: createId(),
    ownerKey,
    name: draft?.name,
    description: draft?.description,
    privacy: draft?.privacy,
    coverImage: draft?.coverImage,
    createdAt: now,
    updatedAt: now,
    members: [owner],
    posts: [],
  });

  writeAllGroups([...readAllGroups(), group]);
  return group;
};

export const updateStoredGroup = (groupId, updates = {}, user = {}) => {
  const ownerKey = getGroupOwnerKey(user);
  let updatedGroup = null;
  const nextGroups = readAllGroups().map((group) => {
    if (group.id !== groupId || group.ownerKey !== ownerKey) {
      return group;
    }
    updatedGroup = normalizeGroup({
      ...group,
      ...updates,
      id: group.id,
      ownerKey: group.ownerKey,
      updatedAt: new Date().toISOString(),
    });
    return updatedGroup;
  });
  writeAllGroups(nextGroups);
  return updatedGroup;
};

export const addStoredGroupPost = (groupId, text, user = {}) => {
  const body = cleanText(text);
  if (!body) {
    return null;
  }

  const post = normalizePost({
    id: createId(),
    text: body,
    createdAt: new Date().toISOString(),
    author: {
      id: cleanText(user?._id || user?.id || user?.username),
      name: cleanText(user?.name || user?.username || "Tengacion member"),
      username: user?.username,
      avatar: user?.avatar,
      role: "Admin",
    },
  });
  const group = readStoredGroups(user).find((entry) => entry.id === groupId);
  if (!group) {
    return null;
  }
  updateStoredGroup(groupId, { posts: [post, ...group.posts] }, user);
  return post;
};

export const purgeLegacyGroupArtifacts = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const shareKey = "tengacion:group-shares";
    const parsed = JSON.parse(window.localStorage.getItem(shareKey) || "{}");
    const cleaned = Object.fromEntries(
      Object.entries(parsed).filter(([groupId]) => !LEGACY_PLACEHOLDER_IDS.has(groupId))
    );
    window.localStorage.setItem(shareKey, JSON.stringify(cleaned));
  } catch {
    // A malformed legacy cache should never prevent the Groups page from loading.
  }
};
