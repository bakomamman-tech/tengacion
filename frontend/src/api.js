// Smart API base (works on localhost + Render)
export const API =
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "";

// Smart image resolver
export const getImage = path => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return window.location.hostname === "localhost"
    ? "http://localhost:5000" + path
    : path;
};

/* ================= AUTH ================= */

export function login(email, password) {
  return fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  }).then(r => r.json());
}

export function register(data) {
  return fetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(r => r.json());
}

/* ================= PROFILE ================= */

export function getProfile() {
  return fetch(`${API}/api/users/me`, {
    headers: {
      Authorization: localStorage.getItem("token")
    }
  }).then(r => r.json());
}

export function updateProfile(data) {
  return fetch(`${API}/api/users/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: localStorage.getItem("token")
    },
    body: JSON.stringify(data)
  }).then(r => r.json());
}

/* ================= POSTS ================= */

export function getFeed() {
  return fetch(`${API}/api/posts`, {
    headers: {
      Authorization: localStorage.getItem("token")
    }
  }).then(r => r.json());
}

export function createPost(text, file) {
  const form = new FormData();
  form.append("text", text || "");
  if (file) form.append("file", file);

  return fetch(`${API}/api/posts`, {
    method: "POST",
    headers: {
      Authorization: localStorage.getItem("token")
    },
    body: form
  }).then(r => r.json());
}

export function likePost(id) {
  return fetch(`${API}/api/posts/${id}/like`, {
    method: "POST",
    headers: {
      Authorization: localStorage.getItem("token")
    }
  }).then(r => r.json());
}

/* ================= STORIES ================= */

export function getStories() {
  return fetch(`${API}/api/stories`, {
    headers: {
      Authorization: localStorage.getItem("token")
    }
  }).then(r => r.json());
}

export function createStory(form) {
  return fetch(`${API}/api/stories`, {
    method: "POST",
    headers: {
      Authorization: localStorage.getItem("token")
    },
    body: form
  }).then(r => r.json());
}

/* ================= FRIENDS ================= */

export function sendFriendRequest(id) {
  return fetch(`${API}/api/users/${id}/request`, {
    method: "POST",
    headers: {
      Authorization: localStorage.getItem("token")
    }
  }).then(r => r.json());
}

export function acceptFriendRequest(id) {
  return fetch(`${API}/api/users/${id}/accept`, {
    method: "POST",
    headers: {
      Authorization: localStorage.getItem("token")
    }
  }).then(r => r.json());
}

/* ================= MESSAGES ================= */

export function getMessages(otherUserId) {
  return fetch(`${API}/api/messages/${otherUserId}`, {
    headers: {
      Authorization: localStorage.getItem("token")
    }
  }).then(r => r.json());
}

/* ================= MEDIA ================= */

export function uploadAvatar(file) {
  const form = new FormData();
  form.append("image", file);

  return fetch(`${API}/api/users/me/avatar`, {
    method: "POST",
    headers: {
      Authorization: localStorage.getItem("token")
    },
    body: form
  }).then(r => r.json());
}

export function uploadCover(file) {
  const form = new FormData();
  form.append("image", file);

  return fetch(`${API}/api/users/me/cover`, {
    method: "POST",
    headers: {
      Authorization: localStorage.getItem("token")
    },
    body: form
  }).then(r => r.json());
}
