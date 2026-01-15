// Tengacion runs inside PyrexxBook (same-origin deployment)
// API root — DO NOT add /api anywhere else in the app
export const API = "/api";
export default API;

/* ================= UTIL ================= */

export const getImage = (path) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return path; // same-origin: /uploads/...
};

const authHeader = () => ({
  Authorization: "Bearer " + localStorage.getItem("token")
});

// Force-safe fetch that prevents double /api
const apiFetch = (url, options = {}) => {
  // Remove accidental double /api
  url = url.replace("/api/api", "/api");
  return fetch(url, options).then((r) => r.json());
};

/* ================= AUTH ================= */

export function login(email, password) {
  return apiFetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
}

export function register(formData) {
  return apiFetch(`${API}/auth/register`, {
    method: "POST",
    body: formData
  });
}

/* ================= PROFILE ================= */

export function getProfile() {
  return apiFetch(`${API}/users/me`, {
    headers: authHeader()
  });
}

export function updateProfile(data) {
  return apiFetch(`${API}/users/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeader()
    },
    body: JSON.stringify(data)
  });
}

/* ================= POSTS ================= */

export function getFeed() {
  return apiFetch(`${API}/posts`, {
    headers: authHeader()
  });
}

export function createPost(text, file) {
  const form = new FormData();
  form.append("text", text || "");
  if (file) form.append("file", file);

  return apiFetch(`${API}/posts`, {
    method: "POST",
    headers: authHeader(),
    body: form
  });
}

export function likePost(id) {
  return apiFetch(`${API}/posts/${id}/like`, {
    method: "POST",
    headers: authHeader()
  });
}

/* ================= STORIES ================= */

export function getStories() {
  return apiFetch(`${API}/stories`, {
    headers: authHeader()
  });
}

export function createStory(form) {
  return apiFetch(`${API}/stories`, {
    method: "POST",
    headers: authHeader(),
    body: form
  });
}

/* ================= FRIENDS ================= */

export function sendFriendRequest(id) {
  return apiFetch(`${API}/users/${id}/request`, {
    method: "POST",
    headers: authHeader()
  });
}

export function acceptFriendRequest(id) {
  return apiFetch(`${API}/users/${id}/accept`, {
    method: "POST",
    headers: authHeader()
  });
}

/* ================= MESSAGES ================= */

export function getMessages(otherUserId) {
  return apiFetch(`${API}/messages/${otherUserId}`, {
    headers: authHeader()
  });
}

/* ================= MEDIA ================= */

export function uploadAvatar(file) {
  const form = new FormData();
  form.append("image", file);

  return apiFetch(`${API}/users/me/avatar`, {
    method: "POST",
    headers: authHeader(),
    body: form
  });
}

export function uploadCover(file) {
  const form = new FormData();
  form.append("image", file);

  return apiFetch(`${API}/users/me/cover`, {
    method: "POST",
    headers: authHeader(),
    body: form
  });
}
