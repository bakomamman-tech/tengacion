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
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = raw
    ? isJson
      ? safeJSON(raw)
      : { error: raw }
    : {};

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
  const { timeoutMs = 15000, ...fetchOptions } = options;

  if (!navigator.onLine) {
    throw new Error("No internet connection");
  }

  const response = await withTimeout(
    fetch(url, {
      credentials: "same-origin",
      ...fetchOptions,
    }),
    timeoutMs
  );

  return parseResponse(response);
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const shouldRetryXhrUpload = ({ status, message }) => {
  if (RETRYABLE_STATUS.has(status)) {
    return true;
  }

  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("timeout") ||
    normalized.includes("network") ||
    normalized.includes("failed")
  );
};

const uploadPostFormWithProgress = ({
  formData,
  onProgress,
  timeoutMs = 10 * 60 * 1000,
}) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/posts`);
    xhr.withCredentials = true;
    xhr.timeout = timeoutMs;

    const token = localStorage.getItem("token");
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || typeof onProgress !== "function") {
        return;
      }
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      const raw = xhr.responseText || "";
      let data = {};
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = { error: raw };
        }
      }

      if (xhr.status === 401) {
        handleAuthFailure(data?.error || data?.message || "Unauthorized");
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
        return;
      }

      const err = new Error(
        data?.error ||
        data?.message ||
        `Upload failed (${xhr.status || 0})`
      );
      err.status = xhr.status || 0;
      reject(err);
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timeout"));
    xhr.onabort = () => reject(new Error("Upload canceled"));
    xhr.send(formData);
  });

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

export const getUsers = (search = "") =>
  request(
    `${API_BASE}/users${search ? `?search=${encodeURIComponent(search)}` : ""}`,
    {
      headers: getAuthHeaders(),
    }
  );

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
    timeoutMs: 60000,
  });
};

export const uploadCover = (file) => {
  const form = new FormData();
  form.append("image", file);

  return request(`${API_BASE}/users/me/cover`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
    timeoutMs: 60000,
  });
};

export const getFriendRequests = () =>
  request(`${API_BASE}/users/requests`, {
    headers: getAuthHeaders(),
  });

export const sendFriendRequest = (userId) =>
  request(`${API_BASE}/users/${encodeURIComponent(userId || "")}/request`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

export const cancelFriendRequest = (userId) =>
  request(`${API_BASE}/users/${encodeURIComponent(userId || "")}/request`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

export const acceptFriendRequest = (userId) =>
  request(`${API_BASE}/users/${encodeURIComponent(userId || "")}/accept`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

export const rejectFriendRequest = (userId) =>
  request(`${API_BASE}/users/${encodeURIComponent(userId || "")}/reject`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

export const unfriend = (userId) =>
  request(`${API_BASE}/users/${encodeURIComponent(userId || "")}/friend`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

// ======================================================
// CREATORS
// ======================================================

export const getMyCreatorProfile = () =>
  request(`${API_BASE}/creators/me`, {
    headers: getAuthHeaders(),
  });

export const upsertCreatorProfile = (payload) =>
  request(`${API_BASE}/creators/me`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
  });

export const getCreator = (creatorId) =>
  request(`${API_BASE}/creators/${encodeURIComponent(creatorId || "")}`);

export const getCreatorTracks = (creatorId) =>
  request(`${API_BASE}/creators/${encodeURIComponent(creatorId || "")}/tracks`);

export const getCreatorBooks = (creatorId) =>
  request(`${API_BASE}/creators/${encodeURIComponent(creatorId || "")}/books`);

// ======================================================
// TRACKS
// ======================================================

export const createTrack = (payload) => {
  const isForm = typeof FormData !== "undefined" && payload instanceof FormData;
  const headers = isForm
    ? getAuthHeaders()
    : { "Content-Type": "application/json", ...getAuthHeaders() };
  const timeoutMs = isForm ? 120000 : undefined;

  return request(`${API_BASE}/tracks`, {
    method: "POST",
    headers,
    body: isForm ? payload : JSON.stringify(payload || {}),
    timeoutMs,
  });
};

export const getTrack = (trackId) =>
  request(`${API_BASE}/tracks/${encodeURIComponent(trackId || "")}`, {
    headers: getAuthHeaders(),
  });

export const getTrackStream = (trackId) =>
  request(`${API_BASE}/tracks/${encodeURIComponent(trackId || "")}/stream`, {
    headers: getAuthHeaders(),
  });

// ======================================================
// BOOKS
// ======================================================

export const createBook = (payload) => {
  const isForm = typeof FormData !== "undefined" && payload instanceof FormData;
  const headers = isForm
    ? getAuthHeaders()
    : { "Content-Type": "application/json", ...getAuthHeaders() };

  return request(`${API_BASE}/books`, {
    method: "POST",
    headers,
    body: isForm ? payload : JSON.stringify(payload || {}),
  });
};

export const createBookChapter = (bookId, payload) =>
  request(`${API_BASE}/books/${encodeURIComponent(bookId || "")}/chapters`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
  });

export const getBook = (bookId) =>
  request(`${API_BASE}/books/${encodeURIComponent(bookId || "")}`, {
    headers: getAuthHeaders(),
  });

export const getBookChapters = (bookId) =>
  request(`${API_BASE}/books/${encodeURIComponent(bookId || "")}/chapters`, {
    headers: getAuthHeaders(),
  });

export const getBookChapter = (bookId, chapterId) =>
  request(
    `${API_BASE}/books/${encodeURIComponent(bookId || "")}/chapters/${encodeURIComponent(chapterId || "")}`,
    {
      headers: getAuthHeaders(),
    }
  );

// ======================================================
// PAYMENTS + PURCHASES
// ======================================================

export const initPayment = ({ itemType, itemId, returnUrl }) =>
  request(`${API_BASE}/payments/init`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ itemType, itemId, returnUrl }),
  });

export const getMyPurchases = () =>
  request(`${API_BASE}/purchases/my`, {
    headers: getAuthHeaders(),
  });

export const getCreatorSales = () =>
  request(`${API_BASE}/purchases/creator/sales`, {
    headers: getAuthHeaders(),
  });

export const checkEntitlement = ({ itemType, itemId }) =>
  request(
    `${API_BASE}/entitlements/check?itemType=${encodeURIComponent(itemType || "")}&itemId=${encodeURIComponent(itemId || "")}`,
    {
      headers: getAuthHeaders(),
    }
  );

// ======================================================
// NOTIFICATIONS
// ======================================================

export const getNotifications = (page = 1, limit = 50) =>
  request(`${API_BASE}/notifications?page=${page}&limit=${limit}`, {
    headers: getAuthHeaders(),
  });

export const getUnreadNotificationsCount = () =>
  request(`${API_BASE}/notifications/unread-count`, {
    headers: getAuthHeaders(),
  });

export const markNotificationAsRead = (notificationId) =>
  request(`${API_BASE}/notifications/${encodeURIComponent(notificationId || "")}/read`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  }).catch(() =>
    request(`${API_BASE}/notifications/${encodeURIComponent(notificationId || "")}/read`, {
      method: "POST",
      headers: getAuthHeaders(),
    })
  );

export const markAllNotificationsAsRead = () =>
  request(`${API_BASE}/notifications/mark-all-read`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  }).catch(() =>
    request(`${API_BASE}/notifications/read-all`, {
      method: "POST",
      headers: getAuthHeaders(),
    })
  );

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
      ? { ...input }
      : { text: input, file: maybeFile };

  const normalizedType =
    typeof payload.type === "string" ? payload.type.toLowerCase() : "";
  const text = payload.text || "";
  const file = payload.file || null;
  const video = payload.video;

  const isVideoPost =
    normalizedType === "video" || (video && typeof video === "object" && video.url);

  if (isVideoPost) {
    const body = {
      ...payload,
      type: "video",
    };

    return request(`${API_BASE}/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(body),
    });
  }

  const {
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

export const createPostWithUploadProgress = async (
  payload,
  { onProgress, retries = 2, timeoutMs = 10 * 60 * 1000 } = {}
) => {
  const {
    text = "",
    file = null,
    type = "",
    tags = [],
    feeling = "",
    location = "",
    callsEnabled = false,
    callNumber = "",
    moreOptions = [],
  } = payload || {};

  const form = new FormData();
  form.append("text", text || "");
  if (file) {
    form.append("file", file);
  }
  if (type) {
    form.append("type", String(type));
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

  let lastError = null;
  const attempts = Math.max(1, Number(retries) + 1);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const result = await uploadPostFormWithProgress({
        formData: form,
        onProgress,
        timeoutMs,
      });
      if (typeof onProgress === "function") {
        onProgress(100);
      }
      return result;
    } catch (err) {
      lastError = err;
      const canRetry =
        attempt < attempts - 1 &&
        shouldRetryXhrUpload({ status: err?.status, message: err?.message });
      if (!canRetry) {
        throw err;
      }
      await wait(500 * (attempt + 1));
    }
  }

  throw lastError || new Error("Upload failed");
};

