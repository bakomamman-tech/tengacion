// ======================================================
// TENGACION API CLIENT – WORLD STANDARD (FETCH-BASED)
// ======================================================

// ---------------- BASE CONFIG ----------------

// Same-origin API (works locally, on Render, and behind proxies)
import {
  clearSessionAccessToken,
  emitAuthLogout,
  getSessionAccessToken,
  setSessionAccessToken,
} from "./authSession";

export const API_BASE = "/api";
const withCacheBust = (url) => `${url}${String(url).includes("?") ? "&" : "?"}t=${Date.now()}`;

// ---------------- AUTH HELPERS ----------------

const getAuthHeaders = () => {
  const token = getSessionAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const getDeviceName = () => {
  if (typeof navigator === "undefined") {
    return "Web browser";
  }

  const ua = String(navigator.userAgent || "");
  const platform =
    navigator.userAgentData?.platform ||
    navigator.platform ||
    "";
  const browser =
    (Array.isArray(navigator.userAgentData?.brands) &&
      navigator.userAgentData.brands
        .map((entry) => entry?.brand)
        .filter(Boolean)
        .join(" ")) ||
    (ua.includes("Edg/")
      ? "Microsoft Edge"
      : ua.includes("Chrome/")
        ? "Google Chrome"
        : ua.includes("Firefox/")
          ? "Mozilla Firefox"
          : ua.includes("Safari/")
            ? "Safari"
            : "Browser");

  return [browser, platform].filter(Boolean).join(" on ") || "Web browser";
};

const handleAuthFailure = (error = "Unauthorized") => {
  console.warn("🔐 Authentication failure:", error);

  clearSessionAccessToken();
  try {
    localStorage.removeItem("user");
  } catch {
    // ignore storage errors
  }
  emitAuthLogout(error);

  // Prevent redirect loops
  if (window.location.pathname !== "/" && window.location.pathname !== "/login") {
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

const parseResponse = async (response, { suppressAuthFailure = false } = {}) => {
  const raw = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = raw
    ? isJson
      ? safeJSON(raw)
      : { error: raw }
    : {};

  if (response.status === 401) {
    if (!suppressAuthFailure) {
      handleAuthFailure(data?.error || data?.message || "Unauthorized");
    }
    throw new Error(data?.error || data?.message || "Unauthorized");
  }

  if (!response.ok) {
    const error = new Error(
      data?.error ||
      data?.message ||
      `Request failed (${response.status})`
    );
    error.status = response.status;
    error.details = data?.details || null;
    throw error;
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

let refreshPromise = null;
const shouldSkipRefresh = (url = "") =>
  String(url || "").includes("/auth/login") ||
  String(url || "").includes("/auth/register") ||
  String(url || "").includes("/auth/refresh") ||
  String(url || "").includes("/auth/challenge/verify");

const refreshSession = async () => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = withTimeout(
    fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
    15000
  )
    .then((response) => parseResponse(response))
    .then((data) => {
      if (data?.token) {
        setSessionAccessToken(data.token);
      }
      return data;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

const buildRequestHeaders = (headersInit) => {
  const headers = new Headers(headersInit || {});
  const token = getSessionAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
};

const request = async (url, options = {}) => {
  const {
    timeoutMs = 15000,
    skipAuthRefresh = false,
    suppressAuthFailure = false,
    ...fetchOptions
  } = options;

  if (!navigator.onLine) {
    throw new Error("No internet connection");
  }

  const doFetch = () =>
    withTimeout(
      fetch(url, {
        credentials: "same-origin",
        ...fetchOptions,
        headers: buildRequestHeaders(fetchOptions.headers),
      }),
      timeoutMs
    );

  let response = await doFetch();
  if (response.status === 401 && !skipAuthRefresh && !shouldSkipRefresh(url)) {
    try {
      const refreshPayload = await refreshSession();
      if (refreshPayload?.token) {
        response = await doFetch();
      }
    } catch {
      // Fall through to standard auth failure handling.
    }
  }

  const data = await parseResponse(response, { suppressAuthFailure });
  if (data?.token) {
    setSessionAccessToken(data.token);
  }
  return data;
};

export const apiRequest = request;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const compressImageFile = async (file) => {
  if (!(file instanceof File) || !String(file.type || "").startsWith("image/")) {
    return file;
  }
  const maxBytes = 1.5 * 1024 * 1024;
  if ((Number(file.size) || 0) <= maxBytes) {
    return file;
  }
  try {
    const imageBitmap = await createImageBitmap(file);
    const maxWidth = 1600;
    const ratio = imageBitmap.width > maxWidth ? maxWidth / imageBitmap.width : 1;
    const width = Math.round(imageBitmap.width * ratio);
    const height = Math.round(imageBitmap.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imageBitmap, 0, 0, width, height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );
    if (!blob) {return file;}
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
};

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

    const token = getSessionAccessToken();
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

const uploadFormWithProgress = ({
  url,
  formData,
  method = "POST",
  onProgress,
  timeoutMs = 10 * 60 * 1000,
}) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.withCredentials = true;
    xhr.timeout = timeoutMs;

    const token = getSessionAccessToken();
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || typeof onProgress !== "function") {
        return;
      }
      onProgress(Math.round((event.loaded / event.total) * 100), event);
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
    skipAuthRefresh: true,
    suppressAuthFailure: true,
    body: JSON.stringify({
      email,
      emailOrUsername: email,
      password,
      deviceName: getDeviceName(),
    }),
  });

export const register = (payload) =>
  request(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    skipAuthRefresh: true,
    suppressAuthFailure: true,
    body: JSON.stringify({
      ...(payload || {}),
      deviceName: getDeviceName(),
    }),
  });

export const restoreSession = () =>
  request(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
    skipAuthRefresh: true,
    suppressAuthFailure: true,
  });

export const verifyLoginChallenge = ({ challengeToken, code }) =>
  request(`${API_BASE}/auth/challenge/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeToken, code }),
    skipAuthRefresh: true,
    suppressAuthFailure: true,
  });

export const requestVerifyEmail = () =>
  request(`${API_BASE}/auth/verify-email/request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({}),
  });

export const confirmVerifyEmail = (token) =>
  request(`${API_BASE}/auth/verify-email/confirm?token=${encodeURIComponent(token || "")}`);

export const forgotPassword = (email) =>
  request(`${API_BASE}/auth/password/forgot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

export const resetPassword = ({ token, newPassword }) =>
  request(`${API_BASE}/auth/password/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });

export const changePassword = ({ oldPassword, newPassword }) =>
  request(`${API_BASE}/auth/password/change`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ oldPassword, newPassword }),
  });

