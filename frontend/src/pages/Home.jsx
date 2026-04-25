import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";

import PostSkeleton from "../components/PostSkeleton";
import PostCard from "../components/PostCard";
import NewsClusterCard from "../features/news/components/NewsClusterCard";
import NewsDetailDrawer from "../features/news/components/NewsDetailDrawer";
import NewsStoryCard from "../features/news/components/NewsStoryCard";
import { useNewsFeed } from "../features/news/hooks/useNewsFeed";
import { useNewsPreferences } from "../features/news/hooks/useNewsPreferences";
import CreatorSummaryFeed from "../components/creatorDiscovery/CreatorSummaryFeed";

import Navbar from "../Navbar";
import Sidebar from "../Sidebar";
import Messenger from "../Messenger";
import FriendRequests from "../FriendRequests";
import RightQuickNav from "../components/RightQuickNav";
import Stories from "../stories/StoriesBar";
import { connectSocket } from "../socket";

import {
  createPost,
  createPostWithUploadProgress,
  getFeed,
  getProfile,
  getUsers,
  muteUser,
  resolveImage,
  toggleFollowCreator,
  trackDiscoveryEvents,
} from "../api";

const FEELING_OPTIONS = [
  "Blessed",
  "Excited",
  "Grateful",
  "Inspired",
  "Focused",
  "Relaxed",
  "Proud",
  "Ready",
];

const MORE_OPTIONS = [
  { id: "audience-question", label: "Audience question" },
  { id: "highlight-post", label: "Highlight post" },
  { id: "share-to-story", label: "Share to story" },
];

const INITIAL_VISIBLE_POSTS = 10;
const LOAD_MORE_INCREMENT = 8;
const DISCOVERY_BATCH_DELAY_MS = 1400;
const FEED_AUTO_REFRESH_MS = 5 * 60 * 1000;
const HOME_NEWS_INTERVAL = Math.max(
  1,
  Number(import.meta.env.VITE_HOME_NEWS_INJECTION_INTERVAL || 8)
);

const normalizeHandle = (value = "") =>
  String(value || "").trim().replace(/^@+/, "").replace(/\s+/g, "").toLowerCase().slice(0, 30);

const buildTaggedPerson = (value = {}) => {
  const userId = String(value?.userId || value?._id || value?.id || "").trim();
  const name = String(value?.name || "").trim();
  const username = normalizeHandle(value?.username || value?.handle);
  const avatar = resolveImage(value?.avatar || value?.profilePic || "") || "";

  if (!userId && !name && !username) {
    return null;
  }

  return {
    userId,
    name,
    username,
    avatar,
    relationship: value?.relationship || null,
  };
};

const getTaggedPersonKey = (person = {}) =>
  String(person?.userId || person?.username || person?.name || "").trim();

const getTaggedPersonLabel = (person = {}) => {
  const name = String(person?.name || "").trim();
  const username = normalizeHandle(person?.username);

  if (name && username) {
    return `${name} @${username}`;
  }

  if (name) {
    return name;
  }

  if (username) {
    return `@${username}`;
  }

  return "";
};

const parseManualTaggedPerson = (value = "") => {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const handleMatch = text.match(/@([a-zA-Z0-9._]{3,30})/);
  if (!handleMatch) {
    return null;
  }

  const username = normalizeHandle(handleMatch[1]);
  const name = text.replace(handleMatch[0], "").replace(/\s+/g, " ").trim();
  if (!name || !username) {
    return null;
  }

  return buildTaggedPerson({ name, username });
};

const isBirthdayToday = (birthday = {}) => {
  const day = Number(birthday?.day) || 0;
  const month = Number(birthday?.month) || 0;
  if (!day || !month) {return false;}
  const now = new Date();
  return now.getDate() === day && now.getMonth() + 1 === month;
};

const createFeedEntry = (post, discoveryMeta = null) => ({
  key: String(post?._id || discoveryMeta?.entityId || ""),
  post,
  discoveryMeta,
});

const normalizeLegacyFeedItems = (posts = []) =>
  (Array.isArray(posts) ? posts : [])
    .filter((post) => post?._id)
    .map((post) => createFeedEntry(post));

const normalizeDiscoveryFeedItems = (payload = {}) => {
  const requestId = String(payload?.requestId || "").trim();

  return (Array.isArray(payload?.items) ? payload.items : [])
    .filter((item) => item?.entityType === "post" && item?.payload?._id)
    .map((item) =>
      createFeedEntry(item.payload, {
        requestId,
        entityId: String(item.id || item?.payload?._id || "").trim(),
        entityType: String(item.entityType || "post").trim().toLowerCase(),
        rank: Number(item.rank || 0),
        reason: String(item.reason || "").trim(),
        reasonLabel: String(item.reasonLabel || "").trim(),
        creatorId: String(item.creatorId || "").trim(),
        authorUserId: String(item.authorUserId || item?.payload?.user?._id || "").trim(),
        viewerFollowsCreator: Boolean(item.viewerFollowsCreator),
      })
    );
};

const injectNewsCards = (postEntries = [], newsCards = [], interval = HOME_NEWS_INTERVAL) => {
  const result = [];
  const posts = Array.isArray(postEntries) ? postEntries : [];
  const cards = Array.isArray(newsCards) ? newsCards : [];
  let newsIndex = 0;

  posts.forEach((entry, index) => {
    result.push({ type: "post", entry, key: `post-${entry?.key || index}` });
    if ((index + 1) % interval === 0 && cards[newsIndex]) {
      const card = cards[newsIndex];
      result.push({
        type: "news",
        card,
        key: `news-${card?.id || newsIndex}`,
      });
      newsIndex += 1;
    }
  });

  return result;
};