export const requestVideoUploadUrl = ({ filename, contentType, sizeBytes }) =>
  request(`${API_BASE}/videos/presign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ filename, contentType, sizeBytes }),
  });

export const getPostById = (postId) =>
  request(`${API_BASE}/posts/${encodeURIComponent(postId || "")}`, {
    headers: getAuthHeaders(),
  });

export const likePost = (id) =>
  request(`${API_BASE}/posts/${id}/like`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

export const getLiveSessions = () =>
  request(`${API_BASE}/live/active`, {
    headers: getAuthHeaders(),
  });

export const getLiveConfig = () =>
  request(`${API_BASE}/live/config`, {
    headers: getAuthHeaders(),
  });

export const startLiveSession = (title) =>
  request(`${API_BASE}/live/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ title }),
  });

export const requestLiveToken = ({ roomName, publish = false }) =>
  request(`${API_BASE}/live/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ roomName, publish: Boolean(publish) }),
  });

export const endLiveSession = (roomName) =>
  request(`${API_BASE}/live/end`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ roomName }),
  });

export const updateLiveViewerCount = ({ roomName, delta = 1 }) =>
  request(`${API_BASE}/live/viewers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ roomName, delta }),
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

export const markStorySeen = (storyId) =>
  request(`${API_BASE}/stories/${encodeURIComponent(storyId || "")}/seen`, {
    method: "POST",
    headers: getAuthHeaders(),
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

export const sendChatMessage = (otherUserId, input, clientId) => {
  const payload =
    input && typeof input === "object" && !Array.isArray(input)
      ? input
      : { text: input, clientId };

  return request(`${API_BASE}/messages/${otherUserId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
};

export const uploadChatAttachment = (file) => {
  const form = new FormData();
  form.append("file", file);

  return request(`${API_BASE}/messages/upload`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
    timeoutMs: 180000,
  });
};

export const shareMessageToFollowers = (payload) =>
  request(`${API_BASE}/messages/share/followers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
  });

export const sendChatMessageDirect = (payload) =>
  request(`${API_BASE}/chat/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
  });

export const deleteMessageForMe = (messageId) =>
  request(`${API_BASE}/messages/${encodeURIComponent(messageId || "")}/delete-for-me`, {
    method: "PATCH",
    headers: getAuthHeaders(),
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

  if (path.startsWith("blob:")) {
    return path;
  }

  if (path.startsWith("data:")) {
    return path;
  }

  return path.startsWith("/") ? path : `/${path}`;
};