export const getMfaStatus = () =>
  request(`${API_BASE}/auth/mfa`, {
    headers: getAuthHeaders(),
  });

export const startMfaSetup = () =>
  request(`${API_BASE}/auth/mfa/setup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({}),
  });

export const confirmMfaSetup = (code) =>
  request(`${API_BASE}/auth/mfa/setup/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ code }),
  });

export const enableEmailMfa = () =>
  request(`${API_BASE}/auth/mfa/email/enable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({}),
  });

export const disableMfa = ({ password, code }) =>
  request(`${API_BASE}/auth/mfa/disable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ password, code }),
  });

export const requestStepUpChallenge = () =>
  request(`${API_BASE}/auth/mfa/step-up`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({}),
  });

export const verifyStepUp = (payloadOrCode) =>
  request(`${API_BASE}/auth/mfa/step-up`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(
      typeof payloadOrCode === "string"
        ? { code: payloadOrCode }
        : payloadOrCode || {}
    ),
  });

export const listSessions = () =>
  request(`${API_BASE}/auth/sessions`, {
    headers: getAuthHeaders(),
  });

export const revokeSession = (sessionId) =>
  request(`${API_BASE}/auth/sessions/${encodeURIComponent(sessionId || "")}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

export const logoutCurrentSession = () =>
  request(`${API_BASE}/auth/logout`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

export const logoutAllSessions = () =>
  request(`${API_BASE}/auth/logout-all`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

// ======================================================
// 🟢 USER
// ======================================================

export const getProfile = () =>
  request(`${API_BASE}/auth/me?t=${Date.now()}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  }).then((payload) => payload?.user || payload);

