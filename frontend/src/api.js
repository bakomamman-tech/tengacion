// ======================================================
// TENGACION API CLIENT – WORLD STANDARD (FETCH-BASED)
// ======================================================

// ---------------- BASE CONFIG ----------------

// Same-origin API (works locally, on Render, and behind proxies)
export const API_BASE = "/api";

// ---------------- AUTH HELPERS ----------------

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const handleAuthFailure = (error = "Unauthorized") => {
  console.warn("🔐 Authentication failure:", error);

  // Prevent redirect loops
  if (window.location.pathname !== "/") {
    localStorage.clear();
    window.location.replace("/");
  }
};

// ---------------- RESPONSE HANDLER ----------------

const safeJSON = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid server response");
  }
};

const parseResponse = async (response) => {
  const raw = await response.text();
  const data = raw ? safeJSON(raw) : {};

  if (response.status === 401) {
    handleAuthFailure(data?.error);
    throw new Error(data?.error || "Unauthorized");
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
      data?.message ||
      `Request failed (${response.status})`
    );
  }

  return data;
};

// ---------------- FETCH WRAPPER ----------------

const withTimeout = (promise, ms = 15000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), ms)
    ),
  ]);

const request = async (url, options = {}) => {
  if (!navigator.onLine) {
    throw new Error("No internet connection");
  }

  const response = await withTimeout(
    fetch(url, {
      credentials: "same-origin",
      ...options,
    })
  );

  return parseResponse(response);
};

// ======================================================
// 🟢 AUTH
// ======================================================

export const login = (email, password) =>
  request(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emailOrUsername: email, password }),
  });

export const register = (payload) =>
  request(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

// ======================================================
// 🟢 USER
// ======================================================

export const getProfile = () =>
  request(`${API_BASE}/auth/me`, {
    headers: getAuthHeaders(),
  });

export const getUserProfile = (username) =>
  request(`${API_BASE}/users/profile/${encodeURIComponent(username || "")}`, {
    headers: getAuthHeaders(),
  });

/**
 * ✅ REQUIRED BY ProfileEditor.jsx
 * Update logged-in user's profile
 */
export const updateMe = (data) =>
  request(`${API_BASE}/users/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });

export const uploadAvatar = (file) => {
  const form = new FormData();
  form.append("image", file);

  return request(`${API_BASE}/users/me/avatar`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
  });
};

export const uploadCover = (file) => {
  const form = new FormData();
  form.append("image", file);

  return request(`${API_BASE}/users/me/cover`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
  });
};

// ======================================================
// 🟢 POSTS
// ======================================================

export const getFeed = () =>
  request(`${API_BASE}/posts`, {
    headers: getAuthHeaders(),
  });

export const getPostsByUsername = (username) =>
  request(`${API_BASE}/posts/user/${encodeURIComponent(username || "")}`, {
    headers: getAuthHeaders(),
  });

export const createPost = (input, maybeFile = null) => {
  const payload =
    input && typeof input === "object" && !Array.isArray(input)
      ? input
      : { text: input, file: maybeFile };

  const {
    text = "",
    file = null,
    tags = [],
    feeling = "",
    location = "",
    callsEnabled = false,
    callNumber = "",
    moreOptions = [],
  } = payload;

  const form = new FormData();
  form.append("text", text || "");
  if (file) {
    form.append("file", file);
  }

  if (Array.isArray(tags) && tags.length > 0) {
    form.append("tags", JSON.stringify(tags));
  }

  if (feeling) {
    form.append("feeling", feeling);
  }

  if (location) {
    form.append("location", location);
  }

  form.append("callsEnabled", String(Boolean(callsEnabled)));

  if (callNumber) {
    form.append("callNumber", callNumber);
  }

  if (Array.isArray(moreOptions) && moreOptions.length > 0) {
    form.append("moreOptions", JSON.stringify(moreOptions));
  }

  return request(`${API_BASE}/posts`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
  });
};

export const likePost = (id) =>
  request(`${API_BASE}/posts/${id}/like`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

// ======================================================
// 🟢 STORIES
// ======================================================

export const getStories = () =>
  request(`${API_BASE}/stories`, {
    headers: getAuthHeaders(),
  });

export const createStory = (formData) =>
  request(`${API_BASE}/stories`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

// ======================================================
// 🟢 VIDEOS
// ======================================================

export const getVideos = () =>
  request(`${API_BASE}/videos`, {
    headers: getAuthHeaders(),
  });

export const uploadVideo = (videoUrl, caption) =>
  request(`${API_BASE}/videos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ videoUrl, caption }),
  });

// ======================================================
// MESSAGES
// ======================================================

export const getChatContacts = () =>
  request(`${API_BASE}/messages/contacts`, {
    headers: getAuthHeaders(),
  });

export const getConversationMessages = (otherUserId) =>
  request(`${API_BASE}/messages/${otherUserId}`, {
    headers: getAuthHeaders(),
  });

export const sendChatMessage = (otherUserId, text, clientId) =>
  request(`${API_BASE}/messages/${otherUserId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ text, clientId }),
  });

// ======================================================
// 🟢 UTIL
// ======================================================

export const resolveImage = (path) => {
  if (!path) {
    return "";
  }

  if (typeof path === "object") {
    return resolveImage(path.url || "");
  }

  if (path.startsWith("http")) {
    return path;
  }

  if (path.startsWith("data:")) {
    return path;
  }

  return path.startsWith("/") ? path : `/${path}`;
};
