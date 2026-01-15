// Tengacion now runs inside PyrexxBook.
// We use SAME-ORIGIN API calls.
export const API = "";
export default "";

// Smart image resolver
export const getImage = (path) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return path; // same-origin
};

// Helper for auth header
const authHeader = () => ({
  Authorization: "Bearer " + localStorage.getItem("token")
});

/* ================= AUTH ================= */

export function login(email, password) {
  return fetch(`/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  }).then((r) => r.json());
}

export function register(formData) {
  return fetch(`/api/auth/register`, {
    method: "POST",
    body: formData
  }).then((r) => r.json());
}

/* ================= PROFILE ================= */

export function getProfile() {
  return fetch(`/api/users/me`, {
    headers: authHeader()
  }).then((r) => r.json());
}

export function updateProfile(data) {
  return fetch(`/api/users/me`, {
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
  return fetch(`/api/posts`, {
    headers: authHeader()
  }).then((r) => r.json());
}

export function createPost(text, file) {
  const form = new FormData();
  form.append("text", text || "");
  if (file) form.append("file", file);

  return fetch(`/api/posts`, {
    method: "POST",
    headers: authHeader(),
    body: form
  }).then((r) => r.json());
}

export function likePost(id) {
  return fetch(`/api/posts/${id}/like`, {
    method: "POST",
    headers: authHeader()
  }).then((r) => r.json());
}

/* ================= STORIES ================= */

export function getStories() {
  return fetch(`/api/stories`, {
    headers: authHeader()
  }).then((r) => r.json());
}

export function createStory(form) {
  return fetch(`/api/stories`, {
    method: "POST",
    headers: authHeader(),
    body: form
  }).then((r) => r.json());
}

/* ================= FRIENDS ================= */

export function sendFriendRequest(id) {
  return fetch(`/api/users/${id}/request`, {
    method: "POST",
    headers: authHeader()
  }).then((r) => r.json());
}

export function acceptFriendRequest(id) {
  return fetch(`/api/users/${id}/accept`, {
    method: "POST",
    headers: authHeader()
  }).then((r) => r.json());
}

/* ================= MESSAGES ================= */

export function getMessages(otherUserId) {
  return fetch(`/api/messages/${otherUserId}`, {
    headers: authHeader()
  }).then((r) => r.json());
}

/* ================= MEDIA ================= */

export function uploadAvatar(file) {
  const form = new FormData();
  form.append("image", file);

  return fetch(`/api/users/me/avatar`, {
    method: "POST",
    headers: authHeader(),
    body: form
  }).then((r) => r.json());
}

export function uploadCover(file) {
  const form = new FormData();
  form.append("image", file);

  return fetch(`/api/users/me/cover`, {
    method: "POST",
    headers: authHeader(),
    body: form
  }).then((r) => r.json());
}