export const getUserProfile = (username) =>
  request(`${API_BASE}/users/profile/${encodeURIComponent(username || "")}?t=${Date.now()}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
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

export const updatePrivacy = (payload) =>
  request(`${API_BASE}/users/me/privacy`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
  });

export const getAudioPreferences = () =>
  request(`${API_BASE}/users/me/audio`, {
    headers: getAuthHeaders(),
  });

export const updateAudioPreferences = (payload) =>
  request(`${API_BASE}/users/me/audio`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
  });

export const updateOnboarding = (payload) =>
  request(`${API_BASE}/users/me/onboarding`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
  });

const updatePrivacyList = (route) =>
  request(`${API_BASE}${route}`, {
    method: "PUT",
    headers: getAuthHeaders(),
  });

export const blockUser = (userId) =>
  updatePrivacyList(`/users/me/block/${encodeURIComponent(userId || "")}`);
export const unblockUser = (userId) =>
  updatePrivacyList(`/users/me/unblock/${encodeURIComponent(userId || "")}`);
export const muteUser = (userId) =>
  updatePrivacyList(`/users/me/mute/${encodeURIComponent(userId || "")}`);
export const unmuteUser = (userId) =>
  updatePrivacyList(`/users/me/unmute/${encodeURIComponent(userId || "")}`);
export const restrictUser = (userId) =>
  updatePrivacyList(`/users/me/restrict/${encodeURIComponent(userId || "")}`);
export const unrestrictUser = (userId) =>
  updatePrivacyList(`/users/me/unrestrict/${encodeURIComponent(userId || "")}`);
export const hideStoriesFromUser = (userId) =>
  updatePrivacyList(`/users/me/hide-stories-from/${encodeURIComponent(userId || "")}`);
export const unhideStoriesFromUser = (userId) =>
  updatePrivacyList(`/users/me/unhide-stories-from/${encodeURIComponent(userId || "")}`);

export const uploadAvatar = (file) => {
  const form = new FormData();
  form.append("image", file);

  return request(`${API_BASE}/users/me/avatar`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
    timeoutMs: 60000,
  }).then((payload) => payload?.user || payload);
};

export const uploadCover = (file) => {
  const form = new FormData();
  form.append("image", file);

  return request(`${API_BASE}/users/me/cover`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
    timeoutMs: 60000,
  }).then((payload) => payload?.user || payload);
};

export const getFriendRequests = () =>
  request(`${API_BASE}/users/requests`, {
    headers: getAuthHeaders(),
  });

export const getFriendsHub = () =>
  request(`${API_BASE}/users/me/friends-hub`, {
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

export const getCreatorAccess = () =>
  request(withCacheBust(`${API_BASE}/creator/access`), {
    headers: getAuthHeaders(),
    cache: "no-store",
  });

export const getCreatorWorkspaceProfile = () =>
  request(withCacheBust(`${API_BASE}/creator/profile`), {
    headers: getAuthHeaders(),
    cache: "no-store",
  });

export const registerCreatorProfile = (payload = {}) =>
  request(`${API_BASE}/creator/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
  });

export const updateCreatorWorkspaceProfile = (payload = {}) =>
  request(`${API_BASE}/creator/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
  });

export const getMyCreatorProfile = () =>
  request(`${API_BASE}/creators/me`, {
    headers: getAuthHeaders(),
  });

export const getCreatorDashboardSummary = () =>
  request(withCacheBust(`${API_BASE}/creator/me/content-summary`), {
    headers: getAuthHeaders(),
    cache: "no-store",
  });

export const getCreatorPrivateContent = () =>
  request(withCacheBust(`${API_BASE}/creator/me/content`), {
    headers: getAuthHeaders(),
    cache: "no-store",
  });

export const updatePodcastSeries = (payload = {}) =>
  request(`${API_BASE}/creator/podcasts/series`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
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

export const getPublicCreatorProfile = (creatorId) =>
  request(`${API_BASE}/creator/${encodeURIComponent(creatorId || "")}/public-profile`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });

export const getCreatorPublicContent = (creatorId) =>
  request(`${API_BASE}/creator/${encodeURIComponent(creatorId || "")}/content`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });

export const getCreatorHub = (creatorId) =>
  getPublicCreatorProfile(creatorId);

export const toggleFollowCreator = (creatorId) =>
  request(`${API_BASE}/creators/${encodeURIComponent(creatorId || "")}/follow`, {
    method: "PUT",
    headers: getAuthHeaders(),
  });

export const getCreatorTracks = (creatorId) =>
  request(`${API_BASE}/creators/${encodeURIComponent(creatorId || "")}/tracks`);

export const getCreatorBooks = (creatorId) =>
  request(`${API_BASE}/creators/${encodeURIComponent(creatorId || "")}/books`);

export const getCreatorAlbums = (creatorId) =>
  request(`${API_BASE}/creators/${encodeURIComponent(creatorId || "")}/albums`);

export const getCreatorVideos = (creatorId) =>
  request(`${API_BASE}/creators/${encodeURIComponent(creatorId || "")}/videos`);

export const archiveMyCreatorContent = () =>
  request(`${API_BASE}/creators/me/archive-content`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

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

export const initiatePayment = ({ itemType, itemId, provider = "paystack", returnUrl = "" }) =>
  request(`${API_BASE}/payments/initiate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ itemType, itemId, provider, returnUrl }),
  });

