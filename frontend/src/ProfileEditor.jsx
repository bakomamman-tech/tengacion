import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import {
  getPostsByUsername,
  getUserProfile,
  resolveImage,
  updateMe,
  uploadAvatar,
  uploadCover,
} from "./api";
import { useAuth } from "./context/AuthContext";
import Navbar from "./Navbar";
import PostCard from "./components/PostCard";

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&size=240&background=DFE8F6&color=1D3A6D`;

const iconPathByName = {
  home: "M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1V9.5z",
  pin: "M12 22s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12zm0-8a4 4 0 1 1 0-8 4 4 0 0 1 0 8z",
  work: "M3 8h18a1 1 0 0 1 1 1v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1zm5-4h8a2 2 0 0 1 2 2v2H6V6a2 2 0 0 1 2-2z",
  edu: "M2 9l10-5 10 5-10 5L2 9zm4 3.2v4.8c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.8",
  link: "M9.8 14.2L7 17a4 4 0 0 1-5.6-5.6l2.8-2.8a4 4 0 0 1 5.6 0M14.2 9.8L17 7a4 4 0 0 1 5.6 5.6l-2.8 2.8a4 4 0 0 1-5.6 0M8 12h8",
  cake: "M4 10h16v10H4V10zm0 4h16M8 10V8a2 2 0 1 1 4 0v2M12 10V8a2 2 0 1 1 4 0v2",
  join: "M4 4h16v16H4V4zm0 5h16M8 2v4M16 2v4",
  edit: "M4 20l4.2-1 10-10a1.8 1.8 0 0 0 0-2.5l-1.8-1.8a1.8 1.8 0 0 0-2.5 0l-10 10L4 20z",
};

const isVideoMedia = (entry, url) => {
  const explicitType =
    entry && typeof entry === "object" ? (entry.type || "").toLowerCase() : "";
  if (explicitType === "video") {
    return true;
  }
  return /\.(mp4|webm|ogg|mov|m4v)(?:\?.*)?$/i.test(url || "");
};

const formatLargeCount = (value) => {
  const count = Number(value) || 0;
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return `${count}`;
};

const formatDate = (value) => {
  if (!value) {
    return "";
  }
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

const toWebsiteUrl = (value) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return "";
  }
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
};

const toWebsiteLabel = (value) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return "";
  }
  return raw.replace(/^https?:\/\//i, "");
};

const POST_FILTERS = [
  { id: "all", label: "All posts" },
  { id: "photos", label: "Photos" },
  { id: "videos", label: "Videos" },
  { id: "text", label: "Text only" },
];

const getPostMediaKind = (post) => {
  const mediaList = Array.isArray(post?.media) ? post.media : [];
  if (!mediaList.length) {
    return "text";
  }

  const hasVideo = mediaList.some((entry) => {
    const rawUrl =
      entry && typeof entry === "object"
        ? entry.url || ""
        : typeof entry === "string"
          ? entry
          : "";
    return isVideoMedia(entry, rawUrl);
  });

  return hasVideo ? "videos" : "photos";
};

const isImageFile = (file) => Boolean(file?.type?.startsWith("image/"));

function Glyph({ name, className = "" }) {
  const path = iconPathByName[name] || "";
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

function ProfileMediaTile({ item, alt }) {
  return (
    <div className="profile-media-tile">
      {item.isVideo ? (
        <video src={item.url} className="profile-media-thumb" muted preload="metadata" />
      ) : (
        <img src={item.url} alt={alt} className="profile-media-thumb" />
      )}
      {item.isVideo && <span className="profile-media-badge">Video</span>}
    </div>
  );
}

function FactRow({ icon, children }) {
  return (
    <div className="profile-fact-row">
      <span className="profile-fact-icon">
        <Glyph name={icon} />
      </span>
      <span className="profile-fact-value">{children}</span>
    </div>
  );
}

export default function ProfileEditor({ user }) {
  const navigate = useNavigate();
  const { username: routeUsername } = useParams();
  const { updateUser } = useAuth();

  const targetUsername = (routeUsername || user?.username || "").toLowerCase();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingDetails, setEditingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [showTipCard, setShowTipCard] = useState(true);
  const [postViewMode, setPostViewMode] = useState("list");
  const [activeTab, setActiveTab] = useState("all");
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [postFilter, setPostFilter] = useState("all");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [coverPreview, setCoverPreview] = useState("");

  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [currentCity, setCurrentCity] = useState("");
  const [hometown, setHometown] = useState("");
  const [workplace, setWorkplace] = useState("");
  const [education, setEducation] = useState("");
  const [website, setWebsite] = useState("");

  const aboutRef = useRef(null);
  const photosRef = useRef(null);
  const friendsRef = useRef(null);
  const postsRef = useRef(null);
  const tabsRef = useRef(null);

  const isOwner = Boolean(profile?.isOwner);
  const displayAvatar =
    avatarPreview ||
    resolveImage(profile?.avatar) ||
    resolveImage(user?.avatar) ||
    fallbackAvatar(profile?.name);
  const displayCover = coverPreview || resolveImage(profile?.cover);
  const websiteHref = toWebsiteUrl(website || profile?.website);
  const websiteLabel = toWebsiteLabel(website || profile?.website);

  const mediaItems = useMemo(
    () =>
      (Array.isArray(posts) ? posts : [])
      .flatMap((post) => {
        const entries = Array.isArray(post?.media) ? post.media : [];
        return entries.map((entry, index) => {
          const rawUrl =
            entry && typeof entry === "object"
              ? entry.url || ""
              : typeof entry === "string"
                ? entry
                : "";
          const url = resolveImage(rawUrl);
          return {
            id: `${post?._id || "post"}-${index}`,
            url,
            isVideo: isVideoMedia(entry, url),
          };
        });
      })
      .filter((item) => item.url),
    [posts]
  );

  const photoItems = mediaItems.filter((item) => !item.isVideo);
  const highlightItems = mediaItems.slice(0, 2);
  const photoList = showAllPhotos ? photoItems : photoItems.slice(0, 9);

  const filteredPosts = useMemo(() => {
    if (postFilter === "all") {
      return posts;
    }

    if (postFilter === "text") {
      return posts.filter((post) => getPostMediaKind(post) === "text");
    }

    return posts.filter((post) => getPostMediaKind(post) === postFilter);
  }, [postFilter, posts]);

  const syncEditableFields = useCallback((nextProfile) => {
    setBio(nextProfile?.bio || "");
    setCountry(nextProfile?.country || "");
    setCurrentCity(nextProfile?.currentCity || "");
    setHometown(nextProfile?.hometown || "");
    setWorkplace(nextProfile?.workplace || "");
    setEducation(nextProfile?.education || "");
    setWebsite(nextProfile?.website || "");
  }, []);

  const loadAll = useCallback(
    async (username, { showLoader = false } = {}) => {
      if (!username) {
        return;
      }

      try {
        if (showLoader) {
          setLoading(true);
        }
        setError("");

        const [profileResult, postsResult] = await Promise.allSettled([
          getUserProfile(username),
          getPostsByUsername(username),
        ]);

        if (profileResult.status === "fulfilled") {
          setProfile(profileResult.value || null);
          syncEditableFields(profileResult.value || {});
        } else {
          setProfile(null);
          setError(profileResult.reason?.message || "Failed to load profile");
        }

        if (postsResult.status === "fulfilled") {
          setPosts(Array.isArray(postsResult.value) ? postsResult.value : []);
        } else {
          setPosts([]);
        }
      } catch (err) {
        setError(err?.message || "Failed to load profile");
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [syncEditableFields]
  );

  useEffect(() => {
    let alive = true;

    const loadProfile = async () => {
      if (!targetUsername) {
        return;
      }
      await loadAll(targetUsername, { showLoader: true });
      if (!alive) {
        return;
      }
    };

    loadProfile();
    return () => {
      alive = false;
    };
  }, [targetUsername, loadAll]);

  useEffect(
    () => () => {
      if (avatarPreview && avatarPreview.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    },
    [avatarPreview]
  );

  useEffect(
    () => () => {
      if (coverPreview && coverPreview.startsWith("blob:")) {
        URL.revokeObjectURL(coverPreview);
      }
    },
    [coverPreview]
  );

  useEffect(() => {
    if (!moreMenuOpen) {
      return undefined;
    }

    const onDocClick = (event) => {
      if (tabsRef.current && !tabsRef.current.contains(event.target)) {
        setMoreMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [moreMenuOpen]);

  const jumpTo = (ref) => {
    if (!ref?.current) {
      return;
    }
    ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleTabSelect = (tabId) => {
    setActiveTab(tabId);
    setMoreMenuOpen(false);

    if (tabId === "about") {
      jumpTo(aboutRef);
      return;
    }
    if (tabId === "photos") {
      jumpTo(photosRef);
      return;
    }
    if (tabId === "friends") {
      jumpTo(friendsRef);
      return;
    }
    if (tabId === "reels") {
      setPostFilter("videos");
      jumpTo(postsRef);
      return;
    }
    if (tabId === "all") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const openEditDetails = () => {
    setEditingDetails(true);
    setTimeout(() => jumpTo(aboutRef), 50);
  };

  const saveDetails = async () => {
    if (!isOwner || saving) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      const updated = await updateMe({
        bio,
        country,
        currentCity,
        hometown,
        workplace,
        education,
        website,
      });
      updateUser(updated);

      await loadAll(targetUsername);
      setEditingDetails(false);
      toast.success("Profile details updated");
    } catch (err) {
      setError(err.message || "Failed to save profile details");
      toast.error("Could not save details");
    } finally {
      setSaving(false);
    }
  };

  const changeAvatar = async (file) => {
    if (!file || !isOwner || avatarUploading) {
      return;
    }
    if (!isImageFile(file)) {
      toast.error("Please select a valid image file");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image is too large (max 15MB)");
      return;
    }
    const nextPreview = URL.createObjectURL(file);
    setAvatarPreview(nextPreview);

    try {
      setAvatarUploading(true);
      const updated = await uploadAvatar(file);
      updateUser(updated);
      await loadAll(targetUsername);
      setAvatarPreview("");
      toast.success("Profile photo updated");
    } catch (err) {
      setAvatarPreview("");
      setError(err.message || "Failed to upload profile photo");
      toast.error(err.message || "Upload failed");
    } finally {
      setAvatarUploading(false);
    }
  };

  const changeCover = async (file) => {
    if (!file || !isOwner || coverUploading) {
      return;
    }
    if (!isImageFile(file)) {
      toast.error("Please select a valid image file");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image is too large (max 15MB)");
      return;
    }
    const nextPreview = URL.createObjectURL(file);
    setCoverPreview(nextPreview);

    try {
      setCoverUploading(true);
      const updated = await uploadCover(file);
      updateUser(updated);
      await loadAll(targetUsername);
      setCoverPreview("");
      toast.success("Cover photo updated");
    } catch (err) {
      setCoverPreview("");
      setError(err.message || "Failed to upload cover photo");
      toast.error(err.message || "Upload failed");
    } finally {
      setCoverUploading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  if (loading) {
    return (
      <>
        <Navbar user={user} onLogout={logout} />
        <div className="boot-screen">
          <div className="boot-card">Loading profile...</div>
        </div>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <Navbar user={user} onLogout={logout} />
        <div className="boot-screen">
          <div className="boot-card">Profile not found.</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar user={user} onLogout={logout} />

      <main className="profile-page-v2">
        <section className="profile-hero-card">
          <div className="profile-cover-v2">
            {displayCover ? (
              <img src={displayCover} alt={`${profile.name} cover`} />
            ) : (
              <div className="profile-cover-placeholder" />
            )}

            {isOwner && (
              <label className="profile-cover-action">
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0];
                    changeCover(nextFile);
                    event.target.value = "";
                  }}
                />
                {coverUploading ? "Updating..." : "Edit cover photo"}
              </label>
            )}
          </div>

          <div className="profile-head-v2">
            <div className="profile-avatar-v2-wrap">
              <img src={displayAvatar} alt={profile.name} className="profile-avatar-v2" />
              {isOwner && (
                <label className="profile-avatar-v2-action">
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => {
                      const nextFile = event.target.files?.[0];
                      changeAvatar(nextFile);
                      event.target.value = "";
                    }}
                  />
                  {avatarUploading ? "..." : "Edit"}
                </label>
              )}
            </div>

            <div className="profile-main-meta">
              <h1>{profile.name}</h1>
              <p className="profile-follow-line">
                {formatLargeCount(profile.followersCount)} followers .{" "}
                {formatLargeCount(profile.followingCount)} following
              </p>
              {profile.bio && <p className="profile-main-bio">{profile.bio}</p>}

              <div className="profile-badge-line">
                {(profile.currentCity || profile.country) && (
                  <span>
                    <Glyph name="pin" className="profile-mini-ico" />
                    {profile.currentCity || profile.country}
                  </span>
                )}
                {profile.workplace && (
                  <span>
                    <Glyph name="work" className="profile-mini-ico" />
                    {profile.workplace}
                  </span>
                )}
                {profile.education && (
                  <span>
                    <Glyph name="edu" className="profile-mini-ico" />
                    {profile.education}
                  </span>
                )}
              </div>
            </div>

            <div className="profile-head-actions">
              {isOwner ? (
                <>
                  <button className="profile-head-btn primary" onClick={() => navigate("/creator")}>
                    Dashboard
                  </button>
                  <button
                    className="profile-head-btn"
                    onClick={() => setEditingDetails((current) => !current)}
                  >
                    {editingDetails ? "Close edit" : "Edit"}
                  </button>
                </>
              ) : (
                <>
                  <button className="profile-head-btn primary">Follow</button>
                  <button className="profile-head-btn">Message</button>
                </>
              )}
            </div>
          </div>

          <div className="profile-tabs-shell" ref={tabsRef}>
            <div className="profile-tabs-v2">
              <button
                className={`profile-tab-btn ${activeTab === "all" ? "active" : ""}`}
                onClick={() => handleTabSelect("all")}
              >
                All
              </button>
              <button
                className={`profile-tab-btn ${activeTab === "about" ? "active" : ""}`}
                onClick={() => handleTabSelect("about")}
              >
                About
              </button>
              <button
                className={`profile-tab-btn ${activeTab === "photos" ? "active" : ""}`}
                onClick={() => handleTabSelect("photos")}
              >
                Photos
              </button>
              <button
                className={`profile-tab-btn ${activeTab === "friends" ? "active" : ""}`}
                onClick={() => handleTabSelect("friends")}
              >
                Friends
              </button>
              <button
                className={`profile-tab-btn ${activeTab === "reels" ? "active" : ""}`}
                onClick={() => handleTabSelect("reels")}
              >
                Reels
              </button>
              <button className="profile-tab-btn" onClick={() => setMoreMenuOpen((v) => !v)}>
                More
              </button>
            </div>
            <button className="profile-tabs-more" onClick={() => setMoreMenuOpen((v) => !v)}>
              ...
            </button>
            {moreMenuOpen && (
              <div className="profile-more-menu">
                <button onClick={() => handleTabSelect("about")}>About</button>
                <button onClick={() => handleTabSelect("photos")}>Photos</button>
                <button onClick={() => handleTabSelect("friends")}>Friends</button>
                <button onClick={() => handleTabSelect("reels")}>Reels</button>
                <button onClick={() => jumpTo(postsRef)}>Posts</button>
              </div>
            )}
          </div>
        </section>

        <section className="profile-body-v2">
          <aside className="profile-left-col">
            {error && <div className="profile-alert">{error}</div>}

            {showTipCard && (
              <article className="card profile-panel profile-tip-card">
                <button
                  className="profile-tip-dismiss"
                  aria-label="Dismiss suggestion"
                  onClick={() => setShowTipCard(false)}
                >
                  x
                </button>
                <div className="profile-tip-icon">i</div>
                <div className="profile-tip-copy">
                  <h3>Get more out of your profile</h3>
                  <p>Adding interests gives people a better sense of what you are about.</p>
                </div>
                <button className="profile-primary-action" onClick={openEditDetails}>
                  Update your profile
                </button>
              </article>
            )}

            <article className="card profile-panel" ref={aboutRef}>
              <div className="profile-panel-head">
                <h3>Personal details</h3>
                {isOwner && (
                  <button
                    className="profile-icon-btn"
                    onClick={() => setEditingDetails((current) => !current)}
                    aria-label="Edit personal details"
                  >
                    <Glyph name="edit" />
                  </button>
                )}
              </div>

              <div className="profile-facts-list">
                {(profile.currentCity || profile.country) && (
                  <FactRow icon="pin">Lives in {profile.currentCity || profile.country}</FactRow>
                )}
                {profile.hometown && <FactRow icon="home">From {profile.hometown}</FactRow>}
                {profile.dob && <FactRow icon="cake">{formatDate(profile.dob)}</FactRow>}
                {profile.joinedAt && <FactRow icon="join">Joined {formatDate(profile.joinedAt)}</FactRow>}
              </div>
            </article>

            <article className="card profile-panel">
              <div className="profile-panel-head">
                <h3>Links</h3>
                {isOwner && (
                  <button
                    className="profile-icon-btn"
                    onClick={() => setEditingDetails((current) => !current)}
                    aria-label="Edit links"
                  >
                    <Glyph name="edit" />
                  </button>
                )}
              </div>
              <div className="profile-facts-list">
                {websiteHref ? (
                  <FactRow icon="link">
                    <a href={websiteHref} target="_blank" rel="noreferrer" className="profile-link">
                      {websiteLabel}
                    </a>
                  </FactRow>
                ) : (
                  <p className="profile-mute">No links added yet</p>
                )}
              </div>
            </article>

            <article className="card profile-panel">
              <div className="profile-panel-head">
                <h3>Work</h3>
                {isOwner && (
                  <button
                    className="profile-icon-btn"
                    onClick={() => setEditingDetails((current) => !current)}
                    aria-label="Edit work"
                  >
                    <Glyph name="edit" />
                  </button>
                )}
              </div>
              <div className="profile-facts-list">
                {workplace ? (
                  <FactRow icon="work">{workplace}</FactRow>
                ) : (
                  <p className="profile-mute">Add your workplace</p>
                )}
              </div>
            </article>

            <article className="card profile-panel">
              <div className="profile-panel-head">
                <h3>Education</h3>
                {isOwner && (
                  <button
                    className="profile-icon-btn"
                    onClick={() => setEditingDetails((current) => !current)}
                    aria-label="Edit education"
                  >
                    <Glyph name="edit" />
                  </button>
                )}
              </div>
              <div className="profile-facts-list">
                {education ? (
                  <FactRow icon="edu">{education}</FactRow>
                ) : (
                  <p className="profile-mute">Add your school</p>
                )}
              </div>
            </article>

            {editingDetails && isOwner && (
              <article className="card profile-panel">
                <div className="profile-panel-head">
                  <h3>Edit details</h3>
                </div>

                <div className="profile-edit-grid">
                  <label>
                    Bio
                    <textarea value={bio} onChange={(event) => setBio(event.target.value)} />
                  </label>
                  <label>
                    Country
                    <input value={country} onChange={(event) => setCountry(event.target.value)} />
                  </label>
                  <label>
                    Current city
                    <input
                      value={currentCity}
                      onChange={(event) => setCurrentCity(event.target.value)}
                    />
                  </label>
                  <label>
                    Hometown
                    <input value={hometown} onChange={(event) => setHometown(event.target.value)} />
                  </label>
                  <label>
                    Workplace
                    <input value={workplace} onChange={(event) => setWorkplace(event.target.value)} />
                  </label>
                  <label>
                    Education
                    <input
                      value={education}
                      onChange={(event) => setEducation(event.target.value)}
                    />
                  </label>
                  <label>
                    Website
                    <input value={website} onChange={(event) => setWebsite(event.target.value)} />
                  </label>
                </div>

                <div className="profile-edit-actions">
                  <button className="btn-primary" onClick={saveDetails} disabled={saving}>
                    {saving ? "Saving..." : "Save profile"}
                  </button>
                </div>
              </article>
            )}

            <article className="card profile-panel">
              <div className="profile-panel-head">
                <h3>Highlights</h3>
              </div>

              {highlightItems.length ? (
                <div className="profile-media-grid highlights">
                  {highlightItems.map((item, index) => (
                    <ProfileMediaTile key={item.id} item={item} alt={`Highlight ${index + 1}`} />
                  ))}
                  <button
                    className="profile-highlight-add"
                    onClick={() => {
                      if (!photoItems.length) {
                        toast("Add photos first to create highlights");
                        return;
                      }
                      setShowAllPhotos(true);
                      jumpTo(photosRef);
                    }}
                  >
                    Add highlights
                  </button>
                </div>
              ) : (
                <button
                  className="profile-primary-action soft"
                  onClick={() => {
                    setShowAllPhotos(true);
                    jumpTo(photosRef);
                  }}
                >
                  Add highlights
                </button>
              )}
            </article>

            <article className="card profile-panel" ref={photosRef}>
              <div className="profile-panel-head">
                <h3>Photos</h3>
                <button className="btn-link" onClick={() => setShowAllPhotos((current) => !current)}>
                  {showAllPhotos ? "Show less" : "See all photos"}
                </button>
              </div>
              {photoItems.length ? (
                <div className="profile-media-grid photos">
                  {photoList.map((item, index) => (
                    <ProfileMediaTile key={item.id} item={item} alt={`Photo ${index + 1}`} />
                  ))}
                </div>
              ) : (
                <p className="profile-mute">No photos yet</p>
              )}
            </article>

            <article className="card profile-panel" ref={friendsRef}>
              <div className="profile-panel-head">
                <h3>Friends</h3>
                <button
                  className="btn-link"
                  onClick={() => navigate("/search")}
                >
                  Find friends
                </button>
              </div>
              <p className="profile-friends-count">{formatLargeCount(profile.friendsCount)} friends</p>
              {Array.isArray(profile.friendsPreview) && profile.friendsPreview.length > 0 ? (
                <div className="profile-friends-grid">
                  {profile.friendsPreview.map((friend) => (
                    <button
                      key={friend._id}
                      className="profile-friend-tile"
                      onClick={() => navigate(`/profile/${friend.username}`)}
                    >
                      <img
                        src={resolveImage(friend.avatar) || fallbackAvatar(friend.name)}
                        alt={friend.name}
                      />
                      <span className="profile-friend-name">{friend.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="profile-mute">No friend previews yet</p>
              )}
            </article>
          </aside>

          <section className="profile-right-col">
            {isOwner && (
              <article className="card profile-composer-prompt">
                <div className="profile-composer-row">
                  <img src={displayAvatar} alt={profile.name} />
                  <button className="profile-composer-input" onClick={() => navigate("/home")}>
                    What&apos;s on your mind?
                  </button>
                </div>
                <div className="profile-composer-actions">
                  <button className="live" onClick={() => navigate("/home")}>
                    <span aria-hidden="true">o</span> Live video
                  </button>
                  <button className="photo" onClick={() => navigate("/home")}>
                    <span aria-hidden="true">[]</span> Photo/video
                  </button>
                  <button className="reel" onClick={() => navigate("/home")}>
                    <span aria-hidden="true">{">"}</span> Reel
                  </button>
                </div>
              </article>
            )}

            <article className="card profile-posts-toolbar" ref={postsRef}>
              <div className="profile-panel-head">
                <h3>Posts</h3>
                <div className="profile-posts-tools">
                  <button
                    className="profile-pill-btn"
                    onClick={() => {
                      const currentIndex = POST_FILTERS.findIndex((entry) => entry.id === postFilter);
                      const nextFilter = POST_FILTERS[(currentIndex + 1) % POST_FILTERS.length];
                      setPostFilter(nextFilter.id);
                    }}
                  >
                    Filter: {POST_FILTERS.find((entry) => entry.id === postFilter)?.label || "All"}
                  </button>
                  <button className="profile-pill-btn" onClick={() => navigate("/creator")}>
                    Manage posts
                  </button>
                </div>
              </div>
              <div className="profile-posts-views">
                <button
                  className={`profile-view-btn ${postViewMode === "list" ? "active" : ""}`}
                  onClick={() => setPostViewMode("list")}
                >
                  List view
                </button>
                <button
                  className={`profile-view-btn ${postViewMode === "grid" ? "active" : ""}`}
                  onClick={() => setPostViewMode("grid")}
                >
                  Grid view
                </button>
              </div>
            </article>

            <div className={`profile-posts-list ${postViewMode === "grid" ? "grid" : ""}`}>
              {filteredPosts.length > 0 ? (
                filteredPosts.map((post) => (
                  <PostCard
                    key={post._id}
                    post={post}
                    onDelete={(id) =>
                      setPosts((current) => current.filter((entry) => entry._id !== id))
                    }
                    onEdit={(updatedPost) =>
                      setPosts((current) =>
                        current.map((entry) =>
                          entry._id === updatedPost._id ? updatedPost : entry
                        )
                      )
                    }
                  />
                ))
              ) : (
                <article className="card profile-empty-posts">
                  No posts match this filter yet.
                </article>
              )}
            </div>
          </section>
        </section>
      </main>
    </>
  );
}
