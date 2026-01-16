// ================= BASE =================

// FORCE use of backend API – ignore relative paths
export const API = "https://tengacion-api.onrender.com/api";

const BASE = API;

// ================= HELPERS =================

const auth = () => ({
  Authorization: "Bearer " + localStorage.getItem("token")
});

const json = async (res) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error("❌ API returned non-JSON:", text);
    throw new Error("Server error");
  }
};

export const getImage = (path) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return path;
};

// ================= AUTH =================

export const login = (email, password) =>
  fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  }).then(json);

export const register = (data) =>
  fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(json);

// ================= USER =================

export const getProfile = () =>
  fetch(`${BASE}/users/me`, { headers: auth() }).then(json);

export const updateMe = (data) =>
  fetch(`${BASE}/users/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...auth() },
    body: JSON.stringify(data)
  }).then(json);

export const uploadAvatar = (file) => {
  const f = new FormData();
  f.append("image", file);

  return fetch(`${BASE}/users/me/avatar`, {
    method: "POST",
    headers: auth(),
    body: f
  }).then(json);
};

export const uploadCover = (file) => {
  const f = new FormData();
  f.append("image", file);

  return fetch(`${BASE}/users/me/cover`, {
    method: "POST",
    headers: auth(),
    body: f
  }).then(json);
};

// ================= POSTS =================

export const getFeed = () =>
  fetch(`${BASE}/posts`, { headers: auth() }).then(json);

export const createPost = (text, file) => {
  const f = new FormData();
  f.append("text", text || "");
  if (file) f.append("file", file);

  return fetch(`${BASE}/posts`, {
    method: "POST",
    headers: auth(),
    body: f
  }).then(json);
};

export const likePost = (id) =>
  fetch(`${BASE}/posts/${id}/like`, {
    method: "POST",
    headers: auth()
  }).then(json);

// ================= STORIES =================

export const getStories = () =>
  fetch(`${BASE}/stories`, { headers: auth() }).then(json);

export const createStory = (form) =>
  fetch(`${BASE}/stories`, {
    method: "POST",
    headers: auth(),
    body: form
  }).then(json);

// ================= VIDEOS =================

export const getVideos = () =>
  fetch(`${BASE}/videos`, { headers: auth() }).then(json);

export const uploadVideo = (videoUrl, caption) =>
  fetch(`${BASE}/videos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...auth()
    },
    body: JSON.stringify({ videoUrl, caption })
  }).then(json);