export const createCheckout = ({ itemType, itemId, currencyMode = "NG" }) =>
  request(`${API_BASE}/checkout/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ itemType, itemId, currencyMode }),
  });

export const getMyPurchases = () =>
  request(`${API_BASE}/purchases/my`, {
    headers: getAuthHeaders(),
  });

export const getCreatorSales = () =>
  request(`${API_BASE}/purchases/creator/sales`, {
    headers: getAuthHeaders(),
  });

export const getCreatorDashboard = () =>
  request(withCacheBust(`${API_BASE}/creator/dashboard`), {
    headers: getAuthHeaders(),
    cache: "no-store",
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
// ALBUMS
// ======================================================

export const createAlbumWithUploadProgress = (formData, { onProgress } = {}) =>
  uploadFormWithProgress({
    url: `${API_BASE}/creator/albums`,
    formData,
    onProgress,
    timeoutMs: 20 * 60 * 1000,
  });

export const updateAlbumWithUploadProgress = (albumId, formData, { onProgress } = {}) =>
  uploadFormWithProgress({
    url: `${API_BASE}/albums/${encodeURIComponent(albumId || "")}`,
    method: "PUT",
    formData,
    onProgress,
    timeoutMs: 20 * 60 * 1000,
  });

export const getAlbum = (albumId) =>
  request(`${API_BASE}/albums/${encodeURIComponent(albumId || "")}`, {
    headers: getAuthHeaders(),
  });

export const createMusicTrack = (formData, { onProgress } = {}) =>
  uploadFormWithProgress({
    url: `${API_BASE}/creator/music`,
    formData,
    onProgress,
    timeoutMs: 20 * 60 * 1000,
  });

export const createMusicAlbum = (formData, { onProgress } = {}) =>
  uploadFormWithProgress({
    url: `${API_BASE}/creator/music/albums`,
    formData,
    onProgress,
    timeoutMs: 20 * 60 * 1000,
  });

export const createCreatorVideoWithUploadProgress = (formData, { onProgress } = {}) =>
  uploadFormWithProgress({
    url: `${API_BASE}/videos`,
    formData,
    onProgress,
    timeoutMs: 30 * 60 * 1000,
  });

export const updateCreatorVideoWithUploadProgress = (videoId, formData, { onProgress } = {}) =>
  uploadFormWithProgress({
    url: `${API_BASE}/videos/${encodeURIComponent(videoId || "")}`,
    method: "PUT",
    formData,
    onProgress,
    timeoutMs: 30 * 60 * 1000,
  });

export const createMusicVideo = (formData, { onProgress } = {}) =>
  uploadFormWithProgress({
    url: `${API_BASE}/creator/music/videos`,
    formData,
    onProgress,
    timeoutMs: 30 * 60 * 1000,
  });

export const createPodcastEpisode = (formData, { onProgress } = {}) =>
  uploadFormWithProgress({
    url: `${API_BASE}/creator/podcasts`,
    formData,
    onProgress,
    timeoutMs: 30 * 60 * 1000,
  });

export const getMyEntitlementsForCreator = (creatorId) =>
  request(`${API_BASE}/entitlements/me?creatorId=${encodeURIComponent(creatorId || "")}`, {
    headers: getAuthHeaders(),
  });

export const getDownloadUrl = (itemType, itemId) =>
  request(`${API_BASE}/download/${encodeURIComponent(itemType || "")}/${encodeURIComponent(itemId || "")}`, {
    headers: getAuthHeaders(),
  });

export const getStreamUrl = (itemType, itemId) =>
  request(`${API_BASE}/stream/${encodeURIComponent(itemType || "")}/${encodeURIComponent(itemId || "")}`, {
    headers: getAuthHeaders(),
  });

export const getMyLibrary = () =>
  request(`${API_BASE}/library/me`, {
    headers: getAuthHeaders(),
  });

export const savePlayerProgress = (payload = {}) =>
  request(`${API_BASE}/player/progress`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
  });

export const getContinueListening = (creatorId) =>
  request(`${API_BASE}/player/continue-listening?creatorId=${encodeURIComponent(creatorId || "")}`, {
    headers: getAuthHeaders(),
  });

export const getNotificationPreferences = () =>
  request(`${API_BASE}/notifications/preferences/me`, {
    headers: getAuthHeaders(),
  });

export const updateNotificationPreferences = (payload) =>
  request(`${API_BASE}/notifications/preferences/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
  });