function ComposerIcon({ name }) {
  const icons = {
    media: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="1.2" y="1.2" width="21.6" height="21.6" rx="5.4" fill="#38c976" />
        <rect x="4.8" y="5.8" width="14.4" height="12" rx="2.2" fill="#defce8" />
        <circle cx="9.2" cy="9.7" r="1.5" fill="#3ab368" />
        <path d="M5.8 17.1l3.8-3.5 2.7 2.3 2-1.7 2.9 2.9H5.8z" fill="#239153" />
      </svg>
    ),
    tag: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10.8" fill="#e7f0ff" />
        <circle cx="9.7" cy="9.1" r="2.6" fill="#2f88ff" />
        <circle cx="15.2" cy="10" r="2.1" fill="#5ba3ff" />
        <path d="M5.6 17.8c.8-2.5 2.8-4 5-4 2.2 0 4.1 1.5 5 4v.4h-10z" fill="#2f88ff" />
        <path d="M13.2 18c.6-1.8 1.8-2.9 3.4-2.9 1 0 1.9.4 2.7 1.2v1.7z" fill="#5ba3ff" />
      </svg>
    ),
    feeling: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10.6" fill="#ffc93f" />
        <circle cx="8.8" cy="10" r="1.2" fill="#9f6500" />
        <circle cx="15.2" cy="10" r="1.2" fill="#9f6500" />
        <circle cx="7.2" cy="13.2" r="1.3" fill="#ffb25f" />
        <circle cx="16.8" cy="13.2" r="1.3" fill="#ffb25f" />
        <path
          d="M8.2 14.5c1 1.2 2.3 1.8 3.8 1.8s2.8-.6 3.8-1.8"
          stroke="#9f6500"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
    location: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 22s6.4-5.6 6.4-11a6.4 6.4 0 1 0-12.8 0c0 5.4 6.4 11 6.4 11z" fill="#ff5f58" />
        <circle cx="12" cy="11" r="2.3" fill="#fff" />
      </svg>
    ),
    call: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10.8" fill="#3f8dff" />
        <path
          d="M8 7h2.5l1.1 2.9-1.4 1.3a8.8 8.8 0 0 0 2.6 2.6l1.3-1.4 2.9 1.1V16c0 .8-.7 1.5-1.5 1.5a9.7 9.7 0 0 1-9-9A1.5 1.5 0 0 1 8 7z"
          fill="#fff"
        />
      </svg>
    ),
    more: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10.8" fill="#eef2f7" />
        <circle cx="8" cy="12" r="1.5" fill="#5d6675" />
        <circle cx="12" cy="12" r="1.5" fill="#5d6675" />
        <circle cx="16" cy="12" r="1.5" fill="#5d6675" />
      </svg>
    ),
  };

  return <span className="composer-icon">{icons[name] || icons.more}</span>;
}

const POST_COMPOSER_MAX_MEDIA_FILES = 10;
const POST_COMPOSER_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const POST_COMPOSER_MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const POST_COMPOSER_ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

