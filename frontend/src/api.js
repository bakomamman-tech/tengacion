// Tengacion runs inside PyrexxBook (same-origin deployment)
// All API calls go through /api
export const API = "/api";
export default API;

/* ================= UTIL ================= */

// Smart image resolver (Render serves /uploads)
export const getImage = (path) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return path; // same origin: /uploads/...
};

const authHeader = () => ({
  Authorization: "Bearer " + localStorage.getItem("token")
});

/* ================= AUTH ================= */

export function login(email, password) {
  return fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  }).then((r) => r.json());
}

export function register(formData) {
  return fetch(`${API}/auth/register`, {
    method: "POST",
    body: formData
  }).then((r) => r.json());
}

/* ================= PROFILE ================= */

export function getProfile() {
  return fetch(`${API}/users/me`, {
    headers: authHeader()
  }).then((r) => r.json());
}

export function updateProfile(data) {
  return fetch(`${API}/users/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeader()
    },
    body: JSON.stringify(data)
  }).then((r) => r.json());
}

/* ================= POSTS ================= */

export function getFeed() {
  return fetch(`${API}/posts`, {
    headers: authHeader()
  }).then((r) => r.json());
}

export function createPost(text, file) {
  const form = new FormData();
  form.append("text", text || "");
  if (file) form.append("file", file);

  return fetch(`${API}/posts`, {
    method: "POST",
    headers: authHeader(),
    body: form
  }).then((r) => r.json());
}

export function likePost(id) {
  return fetch(`${API}/posts/${id}/like`, {
    method: "POST",
    headers: authHeader()
  }).then((r) => r.json());
}

/* ================= STORIES ================= */

export function getStories() {
  return fetch(`${API}/stories`, {
    headers: authHeader()
  }).then((r) => r.json());
}

export function createStory(form) {
  return fetch(`${API}/stories`, {
    method: "POST",
    headers: authHeader(),
    body: form
  }).then((r) => r.json());
}

/* ================= FRIENDS ================= */

export function sendFriendRequest(id) {
  return fetch(`${API}/users/${id}/request`, {
    method: "POST",
    headers: authHeader()
  }).then((r) => r.json());
}

export function acceptFriendRequest(id) {
  return fetch(`${API}/users/${id}/accept`, {
    method: "POST",
    headers: authHeader()
  }).then((r) => r.json());
}

/* ================= MESSAGES ================= */

export function getMessages(otherUserId) {
  return fetch(`${API}/messages/${otherUserId}`, {
    headers: authHeader()
  }).then((r) => r.json());
}

/* ================= MEDIA ================= */

export function uploadAvatar(file) {
  const form = new FormData();
  form.append("image", file);

  return fetch(`${API}/users/me/avatar`, {
    method: "POST",
    headers: authHeader(),
    body: form
  }).then((r) => r.json());
}

export function uploadCover(file) {
  const form = new FormData();
  form.append("image", file);

  return fetch(`${API}/users/me/cover`, {
    method: "POST",
    headers: authHeader(),
    body: form
  }).then((r) => r.json());
}