// ======================================================
// 🟢 POSTS
// ======================================================

export const getFeed = () =>
  request(`${API_BASE}/posts`, {
    headers: getAuthHeaders(),
  });

export const getDiscoveryHome = ({ limit = 24 } = {}) => {
  const params = new URLSearchParams();
  if (limit) {
    params.set("limit", String(limit));
  }

  return request(
    `${API_BASE}/discovery/home${params.toString() ? `?${params.toString()}` : ""}`,
    {
      headers: getAuthHeaders(),
    }
  );
};

export const trackDiscoveryEvents = ({ requestId = "", surface = "home", events = [] } = {}) =>
  request(`${API_BASE}/discovery/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      requestId,
      surface,
      events: Array.isArray(events) ? events : [],
    }),
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
    ["video", "reel"].includes(normalizedType) ||
    (video && typeof video === "object" && video.url);

  if (isVideoPost) {
    const body = {
      ...payload,
      type: normalizedType === "reel" ? "reel" : "video",
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
    visibility = "",
    privacy = "",
    sharedPost = null,
  } = payload;

  return compressImageFile(file).then((optimizedFile) => {
    const form = new FormData();
    form.append("text", text || "");
    if (optimizedFile) {
      form.append("file", optimizedFile);
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

    if (visibility) {
      form.append("visibility", String(visibility));
    }

    if (privacy) {
      form.append("privacy", String(privacy));
    }

    if (sharedPost && typeof sharedPost === "object") {
      form.append("sharedPost", JSON.stringify(sharedPost));
    }

    return request(`${API_BASE}/posts`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: form,
    });
  });
};

export const createBookWithUploadProgress = (formData, { onProgress } = {}) =>
  uploadFormWithProgress({
    url: `${API_BASE}/books`,
    formData,
    onProgress,
    timeoutMs: 20 * 60 * 1000,
  });

export const createCreatorBook = (formData, { onProgress } = {}) =>
  uploadFormWithProgress({
    url: `${API_BASE}/creator/books`,
    formData,
    onProgress,
    timeoutMs: 20 * 60 * 1000,
  });

export const updateBookWithUploadProgress = (bookId, formData, { onProgress } = {}) =>
  uploadFormWithProgress({
    url: `${API_BASE}/books/${encodeURIComponent(bookId || "")}`,
    method: "PUT",
    formData,
    onProgress,
    timeoutMs: 20 * 60 * 1000,
  });

export const createTrackWithUploadProgress = (formData, { onProgress } = {}) =>
  uploadFormWithProgress({
    url: `${API_BASE}/tracks`,
    formData,
    onProgress,
    timeoutMs: 20 * 60 * 1000,
  });

export const updateTrackWithUploadProgress = (trackId, formData, { onProgress } = {}) =>
  uploadFormWithProgress({
    url: `${API_BASE}/tracks/${encodeURIComponent(trackId || "")}`,
    method: "PUT",
    formData,
    onProgress,
    timeoutMs: 20 * 60 * 1000,
  });

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
    visibility = "",
    privacy = "",
    sharedPost = null,
  } = payload || {};

  const optimizedFile = await compressImageFile(file);
  const form = new FormData();
  form.append("text", text || "");
  if (optimizedFile) {
    form.append("file", optimizedFile);
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
  if (visibility) {
    form.append("visibility", String(visibility));
  }
  if (privacy) {
    form.append("privacy", String(privacy));
  }
  if (sharedPost && typeof sharedPost === "object") {
    form.append("sharedPost", JSON.stringify(sharedPost));
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
  request(`${API_BASE}/stories/feed`, {
    headers: getAuthHeaders(),
  });

export const createStory = (formData) =>
  request(`${API_BASE}/stories`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

export const createStoryWithUploadProgress = ({
  file,
  caption = "",
  visibility = "friends",
  onProgress,
  timeoutMs = 180000,
}) =>
  new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Choose a story file"));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/stories`);
    xhr.withCredentials = true;
    xhr.timeout = timeoutMs;

    const token = getSessionAccessToken();
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
        data?.error || data?.message || `Story upload failed (${xhr.status || 0})`
      );
      err.status = xhr.status || 0;
      reject(err);
    };

    xhr.onerror = () => reject(new Error("Network error during story upload"));
    xhr.ontimeout = () => reject(new Error("Story upload timeout"));
    xhr.onabort = () => reject(new Error("Story upload canceled"));

    const form = new FormData();
    form.append("media", file);
    if (caption) {
      form.append("caption", String(caption));
    }
    form.append("visibility", String(visibility || "friends"));
    xhr.send(form);
  });