const formatComposerMediaSize = (bytes = 0) => {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return "";
  }
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }
  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${size} B`;
};

export function PostComposerModal({
  user,
  onClose,
  onPosted,
  initialFile = null,
  initialFiles = [],
  initialMode = "",
}) {
  const isReelMode = initialMode === "reel";
  const normalizedInitialFiles = useMemo(() => {
    if (Array.isArray(initialFiles) && initialFiles.length > 0) {
      return initialFiles.filter(Boolean);
    }
    return initialFile ? [initialFile] : [];
  }, [initialFile, initialFiles]);

  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedPreviews, setSelectedPreviews] = useState([]);
  const [activePanel, setActivePanel] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [taggedPeople, setTaggedPeople] = useState([]);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [tagSearchBusy, setTagSearchBusy] = useState(false);
  const [tagSearchError, setTagSearchError] = useState("");
  const [feeling, setFeeling] = useState("");
  const [checkInLocation, setCheckInLocation] = useState("");
  const [callsEnabled, setCallsEnabled] = useState(false);
  const [callNumber, setCallNumber] = useState("");
  const [moreOptions, setMoreOptions] = useState(
    MORE_OPTIONS.reduce((acc, option) => ({ ...acc, [option.id]: false }), {})
  );
  const [mediaError, setMediaError] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [mediaUploadProgress, setMediaUploadProgress] = useState(0);
  const [mediaUploadError, setMediaUploadError] = useState("");
  const boxRef = useRef(null);
  const fileRef = useRef(null);
  const selectedPreviewsRef = useRef([]);

  const revokePreviewItems = useCallback((items = []) => {
    (Array.isArray(items) ? items : []).forEach((item) => {
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
  }, []);

  const buildPreviewItems = useCallback(
    (files = []) =>
      (Array.isArray(files) ? files : []).map((file, index) => ({
        id: [
          file?.name || "upload",
          file?.lastModified || 0,
          file?.size || 0,
          index,
        ].join("-"),
        file,
        previewUrl: URL.createObjectURL(file),
        type: String(file?.type || "").startsWith("video/") ? "video" : "image",
        name: file?.name || (String(file?.type || "").startsWith("video/") ? "Video" : "Image"),
        size: Number(file?.size || 0),
      })),
    []
  );

  const replaceSelectedMedia = useCallback(
    (files = []) => {
      const nextFiles = (Array.isArray(files) ? files : []).filter(Boolean);
      setSelectedFiles(nextFiles);
      setSelectedPreviews((current) => {
        revokePreviewItems(current);
        return buildPreviewItems(nextFiles);
      });
    },
    [buildPreviewItems, revokePreviewItems]
  );

  useEffect(() => {
    selectedPreviewsRef.current = selectedPreviews;
  }, [selectedPreviews]);

  useEffect(
    () => () => {
      revokePreviewItems(selectedPreviewsRef.current);
    },
    [revokePreviewItems]
  );

  useEffect(() => {
    if (normalizedInitialFiles.length === 0) {
      return;
    }
    replaceSelectedMedia(normalizedInitialFiles);
    setError("");
    setMediaError("");
    setActivePanel("");
  }, [normalizedInitialFiles, replaceSelectedMedia]);

  useEffect(() => {
    if (initialMode !== "reel") {
      return;
    }
    const timer = window.setTimeout(() => fileRef.current?.click(), 70);
    return () => window.clearTimeout(timer);
  }, [initialMode]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const selectedMore = useMemo(
    () =>
      MORE_OPTIONS.filter((option) => moreOptions[option.id]).map(
        (option) => option.label
      ),
    [moreOptions]
  );
  const manualTagCandidate = useMemo(() => parseManualTaggedPerson(tagInput), [tagInput]);

  const hasMetadata = Boolean(
    taggedPeople.length ||
    feeling ||
    checkInLocation.trim() ||
    selectedMore.length ||
    (callsEnabled && callNumber.trim())
  );
  const hasSelectedVideo = selectedFiles.some((file) =>
    String(file?.type || "").startsWith("video/")
  );
  const mediaSelectionCount = selectedFiles.length;
  const mediaSelectionCounter = isReelMode
    ? `${mediaSelectionCount ? "1" : "0"}/1 selected`
    : `${mediaSelectionCount}/${POST_COMPOSER_MAX_MEDIA_FILES} selected`;
  const canSubmit = isReelMode
    ? mediaSelectionCount === 1 && hasSelectedVideo
    : Boolean(text.trim() || mediaSelectionCount > 0 || hasMetadata);

  useEffect(() => {
    if (activePanel !== "tag") {
      setTagSuggestions([]);
      setTagSearchBusy(false);
      setTagSearchError("");
      return;
    }

    const query = tagInput.trim();
    if (query.length < 2) {
      setTagSuggestions([]);
      setTagSearchBusy(false);
      setTagSearchError("");
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setTagSearchBusy(true);
      setTagSearchError("");

      try {
        const rows = await getUsers(query);
        if (cancelled) {
          return;
        }

        const nextSuggestions = (Array.isArray(rows) ? rows : [])
          .map((entry) => buildTaggedPerson(entry))
          .filter(Boolean)
          .filter(
            (entry) =>
              !taggedPeople.some(
                (current) => getTaggedPersonKey(current) === getTaggedPersonKey(entry)
              )
          )
          .slice(0, 8);

        setTagSuggestions(nextSuggestions);
      } catch (err) {
        if (!cancelled) {
          setTagSuggestions([]);
          setTagSearchError(err?.message || "Could not search people right now.");
        }
      } finally {
        if (!cancelled) {
          setTagSearchBusy(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activePanel, tagInput, taggedPeople]);

  const addTaggedPerson = (value) => {
    const nextPerson = buildTaggedPerson(value);
    const nextKey = getTaggedPersonKey(nextPerson);
    if (!nextPerson || !nextKey) {
      return;
    }

    setTaggedPeople((current) =>
      current.some((entry) => getTaggedPersonKey(entry) === nextKey)
        ? current
        : [...current, nextPerson]
    );
    setTagInput("");
    setTagSuggestions([]);
    setTagSearchError("");
  };

  const addTag = () => {
    if (tagSuggestions.length > 0) {
      addTaggedPerson(tagSuggestions[0]);
      return;
    }

    if (manualTagCandidate) {
      addTaggedPerson(manualTagCandidate);
      return;
    }

    setTagSearchError("Use the person's name and @handle, or choose from the list.");
  };

  const removeTag = (personKey) => {
    setTaggedPeople((current) =>
      current.filter((entry) => getTaggedPersonKey(entry) !== personKey)
    );
  };

  const toggleMore = (id) => {
    setMoreOptions((current) => ({ ...current, [id]: !current[id] }));
  };

  const validatePickedFile = useCallback(
    (file) => {
      if (!file) {
        return "Choose a photo or video to continue.";
      }

      const mimeType = String(file.type || "").toLowerCase();
      const isVideo = mimeType.startsWith("video/");
      const isImage = mimeType.startsWith("image/");

      if (isReelMode && !isVideo) {
        return "Reels must be uploaded as MP4, MOV, or WebM video.";
      }

      if (!isImage && !isVideo) {
        return "Only images, MP4, MOV, and WebM videos are supported.";
      }

      if (isVideo) {
        if (!POST_COMPOSER_ALLOWED_VIDEO_TYPES.has(mimeType)) {
          return "Only MP4, MOV, and WebM videos are supported.";
        }
        if ((Number(file.size) || 0) > POST_COMPOSER_MAX_VIDEO_BYTES) {
          return "Video exceeds maximum allowed size (100MB).";
        }
      }

      if (isImage && (Number(file.size) || 0) > POST_COMPOSER_MAX_IMAGE_BYTES) {
        return "Image exceeds maximum allowed size (10MB).";
      }

      return "";
    },
    [isReelMode]
  );

  const addPickedFiles = useCallback(
    (incomingFiles = []) => {
      const nextFiles = (Array.isArray(incomingFiles) ? incomingFiles : []).filter(Boolean);
      if (nextFiles.length === 0) {
        return false;
      }

      if (isReelMode) {
        if (mediaSelectionCount + nextFiles.length > 1) {
          setMediaError("Reels support one video upload at a time.");
          return false;
        }
      } else if (mediaSelectionCount + nextFiles.length > POST_COMPOSER_MAX_MEDIA_FILES) {
        setMediaError("You can attach up to 10 photos or videos to one post.");
        return false;
      }

      for (const file of nextFiles) {
        const validationMessage = validatePickedFile(file);
        if (validationMessage) {
          setMediaError(validationMessage);
          return false;
        }
      }

      const mergedFiles = isReelMode ? [nextFiles[0]] : [...selectedFiles, ...nextFiles];
      replaceSelectedMedia(mergedFiles);
      setError("");
      setMediaError("");
      setActivePanel("");
      setMediaUploadError("");
      setMediaUploadProgress(0);
      return true;
    },
    [
      isReelMode,
      mediaSelectionCount,
      replaceSelectedMedia,
      selectedFiles,
      validatePickedFile,
    ]
  );

  const handleFileChange = (event) => {
    const nextFiles = Array.from(event.target.files || []);
    event.target.value = "";
    addPickedFiles(nextFiles);
  };

  const removeSelectedMedia = (indexToRemove) => {
    setSelectedFiles((current) => current.filter((_, index) => index !== indexToRemove));
    setSelectedPreviews((current) => {
      const removedItem = current[indexToRemove];
      if (removedItem?.previewUrl) {
        URL.revokeObjectURL(removedItem.previewUrl);
      }
      return current.filter((_, index) => index !== indexToRemove);
    });
    setMediaError("");
    setMediaUploadError("");
    setMediaUploadProgress(0);
  };

  const openAction = (panel) => {
    if (panel === "media") {
      fileRef.current?.click();
      return;
    }

    setActivePanel((current) => (current === panel ? "" : panel));
  };

  const handleMediaPost = async () => {
    if (selectedFiles.length === 0) {
      throw new Error(isReelMode ? "Select a video before publishing." : "Select media before posting.");
    }

    if (isReelMode && (selectedFiles.length !== 1 || !hasSelectedVideo)) {
      throw new Error("Reels support one MP4, MOV, or WebM video.");
    }

    setIsUploadingMedia(true);
    setMediaUploadError("");
    try {
      const created = await createPostWithUploadProgress(
        {
          text: text.trim(),
          type: isReelMode ? "reel" : hasSelectedVideo ? "video" : "",
          files: selectedFiles,
          tags: taggedPeople,
          feeling,
          location: checkInLocation.trim(),
          callsEnabled,
          callNumber: callNumber.trim(),
          moreOptions: selectedMore,
        },
        {
          onProgress: setMediaUploadProgress,
          retries: 2,
          timeoutMs: 10 * 60 * 1000,
        }
      );

      replaceSelectedMedia([]);
      setMediaUploadProgress(0);
      return created;
    } catch (err) {
      setMediaUploadError(err?.message || "Media upload failed.");
      throw err;
    } finally {
      setIsUploadingMedia(false);
      setMediaUploadProgress(0);
    }
  };

  const submit = async () => {
    if (!canSubmit || isSubmitting || isUploadingMedia) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      setMediaError("");
      setMediaUploadError("");

      let createdPost;

      if (selectedFiles.length > 0) {
        createdPost = await handleMediaPost();
      } else {
        createdPost = await createPost({
          text: text.trim(),
          tags: taggedPeople,
          feeling,
          location: checkInLocation.trim(),
          callsEnabled,
          callNumber: callNumber.trim(),
          moreOptions: selectedMore,
        });
      }

      onPosted(createdPost);
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to create post.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeBadges = [
    ...taggedPeople.map((person) => ({
      key: `tag-${getTaggedPersonKey(person)}`,
      label: getTaggedPersonLabel(person),
    })),
    ...(feeling ? [{ key: "feeling", label: `Feeling ${feeling}` }] : []),
    ...(checkInLocation.trim()
      ? [{ key: "location", label: `Check-in ${checkInLocation.trim()}` }]
      : []),
    ...(callsEnabled && callNumber.trim()
      ? [{ key: "calls", label: `Call ${callNumber.trim()}` }]
      : []),
    ...selectedMore.map((label) => ({ key: `more-${label}`, label })),
  ];

  const renderActionPanel = () => {
    if (!activePanel) {
      return null;
    }

    if (activePanel === "tag") {
      return (
        <div className="composer-panel">
          <p>Tag people</p>
          <span className="composer-panel-hint">
            Tag friends or anyone else by searching their name or typing their full
            name with an @handle.
          </span>
          <div className="composer-panel-row">
            <input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addTag();
                }
              }}
              placeholder="Search by name or @handle"
            />
            <button type="button" className="btn-secondary" onClick={addTag}>
              Add
            </button>
          </div>
          {tagSearchBusy && <div className="composer-tag-empty">Searching people...</div>}
          {!tagSearchBusy && tagSearchError && (
            <div className="composer-tag-empty error">{tagSearchError}</div>
          )}
          {!tagSearchBusy && tagSuggestions.length > 0 && (
            <div className="composer-tag-results">
              {tagSuggestions.map((person) => (
                <button
                  key={getTaggedPersonKey(person)}
                  type="button"
                  className="composer-tag-result"
                  onClick={() => addTaggedPerson(person)}
                >
                  <img
                    className="composer-tag-avatar"
                    src={person.avatar || "/avatar.png"}
                    alt={person.name || person.username || "User"}
                  />
                  <span className="composer-tag-copy">
                    <strong>{person.name || `@${person.username}`}</strong>
                    {person.username && <span>@{person.username}</span>}
                  </span>
                  <span
                    className={`composer-tag-status ${
                      person.relationship?.isFriend ? "friend" : ""
                    }`}
                  >
                    {person.relationship?.isFriend ? "Friend" : "Profile"}
                  </span>
                </button>
              ))}
            </div>
          )}
          {!tagSearchBusy && !tagSuggestions.length && manualTagCandidate && (
            <button
              type="button"
              className="composer-tag-result composer-tag-result--manual"
              onClick={() => addTaggedPerson(manualTagCandidate)}
            >
              <span className="composer-tag-copy">
                <strong>{manualTagCandidate.name}</strong>
                <span>@{manualTagCandidate.username}</span>
              </span>
              <span className="composer-tag-status">Tag this person</span>
            </button>
          )}
          {taggedPeople.length > 0 && (
            <div className="composer-chip-row">
              {taggedPeople.map((person) => (
                <button
                  key={getTaggedPersonKey(person)}
                  type="button"
                  className="composer-chip removable"
                  onClick={() => removeTag(getTaggedPersonKey(person))}
                >
                  {getTaggedPersonLabel(person)} x
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activePanel === "feeling") {
      return (
        <div className="composer-panel">
          <p>Feeling / Activity</p>
          <div className="composer-grid">
            {FEELING_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`composer-grid-item ${feeling === option ? "active" : ""}`}
                onClick={() => setFeeling((current) => (current === option ? "" : option))}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (activePanel === "checkin") {
      return (
        <div className="composer-panel">
          <p>Check-In</p>
          <div className="composer-panel-row">
            <input
              value={checkInLocation}
              onChange={(event) => setCheckInLocation(event.target.value)}
              placeholder="Enter place or neighborhood"
            />
          </div>
        </div>
      );
    }

    if (activePanel === "calls") {
      return (
        <div className="composer-panel">
          <p>Get Calls</p>
          <label className="composer-toggle">
            <input
              type="checkbox"
              checked={callsEnabled}
              onChange={(event) => setCallsEnabled(event.target.checked)}
            />
            <span>Allow people to call you from this post</span>
          </label>
          {callsEnabled && (
            <div className="composer-panel-row">
              <input
                value={callNumber}
                onChange={(event) => setCallNumber(event.target.value)}
                placeholder="Enter phone number"
              />
            </div>
          )}
        </div>
      );
    }

    if (activePanel === "more") {
      return (
        <div className="composer-panel">
          <p>More options</p>
          <div className="composer-grid">
            {MORE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`composer-grid-item ${
                  moreOptions[option.id] ? "active" : ""
                }`}
                onClick={() => toggleMore(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="pc-overlay">
      <div
        className="pc-modal composer-modal"
        ref={boxRef}
        role="dialog"
        aria-modal="true"
      >
        <div className="pc-header composer-header">
          <h3>{isReelMode ? "Create reel" : "Create post"}</h3>
          <button className="pc-close" onClick={onClose} aria-label="Close">
            <span className="icon-glyph-center">X</span>
          </button>
        </div>

        <div className="pc-user">
          <img
            src={resolveImage(user?.avatar) || "/avatar.png"}
            className="pc-avatar"
            alt={user?.username || "You"}
          />
          <div className="pc-user-meta">
            <div className="pc-name">{user?.username}</div>
            <button className="pc-privacy" type="button">
              Public
            </button>
          </div>
        </div>

        <textarea
          className="pc-textarea composer-textarea"
          placeholder={
            isReelMode
              ? `Write a caption for your reel, ${user?.username || ""}...`
              : `What's on your mind, ${user?.username || ""}?`
          }
          value={text}
          onChange={(event) => setText(event.target.value)}
          autoFocus
        />

        {activeBadges.length > 0 && (
          <div className="composer-chip-row">
            {activeBadges.map((badge) => (
              <span key={badge.key} className="composer-chip">
                {badge.label}
              </span>
            ))}
          </div>
        )}

        {selectedPreviews.length > 0 && (
          <div className="composer-preview">
            <div className="composer-preview-header">
              <strong>{isReelMode ? "Video ready" : "Selected media"}</strong>
              <span>{mediaSelectionCounter}</span>
            </div>

            <div
              className={`composer-preview-grid ${
                selectedPreviews.length === 1 ? "composer-preview-grid--single" : ""
              }`}
            >
              {selectedPreviews.map((preview, index) => (
                <div
                  key={preview.id}
                  className={`composer-preview-item composer-preview-item--${preview.type}`}
                >
                  {preview.type === "video" ? (
                    <video src={preview.previewUrl} controls muted preload="metadata" />
                  ) : (
                    <img src={preview.previewUrl} alt={preview.name || "Selected media preview"} />
                  )}

                  <div className="composer-preview-item__meta">
                    <span title={preview.name}>{preview.name}</span>
                    <small>{formatComposerMediaSize(preview.size)}</small>
                  </div>

                  <button
                    type="button"
                    className="composer-remove-media"
                    onClick={() => removeSelectedMedia(index)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {(isUploadingMedia || mediaUploadProgress > 0) && (
              <div className="composer-video-progress">
                <div
                  className="composer-video-progress-bar"
                  style={{ width: `${Math.min(mediaUploadProgress, 100)}%` }}
                />
                <span>
                  {isUploadingMedia
                    ? `Uploading media (${mediaUploadProgress}%)`
                    : "Preparing media..."}
                </span>
              </div>
            )}

            {mediaUploadError && (
              <p className="composer-error composer-error--inline">
                {mediaUploadError}
              </p>
            )}
          </div>
        )}

        {renderActionPanel()}

        {mediaError && <p className="composer-error">{mediaError}</p>}
        {error && <p className="composer-error">{error}</p>}

        <div className="pc-divider" />

        <div className="pc-add composer-actions-wrap">
          <span>{isReelMode ? "Build your reel" : "Add to your post"}</span>

          <div className="pc-actions composer-actions">
            <button
              type="button"
              className={mediaSelectionCount > 0 ? "active" : ""}
              onClick={() => openAction("media")}
              title={isReelMode ? "Video" : "Photo/Video"}
            >
              <ComposerIcon name="media" />
              <span>{isReelMode ? "Video" : "Photo/Video"}</span>
            </button>
            <button
              type="button"
              className={activePanel === "tag" || taggedPeople.length ? "active" : ""}
              onClick={() => openAction("tag")}
              title="Tag people"
            >
              <ComposerIcon name="tag" />
              <span>Tag people</span>
            </button>
            <button
              type="button"
              className={activePanel === "feeling" || feeling ? "active" : ""}
              onClick={() => openAction("feeling")}
              title="Feeling/Activity"
            >
              <ComposerIcon name="feeling" />
              <span>Feeling/Activity</span>
            </button>
            <button
              type="button"
              className={
                activePanel === "checkin" || checkInLocation.trim() ? "active" : ""
              }
              onClick={() => openAction("checkin")}
              title="Check-In"
            >
              <ComposerIcon name="location" />
              <span>Check-In</span>
            </button>
            <button
              type="button"
              className={activePanel === "calls" || callsEnabled ? "active" : ""}
              onClick={() => openAction("calls")}
              title="Get Calls"
            >
              <ComposerIcon name="call" />
              <span>Get Calls</span>
            </button>
            <button
              type="button"
              className={activePanel === "more" || selectedMore.length ? "active" : ""}
              onClick={() => openAction("more")}
              title="More"
            >
              <ComposerIcon name="more" />
              <span>More</span>
            </button>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          hidden
          multiple={!isReelMode}
          accept={
            isReelMode
              ? "video/mp4,video/webm,video/quicktime"
              : "image/*,video/mp4,video/webm,video/quicktime"
          }
          onChange={handleFileChange}
        />

        <button
          className={`pc-submit ${canSubmit ? "active" : ""}`}
          disabled={!canSubmit || isSubmitting || isUploadingMedia}
          onClick={submit}
        >
          {isSubmitting || isUploadingMedia
            ? isReelMode
              ? "Publishing..."
              : "Posting..."
            : isReelMode
              ? "Publish reel"
              : "Post"}
        </button>
      </div>
    </div>
  );
}

export default function Home({ user }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedItems, setFeedItems] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [chatDockMeta, setChatDockMeta] = useState(null);
  const [selectedChatId, setSelectedChatId] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerInitialFiles, setComposerInitialFiles] = useState([]);
  const [composerInitialMode, setComposerInitialMode] = useState("");
  const [storyCreatorSignal, setStoryCreatorSignal] = useState(0);
  const [selectedNewsCard, setSelectedNewsCard] = useState(null);
  const [visiblePostCount, setVisiblePostCount] = useState(INITIAL_VISIBLE_POSTS);
  const loadMoreRef = useRef(null);
  const quickMediaRef = useRef(null);
  const feedRequestSequenceRef = useRef(0);
  const lastFeedRefreshAtRef = useRef(0);
  const discoveryQueueRef = useRef([]);
  const discoveryFlushTimerRef = useRef(null);
  const newsFeed = useNewsFeed({
    tab: "local",
    limit: 12,
  });
  const newsPreferences = useNewsPreferences();

  const flushDiscoveryEvents = useCallback(async () => {
    if (!discoveryQueueRef.current.length) {
      return;
    }

    const pending = discoveryQueueRef.current.splice(0, discoveryQueueRef.current.length);
    const batches = new Map();

    for (const entry of pending) {
      const requestId = String(entry?.requestId || "").trim();
      const surface = String(entry?.surface || "home").trim().toLowerCase();
      const event = entry?.event;

      if (!requestId || !event?.type) {
        continue;
      }

      const key = `${requestId}:${surface}`;
      if (!batches.has(key)) {
        batches.set(key, { requestId, surface, events: [] });
      }
      batches.get(key).events.push(event);
    }

    if (!batches.size) {
      return;
    }

    await Promise.all(
      Array.from(batches.values()).map((batch) =>
        trackDiscoveryEvents(batch).catch(() => null)
      )
    );
  }, []);

  const enqueueDiscoveryEvents = useCallback(
    (entries = []) => {
      const normalizedEntries = (Array.isArray(entries) ? entries : [entries]).filter(
        (entry) => entry?.requestId && entry?.event?.type
      );

      if (!normalizedEntries.length) {
        return;
      }

      discoveryQueueRef.current.push(...normalizedEntries);

      if (typeof window !== "undefined") {
        if (discoveryFlushTimerRef.current) {
          window.clearTimeout(discoveryFlushTimerRef.current);
        }
        discoveryFlushTimerRef.current = window.setTimeout(() => {
          void flushDiscoveryEvents();
        }, DISCOVERY_BATCH_DELAY_MS);
      }
    },
    [flushDiscoveryEvents]
  );

  const loadFeed = useCallback(async ({ silent = false, preserveVisibleCount = false } = {}) => {
    const requestSequence = ++feedRequestSequenceRef.current;

    if (!silent) {
      setFeedLoading(true);
      setFeedError("");
    }

    try {
      const payload = await getFeed();
      if (requestSequence !== feedRequestSequenceRef.current) {
        return;
      }

      const nextItems = normalizeLegacyFeedItems(payload);

      if (requestSequence === feedRequestSequenceRef.current) {
        setFeedItems(nextItems);
        setFeedError("");
        lastFeedRefreshAtRef.current = Date.now();
        if (!preserveVisibleCount) {
          setVisiblePostCount(INITIAL_VISIBLE_POSTS);
        }
      }
    } catch (err) {
      if (requestSequence !== feedRequestSequenceRef.current) {
        return;
      }

      if (silent) {
        return;
      }

      setFeedItems([]);
      setFeedError(err?.message || "Failed to load feed");
    } finally {
      if (!silent && requestSequence === feedRequestSequenceRef.current) {
        setFeedLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        setLoading(true);
        const me = await getProfile();

        if (!alive) {
          return;
        }

        setProfile(me);
      } catch {
        if (alive) {
          toast.error("Failed to load home");
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const refreshFeed = () => {
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }
      void loadFeed({
        silent: true,
        preserveVisibleCount: true,
      });
    };

    const handleVisibilityChange = () => {
      if (typeof document === "undefined" || document.hidden) {
        return;
      }
      if (Date.now() - lastFeedRefreshAtRef.current < FEED_AUTO_REFRESH_MS) {
        return;
      }
      void loadFeed({
        silent: true,
        preserveVisibleCount: true,
      });
    };

    const timer = window.setInterval(refreshFeed, FEED_AUTO_REFRESH_MS);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      window.clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [loadFeed]);

  useEffect(() => () => {
    if (typeof window !== "undefined" && discoveryFlushTimerRef.current) {
      window.clearTimeout(discoveryFlushTimerRef.current);
    }
    void flushDiscoveryEvents();
  }, [flushDiscoveryEvents]);

  useEffect(() => {
    const shouldOpenMessenger = Boolean(location.state?.openMessenger);
    const shouldOpenComposer = Boolean(location.state?.openComposer);
    const shouldOpenStoryCreator = Boolean(location.state?.openStoryCreator);
    const composerMode =
      typeof location.state?.composerMode === "string" ? location.state.composerMode : "";
    if (!shouldOpenMessenger && !shouldOpenComposer && !shouldOpenStoryCreator) {
      return;
    }

    if (shouldOpenMessenger) {
      setSelectedChatId(String(location.state?.messengerTargetId || ""));
      setChatOpen(true);
      setChatMinimized(false);
    }
    if (shouldOpenComposer) {
      setComposerInitialFiles([]);
      setComposerInitialMode(composerMode);
      setComposerOpen(true);
    }
    if (shouldOpenStoryCreator) {
      setStoryCreatorSignal((value) => value + 1);
    }

    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) {return undefined;}
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) {
          setVisiblePostCount((prev) => prev + LOAD_MORE_INCREMENT);
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [feedItems.length]);

  const logout = () => {
    navigate("/");
  };

  const openComposer = (mode = "", files = []) => {
    setComposerInitialMode(mode || "");
    setComposerInitialFiles(
      Array.isArray(files) ? files.filter(Boolean) : files ? [files] : []
    );
    setComposerOpen(true);
  };

  const onQuickMediaPick = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) {
      return;
    }

    if (files.length > POST_COMPOSER_MAX_MEDIA_FILES) {
      toast.error("You can attach up to 10 photos or videos to one post.");
      return;
    }

    const invalidFile = files.find((file) => {
      const mimeType = String(file?.type || "").toLowerCase();
      return !mimeType.startsWith("image/") && !POST_COMPOSER_ALLOWED_VIDEO_TYPES.has(mimeType);
    });
    if (invalidFile) {
      toast.error("Only images, MP4, MOV, and WebM videos are supported.");
      return;
    }

    openComposer("", files);
  };

  const currentUser = profile || user;
  const visibleFeedItems = Array.isArray(feedItems)
    ? feedItems.slice(0, visiblePostCount)
    : [];
  const visibleMixedFeedItems = useMemo(
    () => injectNewsCards(visibleFeedItems, newsFeed.cards || [], HOME_NEWS_INTERVAL),
    [newsFeed.cards, visibleFeedItems]
  );
  const handleNewsReport = useCallback(
    async (payload = {}) => {
      const reason = window.prompt(
        "Tell us what looks wrong about this news item.",
        "Possible issue with this story"
      );
      if (reason) {
        await newsPreferences.reportIssue({ ...payload, reason });
      }
    },
    [newsPreferences]
  );

  const handleRecommendationAction = useCallback(
    async ({
      action,
      discoveryMeta,
      eventType,
      metadata,
      post,
      value = 0,
    } = {}) => {
      const requestId = String(discoveryMeta?.requestId || "").trim();
      const entityId = String(discoveryMeta?.entityId || post?._id || "").trim();

      if (!requestId || !entityId) {
        return;
      }

      const baseEvent = {
        entityType: String(discoveryMeta?.entityType || "post").trim().toLowerCase(),
        entityId,
        position: Number(discoveryMeta?.rank || 0),
        value: Number(value || 0),
        metadata: {
          action: String(action || "").trim().toLowerCase(),
          reason: discoveryMeta?.reason || "",
          ...(metadata && typeof metadata === "object" ? metadata : {}),
        },
      };

      if (action === "interested") {
        enqueueDiscoveryEvents([
          {
            requestId,
            surface: "home",
            event: {
              ...baseEvent,
              type: "recommendation_clicked",
              metadata: {
                ...baseEvent.metadata,
                preference: "more_like_this",
              },
            },
          },
        ]);
        toast.success("We will show you more like this.");
        return;
      }

      if (action === "not_interested") {
        setFeedItems((prev) =>
          prev.filter((entry) => entry?.post?._id !== post?._id)
        );
        enqueueDiscoveryEvents([
          {
            requestId,
            surface: "home",
            event: {
              ...baseEvent,
              type: "recommendation_dismissed",
            },
          },
        ]);
        toast.success("We will show you less like this.");
        return;
      }

      if (action === "mute_creator") {
        const targetUserId = String(discoveryMeta?.authorUserId || post?.user?._id || "").trim();
        if (!targetUserId) {
          throw new Error("Creator details are unavailable for this card");
        }

        await muteUser(targetUserId);
        setFeedItems((prev) =>
          prev.filter((entry) => entry?.post?._id !== post?._id)
        );
        enqueueDiscoveryEvents([
          {
            requestId,
            surface: "home",
            event: {
              ...baseEvent,
              type: "recommendation_hidden",
              metadata: {
                ...baseEvent.metadata,
                targetUserId,
              },
            },
          },
        ]);
        toast.success("Creator muted.");
        return;
      }

      if (action === "toggle_follow_creator") {
        const creatorId = String(discoveryMeta?.creatorId || "").trim();
        if (!creatorId) {
          throw new Error("Creator profile is unavailable for this card");
        }

        const payload = await toggleFollowCreator(creatorId);
        const following = Boolean(payload?.following);

        setFeedItems((prev) =>
          prev.map((entry) =>
            entry?.discoveryMeta?.creatorId === creatorId
              ? {
                  ...entry,
                  discoveryMeta: {
                    ...entry.discoveryMeta,
                    viewerFollowsCreator: following,
                  },
                }
              : entry
          )
        );

        enqueueDiscoveryEvents([
          {
            requestId,
            surface: "home",
            event: {
              ...baseEvent,
              type: following ? "creator_followed" : "recommendation_clicked",
              metadata: {
                ...baseEvent.metadata,
                creatorId,
                followState: following ? "followed" : "unfollowed",
              },
            },
          },
        ]);
        toast.success(following ? "Creator followed." : "Creator unfollowed.");
        return;
      }

      enqueueDiscoveryEvents([
        {
          requestId,
          surface: "home",
          event: {
            ...baseEvent,
            type: eventType || "recommendation_clicked",
          },
        },
      ]);
    },
    [enqueueDiscoveryEvents]
  );

  return (
    <>
      <Navbar
        user={currentUser}
        onLogout={logout}
        onOpenMessenger={(payload = {}) => {
          setSelectedChatId(String(payload?.contactId || ""));
          if (payload?.contact) {
            setChatDockMeta({
              name: payload.contact?.name || payload.contact?.username || "Messenger",
              avatar: payload.contact?.avatar || "",
            });
          }
          setChatOpen(true);
          setChatMinimized(false);
        }}
        onOpenCreatePost={(target = "post") => {
          if (target === "story") {
            setStoryCreatorSignal((value) => value + 1);
            return;
          }
          if (target === "reel") {
            openComposer("reel");
            return;
          }
          openComposer();
        }}
      />

      <div className="app-shell">
        <aside className="sidebar">
          <Sidebar
            user={currentUser}
            openChat={() => {
              setSelectedChatId("");
              setChatOpen(true);
              setChatMinimized(false);
            }}
            openProfile={() => navigate(`/profile/${currentUser?.username}`)}
          />
        </aside>

        <main className="feed">
          {isBirthdayToday(currentUser?.birthday) && (
            <section className="card birthday-banner">
              <img src="/assets/birthday-cake.svg" alt="Birthday cake" />
              <div>
                <strong>Happy Birthday, {currentUser?.name || currentUser?.username || "Friend"} 🎉</strong>
                <p>Wishing you joy, love, and a beautiful year ahead.</p>
              </div>
            </section>
          )}
          {!loading && <Stories user={currentUser} openCreateSignal={storyCreatorSignal} />}

          <div className="card create-post" onClick={() => openComposer()}>
            <div className="create-post-row">
              <img
                className="create-post-avatar"
                src={resolveImage(currentUser?.avatar) || "/avatar.png"}
                alt="me"
              />
              <input placeholder="What's on your mind?" readOnly />
              <div className="create-post-quick-actions">
                <button
                  type="button"
                  className="create-post-quick-btn create-post-quick-btn--media"
                  title="Photo/Video"
                  aria-label="Photo/Video"
                  onClick={(event) => {
                    event.stopPropagation();
                    quickMediaRef.current?.click();
                  }}
                >
                  <span className="create-post-quick-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm0 2v8.8l4.2-4 3.3 2.7 4.1-3.5L21 15.9V7H4zm3.5 2.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z" />
                    </svg>
                  </span>
                </button>
                <button
                  type="button"
                  className="create-post-quick-btn create-post-quick-btn--live"
                  title="Live"
                  aria-label="Live"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate("/live/go");
                  }}
                >
                  <span className="create-post-quick-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h6A2.5 2.5 0 0 1 15 8.5V9l4.4-2.6A1 1 0 0 1 21 7.3v9.4a1 1 0 0 1-1.6.8L15 15v.5a2.5 2.5 0 0 1-2.5 2.5h-6A2.5 2.5 0 0 1 4 15.5v-7z" />
                      <circle cx="9.2" cy="12" r="2.1" />
                    </svg>
                  </span>
                </button>
                <button
                  type="button"
                  className="create-post-quick-btn create-post-quick-btn--reel"
                  title="Reel"
                  aria-label="Reel"
                  onClick={(event) => {
                    event.stopPropagation();
                    openComposer("reel");
                  }}
                >
                  <span className="create-post-quick-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M4 6h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm14 2.3L22 6v12l-4-2.3V8.3z" />
                    </svg>
                  </span>
                </button>
              </div>
            </div>
            <input
              ref={quickMediaRef}
              type="file"
              hidden
              multiple
              accept="image/*,video/mp4,video/webm,video/quicktime"
              onChange={onQuickMediaPick}
            />
          </div>

          <CreatorSummaryFeed />

          {chatOpen && (
            <section className="messenger-panel">
              <Messenger
                user={currentUser}
                initialSelectedId={selectedChatId}
                conversationOnly={Boolean(selectedChatId)}
                onClose={() => {
                  setSelectedChatId("");
                  setChatOpen(false);
                  setChatMinimized(false);
                }}
                onMinimize={(meta) => {
                  setChatDockMeta(meta || null);
                  setChatOpen(false);
                  setChatMinimized(true);
                }}
              />
            </section>
          )}

          <div className="tengacion-feed">
            {feedLoading ? (
              <>
                <PostSkeleton />
                <PostSkeleton />
                <PostSkeleton />
              </>
            ) : feedError ? (
              <div className="card empty-feed">
                <div className="empty-feed-icon">Retry</div>
                <h3>Could not load this feed</h3>
                <p>{feedError}</p>
                <button
                  className="empty-feed-btn"
                  onClick={() => {
                    void loadFeed();
                  }}
                >
                  Try again
                </button>
              </div>
            ) : feedItems.length === 0 ? (
              <div className="card empty-feed">
                <div className="empty-feed-icon">News</div>
                <h3>No posts yet</h3>
                <p>Be the first to share something with your friends.</p>
                <button
                  className="empty-feed-btn"
                  onClick={() => openComposer()}
                >
                  Create a post
                </button>
              </div>
            ) : (
              visibleMixedFeedItems.map((item) => {
                if (item.type === "news") {
                  const sharedProps = {
                    card: item.card,
                    compact: true,
                    onOpen: (card) => setSelectedNewsCard(card),
                    onHide: (payload) => newsPreferences.hideItem(payload),
                    onFollowSource: (sourceSlug) =>
                      newsPreferences.followSource({ sourceSlug, follow: true }),
                    onReport: handleNewsReport,
                    onTrack: newsPreferences.track,
                  };

                  return item.card?.cardType === "cluster" ? (
                    <NewsClusterCard key={item.key} {...sharedProps} />
                  ) : (
                    <NewsStoryCard key={item.key} {...sharedProps} />
                  );
                }

                const entry = item.entry;
                return (
                  <PostCard
                    key={entry.key}
                    post={entry.post}
                    discoveryMeta={entry.discoveryMeta}
                    onRecommendationAction={handleRecommendationAction}
                    onShareCreated={(sharedPost) =>
                      setFeedItems((prev) => [
                        createFeedEntry(sharedPost),
                        ...prev.filter((feedEntry) => feedEntry?.post?._id !== sharedPost?._id),
                      ])
                    }
                    onDelete={(id) =>
                      setFeedItems((prev) =>
                        prev.filter((feedEntry) => feedEntry?.post?._id !== id)
                      )
                    }
                    onEdit={(updatedPost) =>
                      setFeedItems((prev) =>
                        prev.map((feedEntry) =>
                          feedEntry?.post?._id === updatedPost._id
                            ? { ...feedEntry, post: updatedPost }
                            : feedEntry
                        )
                      )
                    }
                  />
                );
              })
            )}
            {visibleFeedItems.length < feedItems.length ? (
              <div ref={loadMoreRef} className="card" style={{ padding: 12, textAlign: "center" }}>
                Loading more...
              </div>
            ) : null}
          </div>
        </main>

        <aside className="home-right-rail">
          <RightQuickNav />
          <FriendRequests />
          {!chatOpen && chatMinimized && (
            <button
              type="button"
              className="messenger-dock"
              onClick={() => {
                setChatOpen(true);
                setChatMinimized(false);
              }}
              title="Restore chat"
            >
              <img
                src={resolveImage(chatDockMeta?.avatar) || resolveImage(currentUser?.avatar) || "/avatar.png"}
                alt=""
              />
              <span>{chatDockMeta?.name || "Messenger"}</span>
            </button>
          )}
        </aside>
      </div>

      {composerOpen && (
        <PostComposerModal
          user={currentUser}
          initialFiles={composerInitialFiles}
          initialMode={composerInitialMode}
          onClose={() => {
            setComposerOpen(false);
            setComposerInitialFiles([]);
            setComposerInitialMode("");
          }}
          onPosted={(post) =>
            setFeedItems((prev) => [createFeedEntry(post), ...prev])
          }
        />
      )}
      <NewsDetailDrawer
        card={selectedNewsCard}
        open={Boolean(selectedNewsCard)}
        onClose={() => setSelectedNewsCard(null)}
      />
    </>
  );
}
