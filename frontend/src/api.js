// ================= BASE =================

// MONOLITHIC MODE – SAME ORIGIN
export const API = "/api";
const BASE = API;

// ================= AUTH HELPERS =================

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const handleAuthFail = (reason = "") => {
  console.warn("🔐 Auth failed:", reason);

  // Prevent infinite redirect loops
  if (window.location.pathname !== "/") {
    localStorage.clear();
    window.location.href = "/";
  }
};

// ================= RESPONSE PARSER =================

const parseJSON = async (res) => {
  const text = await res.text();

  // Empty body but OK
  if (!text && res.ok) return {};

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Server returned invalid JSON");
  }

  // ---- AUTH HANDLING ----
  if (res.status === 401) {
    handleAuthFail(data?.error || "Unauthorized");
    throw new Error(data?.error || "Unauthorized");
  }

  if (!res.ok) {
    throw new Error(
      data?.error ||
      data?.message ||
      `Request failed with ${res.status}`
    );
  }

  return data;
};

// ================= SAFE FETCH =================

const safeFetch = (url, options = {}) => {
  if (!navigator.onLine) {
    return Promise.reject(new Error("You are offline"));
  }

  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), 15000)
    ),
  ])
    .catch(() => {
      throw new Error("Network connection failed");
    })
    .then(parseJSON);
};

// ================= IMAGE HELPERS =================

export const getImage = (path) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return path.startsWith("/") ? path : `/${path}`;
};

// =================================================
// 🟢 AUTH
// =================================================

export const login = (email, password) =>
  safeFetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

export const register = (data) =>
  safeFetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

// =================================================
// 🟢 USER
// =================================================

export const getProfile = () =>
  safeFetch(`${BASE}/users/me`, {
    headers: authHeaders(),
  });

export const updateMe = (data) =>
  safeFetch(`${BASE}/users/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(data),
  });

export const uploadAvatar = (file) => {
  const f = new FormData();
  f.append("image", file);

  return safeFetch(`${BASE}/users/me/avatar`, {
    method: "POST",
    headers: authHeaders(),
    body: f,
  });
};

export const uploadCover = (file) => {
  const f = new FormData();
  f.append("image", file);

  return safeFetch(`${BASE}/users/me/cover`, {
    method: "POST",
    headers: authHeaders(),
    body: f,
  });
};

// =================================================
// 🟢 POSTS
// =================================================

export const getFeed = () =>
  safeFetch(`${BASE}/posts`, {
    headers: authHeaders(),
  });

export const createPost = (text, file) => {
  const f = new FormData();
  f.append("text", text || "");

  if (file) f.append("file", file);

  return safeFetch(`${BASE}/posts`, {
    method: "POST",
    headers: authHeaders(),
    body: f,
  });
};

export const likePost = (id) =>
  safeFetch(`${BASE}/posts/${id}/like`, {
    method: "POST",
    headers: authHeaders(),
  });

// =================================================
// 🟢 STORIES
// =================================================

export const getStories = () =>
  safeFetch(`${BASE}/stories`, {
    headers: authHeaders(),
  });

export const createStory = (form) =>
  safeFetch(`${BASE}/stories`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });

// =================================================
// 🟢 VIDEOS
// =================================================

export const getVideos = () =>
  safeFetch(`${BASE}/videos`, {
    headers: authHeaders(),
  });

export const uploadVideo = (videoUrl, caption) =>
  safeFetch(`${BASE}/videos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ videoUrl, caption }),
  });