export const markStorySeen = (storyId) =>
  request(`${API_BASE}/stories/${encodeURIComponent(storyId || "")}/seen`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

export const reactToStory = (storyId, emoji) =>
  request(`${API_BASE}/stories/${encodeURIComponent(storyId || "")}/react`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ emoji }),
  });

export const replyToStory = (storyId, text) =>
  request(`${API_BASE}/stories/${encodeURIComponent(storyId || "")}/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ text }),
  });

export const updateMyStatus = ({ text = "", emoji = "" }) =>
  request(`${API_BASE}/users/me/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ text, emoji }),
  });

export const getUserStatus = (userId) =>
  request(`${API_BASE}/users/${encodeURIComponent(userId || "")}/status`, {
    headers: getAuthHeaders(),
  });

export const getCloseFriends = () =>
  request(`${API_BASE}/users/me/close-friends`, {
    headers: getAuthHeaders(),
  });

export const updateCloseFriends = ({ add = [], remove = [] }) =>
  request(`${API_BASE}/users/me/close-friends`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ add, remove }),
  });

export const getMyStreaks = () =>
  request(`${API_BASE}/users/me/streaks`, {
    headers: getAuthHeaders(),
  });

export const submitDailyCheckIn = (text = "") =>
  request(`${API_BASE}/checkin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ text }),
  });

export const getRooms = () =>
  request(`${API_BASE}/rooms`, {
    headers: getAuthHeaders(),
  });

export const createRoom = (payload) =>
  request(`${API_BASE}/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
  });

