// ================= BASE =================

// FORCE use of backend API
export const API = "https://tengacion-api.onrender.com/api";
const BASE = API;

// ================= HELPERS =================

const auth = () => ({
  Authorization: "Bearer " + (localStorage.getItem("token") || "")
});

const handleAuthFail = () => {
  localStorage.clear();
  window.location.href = "/";
};

const json = async (res) => {
  const text = await res.text();

  // Handle empty body
  if (!text) {
    if (res.ok) return {};
    throw new Error("Empty server response");
  }

  try {
    const data = JSON.parse(text);

    // Auto logout if token expired / invalid
    if (res.status === 401) {
      handleAuthFail();
      return;
    }

    // Backend sent structured error
    if (!res.ok) {
      throw new Error(data?.error || data?.message || "Request failed");
    }

    return data;
  } catch (err) {
    console.error("❌ API returned non-JSON:", text);
    throw new Error(err.message || text || "Server error");
  }
};

// Normalize image / upload paths
export const getImage = (path) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) {
    return `https://tengacion-api.onrender.com${path}`;
  }
  return `https://tengacion-api.onrender.com/${path}`;
};

// Safe fetch wrapper
const safeFetch = (url, options = {}) =>
  fetch(url, options)
    .catch(() => {
      throw new Error("Network connection failed");
    })
    .then(json);

// ================= AUTH =================

export const login = (email, password) =>
  safeFetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

export const register = (data) =>
  safeFetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

// ================= USER =================

export const getProfile = () =>
  safeFetch(`${BASE}/users/me`, {
    headers: auth()
  });

export const updateMe = (data) =>
  safeFetch(`${BASE}/users/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...auth()
    },
    body: JSON.stringify(data)
  });

export const uploadAvatar = (file) => {
  const f = new FormData();
  f.append("image", file);

  return safeFetch(`${BASE}/users/me/avatar`, {
    method: "POST",
    headers: auth(),
    body: f
  });
};

export const uploadCover = (file) => {
  const f = new FormData();
  f.append("image", file);

  return safeFetch(`${BASE}/users/me/cover`, {
    method: "POST",
    headers: auth(),
    body: f
  });
};

// ================= POSTS =================

export const getFeed = () =>
  safeFetch(`${BASE}/posts`, {
    headers: auth()
  });

export const createPost = (text, file) => {
  const f = new FormData();
  f.append("text", text || "");

  if (file) f.append("file", file);

  return safeFetch(`${BASE}/posts`, {
    method: "POST",
    headers: auth(),
    body: f
  });
};

export const likePost = (id) =>
  safeFetch(`${BASE}/posts/${id}/like`, {
    method: "POST",
    headers: auth()
  });

// ================= STORIES =================

export const getStories = () =>
  safeFetch(`${BASE}/stories`, {
    headers: auth()
  });

export const createStory = (form) =>
  safeFetch(`${BASE}/stories`, {
    method: "POST",
    headers: auth(),
    body: form
  });

// ================= VIDEOS =================

export const getVideos = () =>
  safeFetch(`${BASE}/videos`, {
    headers: auth()
  });

export const uploadVideo = (videoUrl, caption) =>
  safeFetch(`${BASE}/videos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...auth()
    },
    body: JSON.stringify({ videoUrl, caption })
  });