export const joinRoom = (roomId) =>
  request(`${API_BASE}/rooms/${encodeURIComponent(roomId || "")}/join`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

export const leaveRoom = (roomId) =>
  request(`${API_BASE}/rooms/${encodeURIComponent(roomId || "")}/leave`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

export const searchGlobal = ({ q = "", type = "users" } = {}) =>
  request(
    `${API_BASE}/search?q=${encodeURIComponent(q || "")}&type=${encodeURIComponent(type || "users")}`,
    {
      headers: getAuthHeaders(),
    }
  );

export const getTrendingHashtags = () =>
  request(`${API_BASE}/search/trending/hashtags`, {
    headers: getAuthHeaders(),
  });

export const getSearchSuggestions = () =>
  request(`${API_BASE}/search/suggestions`, {
    headers: getAuthHeaders(),
  });

export const createReport = (payload) =>
  request(`${API_BASE}/reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
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

export const unsendChatMessage = (messageId) =>
  request(`${API_BASE}/messages/${encodeURIComponent(messageId || "")}/unsend`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });

export const reactToChatMessage = (messageId, emoji) =>
  request(`${API_BASE}/messages/${encodeURIComponent(messageId || "")}/react`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ emoji }),
  });

// ======================================================
// ADMIN
// ======================================================

export const adminListUsers = ({ search = "", page = 1, limit = 20, role = "", banned = "" } = {}) => {
  const params = new URLSearchParams();
  if (search) {params.set("search", String(search));}
  if (page) {params.set("page", String(page));}
  if (limit) {params.set("limit", String(limit));}
  if (role) {params.set("role", String(role));}
  if (banned !== "") {params.set("banned", String(banned));}
  return request(`${API_BASE}/admin/users?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
};

export const adminGetUser = (userId) =>
  request(`${API_BASE}/admin/users/${encodeURIComponent(userId || "")}`, {
    headers: getAuthHeaders(),
  });

export const adminUpdateUser = (userId, payload = {}) =>
  request(`${API_BASE}/admin/users/${encodeURIComponent(userId || "")}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
  });

export const adminBanUser = (userId, reason) =>
  request(`${API_BASE}/admin/users/${encodeURIComponent(userId || "")}/ban`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ reason }),
  });

export const adminUnbanUser = (userId, reason = "") =>
  request(`${API_BASE}/admin/users/${encodeURIComponent(userId || "")}/unban`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ reason }),
  });

export const adminForceLogoutUser = (userId, reason = "") =>
  request(`${API_BASE}/admin/users/${encodeURIComponent(userId || "")}/force-logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ reason }),
  });

export const adminResetPasswordUser = (userId, reason = "") =>
  request(`${API_BASE}/admin/users/${encodeURIComponent(userId || "")}/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ reason }),
  });

export const adminSoftDeleteUser = (userId, reason = "") =>
  request(`${API_BASE}/admin/users/${encodeURIComponent(userId || "")}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ reason }),
  });

export const adminGetAuditLogs = ({ page = 1, limit = 30, action = "", targetType = "" } = {}) => {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  if (action) {params.set("action", String(action));}
  if (targetType) {params.set("targetType", String(targetType));}
  return request(`${API_BASE}/admin/audit-logs?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
};

export const adminListReports = ({ page = 1, limit = 20, status = "" } = {}) => {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  if (status) {params.set("status", String(status));}
  return request(`${API_BASE}/admin/reports?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
};

export const adminGetModerationStats = () =>
  request(`${API_BASE}/moderation/stats`, {
    headers: getAuthHeaders(),
  });

export const adminListModerationCases = ({
  page = 1,
  limit = 20,
  queue = "",
  status = "",
  workflowState = "",
  severity = "",
  search = "",
  critical = false,
} = {}) => {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  if (queue) {params.set("queue", String(queue));}
  if (status) {params.set("status", String(status));}
  if (workflowState) {params.set("workflowState", String(workflowState));}
  if (severity) {params.set("severity", String(severity));}
  if (search) {params.set("search", String(search));}
  if (critical) {params.set("critical", "true");}
  return request(`${API_BASE}/moderation/queue?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
};

export const adminGetModerationCase = (caseId) =>
  request(`${API_BASE}/moderation/cases/${encodeURIComponent(caseId || "")}`, {
    headers: getAuthHeaders(),
  });

export const adminGetModerationUploader = (caseId) =>
  request(`${API_BASE}/moderation/cases/${encodeURIComponent(caseId || "")}/uploader`, {
    headers: getAuthHeaders(),
  });

export const adminGetModerationReviewUrl = (caseId, payload = {}) =>
  request(`${API_BASE}/moderation/cases/${encodeURIComponent(caseId || "")}/review-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
  });

export const adminApplyModerationAction = (caseId, action, payload = {}) =>
  request(`${API_BASE}/moderation/cases/${encodeURIComponent(caseId || "")}/actions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      action,
      ...(payload || {}),
    }),
  });

export const adminRunModerationScan = (payload = {}) =>
  request(`${API_BASE}/moderation/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
  });

export const adminGetModerationAuditLogs = ({ page = 1, limit = 30, action = "", caseId = "" } = {}) => {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  if (action) {params.set("action", String(action));}
  if (caseId) {params.set("caseId", String(caseId));}
  return request(`${API_BASE}/moderation/audit-logs?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
};

export const adminGetReport = (reportId) =>
  request(`${API_BASE}/admin/reports/${encodeURIComponent(reportId || "")}`, {
    headers: getAuthHeaders(),
  });

export const adminUpdateReport = (reportId, payload = {}) =>
  request(`${API_BASE}/admin/reports/${encodeURIComponent(reportId || "")}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
  });

export const adminModerationAction = (payload = {}) =>
  request(`${API_BASE}/admin/moderation/action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
  });

export const adminGetDashboard = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  return request(`${API_BASE}/admin/dashboard?${query.toString()}`, {
    headers: getAuthHeaders(),
    timeoutMs: 45000,
  });
};

export const adminGetAnalyticsOverview = (params = {}) => {
  const query = new URLSearchParams();
  if (typeof params === "string") {
    query.set("range", params);
  } else {
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {query.set(key, String(value));}
    });
  }
  return request(`${API_BASE}/admin/analytics/overview?${query.toString()}`, {
    headers: getAuthHeaders(),
    timeoutMs: 45000,
  });
};

export const adminGetAnalyticsUserGrowth = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {query.set(key, String(value));}
  });
  return request(`${API_BASE}/admin/analytics/user-growth?${query.toString()}`, {
    headers: getAuthHeaders(),
    timeoutMs: 45000,
  });
};

export const adminGetAnalyticsContentUploads = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {query.set(key, String(value));}
  });
  return request(`${API_BASE}/admin/analytics/content-uploads?${query.toString()}`, {
    headers: getAuthHeaders(),
    timeoutMs: 45000,
  });
};

export const adminGetAnalyticsRevenue = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {query.set(key, String(value));}
  });
  return request(`${API_BASE}/admin/analytics/revenue?${query.toString()}`, {
    headers: getAuthHeaders(),
    timeoutMs: 45000,
  });
};

export const adminGetAnalyticsEngagement = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {query.set(key, String(value));}
  });
  return request(`${API_BASE}/admin/analytics/engagement?${query.toString()}`, {
    headers: getAuthHeaders(),
    timeoutMs: 45000,
  });
};

export const adminGetMessagesOverview = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {query.set(key, String(value));}
  });
  return request(`${API_BASE}/admin/messages/overview?${query.toString()}`, {
    headers: getAuthHeaders(),
    timeoutMs: 45000,
  });
};

export const adminGetAnalyticsTopCreators = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {query.set(key, String(value));}
  });
  return request(`${API_BASE}/admin/analytics/top-creators?${query.toString()}`, {
    headers: getAuthHeaders(),
    timeoutMs: 45000,
  });
};

export const adminGetAnalyticsTopContent = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {query.set(key, String(value));}
  });
  return request(`${API_BASE}/admin/analytics/top-content?${query.toString()}`, {
    headers: getAuthHeaders(),
    timeoutMs: 45000,
  });
};

export const adminGetAnalyticsRecentActivity = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {query.set(key, String(value));}
  });
  return request(`${API_BASE}/admin/analytics/recent-activity?${query.toString()}`, {
    headers: getAuthHeaders(),
    timeoutMs: 45000,
  });
};

export const adminGetAnalyticsSystemAlerts = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {query.set(key, String(value));}
  });
  return request(`${API_BASE}/admin/analytics/system-alerts?${query.toString()}`, {
    headers: getAuthHeaders(),
    timeoutMs: 45000,
  });
};

export const adminGetAnalyticsReportsSummary = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {query.set(key, String(value));}
  });
  return request(`${API_BASE}/admin/analytics/reports-summary?${query.toString()}`, {
    headers: getAuthHeaders(),
    timeoutMs: 45000,
  });
};

export const adminListContent = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {query.set(key, String(value));}
  });
  return request(`${API_BASE}/admin/content?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
};

export const adminListTransactions = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {query.set(key, String(value));}
  });
  return request(`${API_BASE}/admin/transactions?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
};

export const adminGetCreatorEarningsRepository = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {query.set(key, String(value));}
  });
  return request(`${API_BASE}/admin/finance/creator-earnings?${query.toString()}`, {
    headers: getAuthHeaders(),
    timeoutMs: 45000,
  });
};

export const adminGetCreatorDetail = (creatorId) =>
  request(`${API_BASE}/admin/creators/${encodeURIComponent(creatorId || "")}`, {
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
