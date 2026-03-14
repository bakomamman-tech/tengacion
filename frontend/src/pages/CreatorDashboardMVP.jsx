import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import {
  archiveMyCreatorContent,
  createAlbumWithUploadProgress,
  createBookWithUploadProgress,
  createCreatorVideoWithUploadProgress,
  createTrackWithUploadProgress,
  getCreatorAlbums,
  getCreatorBooks,
  getCreatorDashboard,
  getCreatorSales,
  getCreatorTracks,
  getCreatorVideos,
  getMyCreatorProfile,
  resolveImage,
  upsertCreatorProfile,
} from "../api";
import { useDialog } from "../components/ui/useDialog";
import "./creator-redesign.css";

const PROFILE_DEFAULT = {
  displayName: "",
  bio: "",
  heroBannerUrl: "",
  tagline: "",
  genresRaw: "",
  youtube: "",
  spotify: "",
};

const TRACK_DEFAULT = { title: "", description: "", price: "" };
const BOOK_DEFAULT = { title: "", description: "", price: "" };
const ALBUM_DEFAULT = { albumTitle: "", description: "", price: "" };
const VIDEO_DEFAULT = { title: "", description: "", price: "" };
const PODCAST_DEFAULT = {
  title: "",
  podcastSeries: "",
  description: "",
  seasonNumber: "",
  episodeNumber: "",
  accessType: "free",
  price: "",
};

const CREATOR_SHARE_RATE = 0.4;
const PLATFORM_SHARE_RATE = 0.6;
const fmtMoney = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

function DropZone({ icon, label, description, accept, multiple = false, files = [], onChange }) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      className={`crd-drop ${dragging ? "is-dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const list = Array.from(event.dataTransfer?.files || []);
        if (!list.length) {
          return;
        }
        onChange(multiple ? list : list[0]);
      }}
    >
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(event) => {
          const selected = Array.from(event.target.files || []);
          onChange(multiple ? selected : selected[0] || null);
          event.target.value = "";
        }}
      />
      <div className="crd-drop-head">
        <span className="crd-inline-icon">{icon}</span>
        <strong>{label}</strong>
      </div>
      <span>{description}</span>
      {files.length ? (
        <ul>
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`}>{file.name}</li>
          ))}
        </ul>
      ) : null}
    </label>
  );
}

function ProgressState({ progress, status, error }) {
  if (!progress && !status && !error) {
    return null;
  }

  return (
    <div className="crd-progress-wrap">
      <div className="crd-progress-track">
        <span style={{ width: `${Math.max(0, Math.min(100, Number(progress || 0)))}%` }} />
      </div>
      {status ? <p className="ok">{status}</p> : null}
      {error ? <p className="err">{error}</p> : null}
    </div>
  );
}

function UploadCard({ icon, title, children, className = "" }) {
  return (
    <article className={`crd-upload-card ${className}`.trim()}>
      <div className="crd-upload-title">
        <span className="crd-icon-chip">{icon}</span>
        <h3>{title}</h3>
      </div>
      {children}
    </article>
  );
}

export default function CreatorDashboardMVP() {
  const { confirm } = useDialog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [creator, setCreator] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [books, setBooks] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [videos, setVideos] = useState([]);
  const [sales, setSales] = useState({ totalSalesCount: 0, totalRevenue: 0, currency: "NGN" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [profileForm, setProfileForm] = useState(PROFILE_DEFAULT);
  const [trackForm, setTrackForm] = useState(TRACK_DEFAULT);
  const [trackFiles, setTrackFiles] = useState({ audio: null, preview: null, cover: null });
  const [trackProgress, setTrackProgress] = useState(0);
  const [trackStatus, setTrackStatus] = useState("");
  const [trackError, setTrackError] = useState("");
  const [bookForm, setBookForm] = useState(BOOK_DEFAULT);
  const [bookFiles, setBookFiles] = useState({ cover: null, content: null });
  const [bookProgress, setBookProgress] = useState(0);
  const [bookStatus, setBookStatus] = useState("");
  const [bookError, setBookError] = useState("");
  const [albumForm, setAlbumForm] = useState(ALBUM_DEFAULT);
  const [albumFiles, setAlbumFiles] = useState({ cover: null, tracks: [], previews: [] });
  const [albumProgress, setAlbumProgress] = useState(0);
  const [albumStatus, setAlbumStatus] = useState("");
  const [albumError, setAlbumError] = useState("");
  const [videoForm, setVideoForm] = useState(VIDEO_DEFAULT);
  const [videoFiles, setVideoFiles] = useState({ video: null, thumbnail: null, previewClip: null });
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoStatus, setVideoStatus] = useState("");
  const [videoError, setVideoError] = useState("");
  const [podcastForm, setPodcastForm] = useState(PODCAST_DEFAULT);
  const [podcastFiles, setPodcastFiles] = useState({ audio: null, cover: null, preview: null });
  const [podcastProgress, setPodcastProgress] = useState(0);
  const [podcastStatus, setPodcastStatus] = useState("");
  const [podcastError, setPodcastError] = useState("");

  useEffect(() => {
    let alive = true;

    const loadDashboard = async () => {
      setLoading(true);
      setPageError("");
      try {
        const [profileRes, salesRes, dashRes] = await Promise.all([
          getMyCreatorProfile().catch(() => null),
          getCreatorSales().catch(() => ({ totalSalesCount: 0, totalRevenue: 0, currency: "NGN" })),
          getCreatorDashboard().catch(() => null),
        ]);

        if (!alive) {
          return;
        }

        setCreator(profileRes || null);
        setSales({
          totalSalesCount: Number(dashRes?.totalSales ?? salesRes?.totalSalesCount ?? 0),
          totalRevenue: Number(dashRes?.revenueNGN ?? salesRes?.totalRevenue ?? 0),
          currency: "NGN",
        });

        if (profileRes?._id) {
          const [tracksRes, booksRes, albumsRes, videosRes] = await Promise.all([
            getCreatorTracks(profileRes._id),
            getCreatorBooks(profileRes._id),
            getCreatorAlbums(profileRes._id),
            getCreatorVideos(profileRes._id).catch(() => []),
          ]);

          if (!alive) {
            return;
          }

          setTracks(Array.isArray(tracksRes) ? tracksRes : []);
          setBooks(Array.isArray(booksRes) ? booksRes : []);
          setAlbums(Array.isArray(albumsRes) ? albumsRes : []);
          setVideos(Array.isArray(videosRes) ? videosRes : []);

          const links = Array.isArray(profileRes.links) ? profileRes.links : [];
          const youtube =
            links.find((entry) => String(entry?.label || "").toLowerCase().includes("youtube"))?.url || "";
          const spotify =
            links.find((entry) => String(entry?.label || "").toLowerCase().includes("spotify"))?.url || "";

          setProfileForm({
            displayName: profileRes.displayName || "",
            bio: profileRes.bio || "",
            heroBannerUrl: profileRes.heroBannerUrl || profileRes.coverImageUrl || "",
            tagline: profileRes.tagline || "",
            genresRaw: Array.isArray(profileRes.genres) ? profileRes.genres.join(", ") : "",
            youtube,
            spotify,
          });
        } else {
          setTracks([]);
          setBooks([]);
          setAlbums([]);
          setVideos([]);
        }
      } catch (err) {
        if (alive) {
          setPageError(err.message || "Failed to load creator dashboard.");
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    loadDashboard();
    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => {
    const totalRevenue = Number(sales.totalRevenue || 0);
    const creatorTotal = totalRevenue * CREATOR_SHARE_RATE;
    const platformTotal = totalRevenue * PLATFORM_SHARE_RATE;
    const withdrawn = Math.round(creatorTotal * 0.35);
    const pending = Math.round(creatorTotal * 0.25);
    const available = Math.max(0, creatorTotal - withdrawn - pending);
    return { available, pending, withdrawn, total: creatorTotal, platformTotal };
  }, [sales.totalRevenue]);

  const creatorAvatar = resolveImage(creator?.user?.avatar || "") || "/avatar.png";
  const creatorName = creator?.displayName || creator?.user?.name || "Creator";
  const creatorLocation = creator?.user?.country || "Cone, on Km";
  const musicTracks = tracks.filter((entry) => (entry.kind || "music") === "music");
  const podcastTracks = tracks.filter((entry) => (entry.kind || "music") === "podcast");

  const refreshAll = async () => {
    setLoading(true);
    setPageError("");
    try {
      const profileRes = await getMyCreatorProfile().catch(() => null);
      if (!profileRes?._id) {
        setCreator(null);
        setTracks([]);
        setBooks([]);
        setAlbums([]);
        setVideos([]);
        return;
      }

      setCreator(profileRes);
      const [tracksRes, booksRes, albumsRes, videosRes, salesRes, dashRes] = await Promise.all([
        getCreatorTracks(profileRes._id),
        getCreatorBooks(profileRes._id),
        getCreatorAlbums(profileRes._id),
        getCreatorVideos(profileRes._id).catch(() => []),
        getCreatorSales().catch(() => ({ totalSalesCount: 0, totalRevenue: 0, currency: "NGN" })),
        getCreatorDashboard().catch(() => null),
      ]);
      setTracks(Array.isArray(tracksRes) ? tracksRes : []);
      setBooks(Array.isArray(booksRes) ? booksRes : []);
      setAlbums(Array.isArray(albumsRes) ? albumsRes : []);
      setVideos(Array.isArray(videosRes) ? videosRes : []);
      setSales({
        totalSalesCount: Number(dashRes?.totalSales ?? salesRes?.totalSalesCount ?? 0),
        totalRevenue: Number(dashRes?.revenueNGN ?? salesRes?.totalRevenue ?? 0),
        currency: "NGN",
      });
    } catch (err) {
      setPageError(err.message || "Refresh failed.");
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    setPageError("");
    try {
      const genres = profileForm.genresRaw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, 12);
      const links = [
        profileForm.youtube ? { label: "YouTube", url: profileForm.youtube.trim() } : null,
        profileForm.spotify ? { label: "Spotify", url: profileForm.spotify.trim() } : null,
      ].filter(Boolean);

      await upsertCreatorProfile({
        displayName: profileForm.displayName.trim(),
        bio: profileForm.bio.trim(),
        heroBannerUrl: profileForm.heroBannerUrl.trim(),
        coverImageUrl: profileForm.heroBannerUrl.trim(),
        tagline: profileForm.tagline.trim(),
        genres,
        links,
        onboardingComplete: true,
      });
      await refreshAll();
      setSettingsOpen(false);
    } catch (err) {
      setPageError(err.message || "Failed to save creator profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const archiveContent = async () => {
    if (!creator?._id) {
      return;
    }
    const confirmed = await confirm({
      title: "Archive creator content?",
      description:
        "Archive all currently displayed creator content for a fresh start. You can still re-upload later.",
      confirmLabel: "Archive content",
      cancelLabel: "Cancel",
      confirmVariant: "destructive",
    });
    if (!confirmed) {
      return;
    }
    setArchiving(true);
    setPageError("");
    try {
      await archiveMyCreatorContent();
      await refreshAll();
      toast.success("Creator content archived");
    } catch (err) {
      setPageError(err.message || "Failed to archive creator content.");
      toast.error(err.message || "Failed to archive creator content.");
    } finally {
      setArchiving(false);
    }
  };

  const submitTrack = async (event) => {
    event.preventDefault();
    setTrackStatus("");
    setTrackError("");
    setTrackProgress(0);
    try {
      if (!trackFiles.audio) {
        throw new Error("Full audio file is required.");
      }
      const form = new FormData();
      form.append("title", trackForm.title.trim());
      form.append("description", trackForm.description.trim());
      form.append("price", String(Number(trackForm.price || 0)));
      form.append("kind", "music");
      form.append("audio", trackFiles.audio);
      if (trackFiles.preview) {
        form.append("preview", trackFiles.preview);
      }
      if (trackFiles.cover) {
        form.append("cover", trackFiles.cover);
      }
      await createTrackWithUploadProgress(form, {
        onProgress: (percent) => setTrackProgress(Number(percent || 0)),
      });
      setTrackForm(TRACK_DEFAULT);
      setTrackFiles({ audio: null, preview: null, cover: null });
      setTrackStatus("Track published.");
      await refreshAll();
    } catch (err) {
      setTrackError(err.message || "Track upload failed.");
    }
  };

  const submitBook = async (event) => {
    event.preventDefault();
    setBookStatus("");
    setBookError("");
    setBookProgress(0);
    try {
      if (!bookFiles.content) {
        throw new Error("Book file upload is required.");
      }
      const form = new FormData();
      form.append("title", bookForm.title.trim());
      form.append("description", bookForm.description.trim());
      form.append("price", String(Number(bookForm.price || 0)));
      form.append("content", bookFiles.content);
      if (bookFiles.cover) {
        form.append("cover", bookFiles.cover);
      }
      await createBookWithUploadProgress(form, {
        onProgress: (percent) => setBookProgress(Number(percent || 0)),
      });
      setBookForm(BOOK_DEFAULT);
      setBookFiles({ cover: null, content: null });
      setBookStatus("Book published.");
      await refreshAll();
    } catch (err) {
      setBookError(err.message || "Book upload failed.");
    }
  };

  const submitAlbum = async (event) => {
    event.preventDefault();
    setAlbumStatus("");
    setAlbumError("");
    setAlbumProgress(0);
    try {
      if (!albumFiles.cover) {
        throw new Error("Cover image is required.");
      }
      if (!albumFiles.tracks.length) {
        throw new Error("Upload at least one album song.");
      }
      const form = new FormData();
      form.append("albumTitle", albumForm.albumTitle.trim());
      form.append("description", albumForm.description.trim());
      form.append("price", String(Number(albumForm.price || 0)));
      form.append("coverImage", albumFiles.cover);
      albumFiles.tracks.forEach((file) => form.append("tracks", file));
      albumFiles.previews.forEach((file) => form.append("previews", file));
      await createAlbumWithUploadProgress(form, {
        onProgress: (percent) => setAlbumProgress(Number(percent || 0)),
      });
      setAlbumForm(ALBUM_DEFAULT);
      setAlbumFiles({ cover: null, tracks: [], previews: [] });
      setAlbumStatus("Album published.");
      await refreshAll();
    } catch (err) {
      setAlbumError(err.message || "Album upload failed.");
    }
  };

  const submitVideo = async (event) => {
    event.preventDefault();
    setVideoStatus("");
    setVideoError("");
    setVideoProgress(0);
    try {
      if (!videoFiles.video) {
        throw new Error("Video file is required.");
      }
      const form = new FormData();
      form.append("title", videoForm.title.trim());
      form.append("description", videoForm.description.trim());
      form.append("price", String(Number(videoForm.price || 0)));
      form.append("video", videoFiles.video);
      if (videoFiles.thumbnail) {
        form.append("thumbnail", videoFiles.thumbnail);
      }
      if (videoFiles.previewClip) {
        form.append("previewClip", videoFiles.previewClip);
      }
      await createCreatorVideoWithUploadProgress(form, {
        onProgress: (percent) => setVideoProgress(Number(percent || 0)),
      });
      setVideoForm(VIDEO_DEFAULT);
      setVideoFiles({ video: null, thumbnail: null, previewClip: null });
      setVideoStatus("Video published.");
      await refreshAll();
    } catch (err) {
      setVideoError(err.message || "Video upload failed.");
    }
  };

  const submitPodcast = async (event) => {
    event.preventDefault();
    setPodcastStatus("");
    setPodcastError("");
    setPodcastProgress(0);
    try {
      if (!podcastFiles.audio) {
        throw new Error("Full audio upload is required.");
      }
      const form = new FormData();
      form.append("title", podcastForm.title.trim());
      form.append("description", podcastForm.description.trim());
      form.append("kind", "podcast");
      form.append("podcastSeries", podcastForm.podcastSeries.trim());
      form.append("seasonNumber", String(Number(podcastForm.seasonNumber || 0)));
      form.append("episodeNumber", String(Number(podcastForm.episodeNumber || 0)));
      form.append(
        "price",
        String(podcastForm.accessType === "paid" ? Number(podcastForm.price || 0) : 0)
      );
      form.append("audio", podcastFiles.audio);
      if (podcastFiles.cover) {
        form.append("cover", podcastFiles.cover);
      }
      if (podcastFiles.preview) {
        form.append("preview", podcastFiles.preview);
      }
      await createTrackWithUploadProgress(form, {
        onProgress: (percent) => setPodcastProgress(Number(percent || 0)),
      });
      setPodcastForm(PODCAST_DEFAULT);
      setPodcastFiles({ audio: null, cover: null, preview: null });
      setPodcastStatus("Podcast published.");
      await refreshAll();
    } catch (err) {
      setPodcastError(err.message || "Podcast upload failed.");
    }
  };

  if (loading) {
    return (
      <div className="crd-shell">
        <div className="crd-empty">Loading creator dashboard...</div>
      </div>
    );
  }

  return (
    <div className="crd-shell">
      <aside className="crd-sidebar">
        <div className="crd-logo">
          <span className="crd-logo-mark">T</span>
          <span>Tengacion</span>
        </div>

        <nav className="crd-menu">
          <button className="active" type="button">
            <span className="crd-nav-icon">D</span>
            <span>Dashboard</span>
          </button>
          <button type="button">
            <span className="crd-nav-icon">C</span>
            <span>My Content</span>
          </button>
          <button type="button">
            <span className="crd-nav-icon">E</span>
            <span>Earnings</span>
          </button>
          <button type="button">
            <span className="crd-nav-icon">A</span>
            <span>Account</span>
          </button>
          <button type="button">
            <span className="crd-nav-icon">S</span>
            <span>Support</span>
          </button>
        </nav>

        <div className="crd-divider" />

        <nav className="crd-menu secondary">
          <button type="button">
            <span className="crd-nav-icon">C</span>
            <span>My Content</span>
          </button>
          <button className="active" type="button">
            <span className="crd-nav-icon">E</span>
            <span>Earnings</span>
          </button>
          <button type="button">
            <span className="crd-nav-icon">P</span>
            <span>Payouts</span>
          </button>
          <button type="button">
            <span className="crd-nav-icon">Q</span>
            <span>Account Settings</span>
          </button>
          <button type="button">
            <span className="crd-nav-icon">U</span>
            <span>Support</span>
          </button>
        </nav>
      </aside>

      <div className="crd-main">
        <header className="crd-topbar">
          <h1>Creator Dashboard</h1>
          <div className="crd-top-actions">
            <button type="button" className="crd-status-pill">
              <span className="crd-pill-dot" />
              <span>{creatorLocation}</span>
            </button>
            <button type="button" className="crd-icon-btn" aria-label="Notifications">
              O
            </button>
            <img src={creatorAvatar} alt={creatorName} />
          </div>
        </header>

        {pageError ? <div className="crd-banner error">{pageError}</div> : null}

        <section className="crd-summary-grid">
          <article>
            <div className="crd-summary-head">
              <span className="crd-summary-icon">B</span>
              <strong>{fmtMoney(stats.available)}</strong>
            </div>
            <p>Available Balance</p>
          </article>
          <article>
            <div className="crd-summary-head">
              <span className="crd-summary-icon">P</span>
              <strong>{fmtMoney(stats.pending)}</strong>
            </div>
            <p>Pending Balance</p>
          </article>
          <article>
            <div className="crd-summary-head">
              <span className="crd-summary-icon">W</span>
              <strong>{fmtMoney(stats.withdrawn)}</strong>
            </div>
            <p>Withdrawn</p>
          </article>
          <article>
            <div className="crd-summary-head">
              <span className="crd-summary-icon">T</span>
              <strong>{fmtMoney(stats.total)}</strong>
            </div>
            <p>Total Earnings</p>
          </article>
        </section>

        <div className="crd-layout">
          <main className="crd-content">
            <section className="crd-upload-board">
              <div className="crd-board-head">
                <h2>Upload New Content</h2>
                <div className="crd-board-actions">
                  <button type="button" className="crd-light-btn" onClick={() => setSettingsOpen((prev) => !prev)}>
                    {settingsOpen ? "Close Creator Details" : "Edit Creator Details"}
                  </button>
                  {creator?._id ? (
                    <button
                      type="button"
                      className="crd-light-btn"
                      onClick={() => navigate(`/creators/${creator._id}`)}
                    >
                      Preview Fan Page
                    </button>
                  ) : null}
                </div>
              </div>

              {settingsOpen ? (
                <form className="crd-settings-grid" onSubmit={saveProfile}>
                  <input
                    placeholder="Display name"
                    value={profileForm.displayName}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, displayName: event.target.value }))
                    }
                    required
                  />
                  <input
                    placeholder="Tagline"
                    value={profileForm.tagline}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, tagline: event.target.value }))
                    }
                  />
                  <input
                    placeholder="Categories"
                    value={profileForm.genresRaw}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, genresRaw: event.target.value }))
                    }
                  />
                  <input
                    placeholder="Hero image URL"
                    value={profileForm.heroBannerUrl}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, heroBannerUrl: event.target.value }))
                    }
                  />
                  <textarea
                    placeholder="Bio"
                    value={profileForm.bio}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, bio: event.target.value }))
                    }
                    rows={3}
                  />
                  <input
                    placeholder="YouTube URL"
                    value={profileForm.youtube}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, youtube: event.target.value }))
                    }
                  />
                  <input
                    placeholder="Spotify URL"
                    value={profileForm.spotify}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, spotify: event.target.value }))
                    }
                  />
                  <button type="submit" className="crd-submit-btn" disabled={profileSaving}>
                    {profileSaving ? "Saving..." : "Save Creator Details"}
                  </button>
                </form>
              ) : null}

              <div className="crd-upload-grid">
                <UploadCard icon="M" title="Upload Track">
                  <form className="crd-form" onSubmit={submitTrack}>
                    <input
                      placeholder="Track title"
                      value={trackForm.title}
                      onChange={(event) =>
                        setTrackForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      required
                    />
                    <input
                      placeholder="Description"
                      value={trackForm.description}
                      onChange={(event) =>
                        setTrackForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                    />
                    <DropZone
                      icon="A"
                      label="Full audio"
                      description="Browse or drag audio file"
                      accept="audio/*"
                      onChange={(file) => setTrackFiles((prev) => ({ ...prev, audio: file }))}
                      files={trackFiles.audio ? [trackFiles.audio] : []}
                    />
                    <DropZone
                      icon="P"
                      label="Preview sample"
                      description="Optional teaser upload"
                      accept="audio/*"
                      onChange={(file) => setTrackFiles((prev) => ({ ...prev, preview: file }))}
                      files={trackFiles.preview ? [trackFiles.preview] : []}
                    />
                    <DropZone
                      icon="I"
                      label="Cover image"
                      description="Square artwork"
                      accept="image/*"
                      onChange={(file) => setTrackFiles((prev) => ({ ...prev, cover: file }))}
                      files={trackFiles.cover ? [trackFiles.cover] : []}
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Price"
                      value={trackForm.price}
                      onChange={(event) =>
                        setTrackForm((prev) => ({ ...prev, price: event.target.value }))
                      }
                      required
                    />
                    <button type="submit" className="crd-submit-btn">Publish Track</button>
                    <ProgressState progress={trackProgress} status={trackStatus} error={trackError} />
                  </form>
                </UploadCard>

                <UploadCard icon="B" title="Create Book">
                  <form className="crd-form" onSubmit={submitBook}>
                    <input
                      placeholder="Book title"
                      value={bookForm.title}
                      onChange={(event) =>
                        setBookForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      required
                    />
                    <textarea
                      placeholder="Description"
                      value={bookForm.description}
                      onChange={(event) =>
                        setBookForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      rows={2}
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Price"
                      value={bookForm.price}
                      onChange={(event) =>
                        setBookForm((prev) => ({ ...prev, price: event.target.value }))
                      }
                      required
                    />
                    <DropZone
                      icon="C"
                      label="Cover image file"
                      description="Upload book artwork"
                      accept="image/*"
                      onChange={(file) => setBookFiles((prev) => ({ ...prev, cover: file }))}
                      files={bookFiles.cover ? [bookFiles.cover] : []}
                    />
                    <DropZone
                      icon="F"
                      label="Full book upload"
                      description="PDF, EPUB, MOBI, TXT"
                      accept=".pdf,.epub,.mobi,.txt"
                      onChange={(file) => setBookFiles((prev) => ({ ...prev, content: file }))}
                      files={bookFiles.content ? [bookFiles.content] : []}
                    />
                    <button type="submit" className="crd-submit-btn">Publish Book</button>
                    <ProgressState progress={bookProgress} status={bookStatus} error={bookError} />
                  </form>
                </UploadCard>

                <UploadCard icon="L" title="Upload Album">
                  <form className="crd-form" onSubmit={submitAlbum}>
                    <input
                      placeholder="Album title"
                      value={albumForm.albumTitle}
                      onChange={(event) =>
                        setAlbumForm((prev) => ({ ...prev, albumTitle: event.target.value }))
                      }
                      required
                    />
                    <textarea
                      placeholder="Description"
                      value={albumForm.description}
                      onChange={(event) =>
                        setAlbumForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      rows={2}
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Price"
                      value={albumForm.price}
                      onChange={(event) =>
                        setAlbumForm((prev) => ({ ...prev, price: event.target.value }))
                      }
                      required
                    />
                    <DropZone
                      icon="I"
                      label="Cover image file"
                      description="Album art"
                      accept="image/*"
                      onChange={(file) => setAlbumFiles((prev) => ({ ...prev, cover: file }))}
                      files={albumFiles.cover ? [albumFiles.cover] : []}
                    />
                    <DropZone
                      icon="S"
                      label="Album songs upload"
                      description="Upload multiple tracks"
                      accept="audio/*"
                      multiple
                      onChange={(files) =>
                        setAlbumFiles((prev) => ({
                          ...prev,
                          tracks: Array.isArray(files) ? files.slice(0, 25) : [],
                        }))
                      }
                      files={albumFiles.tracks}
                    />
                    <DropZone
                      icon="V"
                      label="Optional preview samples"
                      description="Optional teaser files"
                      accept="audio/*"
                      multiple
                      onChange={(files) =>
                        setAlbumFiles((prev) => ({
                          ...prev,
                          previews: Array.isArray(files) ? files.slice(0, 25) : [],
                        }))
                      }
                      files={albumFiles.previews}
                    />
                    <button type="submit" className="crd-submit-btn">Publish Album</button>
                    <ProgressState progress={albumProgress} status={albumStatus} error={albumError} />
                  </form>
                </UploadCard>

                <UploadCard icon="V" title="Upload Music Video">
                  <form className="crd-form" onSubmit={submitVideo}>
                    <input
                      placeholder="Video title"
                      value={videoForm.title}
                      onChange={(event) =>
                        setVideoForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      required
                    />
                    <textarea
                      placeholder="Description"
                      value={videoForm.description}
                      onChange={(event) =>
                        setVideoForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      rows={2}
                    />
                    <DropZone
                      icon="F"
                      label="Video file upload"
                      description="Drag and drop video"
                      accept="video/*"
                      onChange={(file) => setVideoFiles((prev) => ({ ...prev, video: file }))}
                      files={videoFiles.video ? [videoFiles.video] : []}
                    />
                    <DropZone
                      icon="T"
                      label="Thumbnail upload"
                      description="Poster image"
                      accept="image/*"
                      onChange={(file) => setVideoFiles((prev) => ({ ...prev, thumbnail: file }))}
                      files={videoFiles.thumbnail ? [videoFiles.thumbnail] : []}
                    />
                    <DropZone
                      icon="P"
                      label="Preview clip upload"
                      description="Short teaser"
                      accept="video/*"
                      onChange={(file) =>
                        setVideoFiles((prev) => ({ ...prev, previewClip: file }))
                      }
                      files={videoFiles.previewClip ? [videoFiles.previewClip] : []}
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Price"
                      value={videoForm.price}
                      onChange={(event) =>
                        setVideoForm((prev) => ({ ...prev, price: event.target.value }))
                      }
                      required
                    />
                    <button type="submit" className="crd-submit-btn">Publish Video</button>
                    <ProgressState progress={videoProgress} status={videoStatus} error={videoError} />
                  </form>
                </UploadCard>

                <UploadCard icon="P" title="Upload Podcast">
                  <form className="crd-form" onSubmit={submitPodcast}>
                    <input
                      placeholder="Episode title"
                      value={podcastForm.title}
                      onChange={(event) =>
                        setPodcastForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      required
                    />
                    <input
                      placeholder="Podcast series"
                      value={podcastForm.podcastSeries}
                      onChange={(event) =>
                        setPodcastForm((prev) => ({ ...prev, podcastSeries: event.target.value }))
                      }
                    />
                    <textarea
                      placeholder="Description"
                      value={podcastForm.description}
                      onChange={(event) =>
                        setPodcastForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      rows={2}
                    />
                    <DropZone
                      icon="A"
                      label="Full audio upload"
                      description="Podcast file"
                      accept="audio/*"
                      onChange={(file) => setPodcastFiles((prev) => ({ ...prev, audio: file }))}
                      files={podcastFiles.audio ? [podcastFiles.audio] : []}
                    />
                    <DropZone
                      icon="I"
                      label="Cover image upload"
                      description="Episode cover"
                      accept="image/*"
                      onChange={(file) => setPodcastFiles((prev) => ({ ...prev, cover: file }))}
                      files={podcastFiles.cover ? [podcastFiles.cover] : []}
                    />
                    <DropZone
                      icon="S"
                      label="Preview sample upload"
                      description="Optional sample"
                      accept="audio/*"
                      onChange={(file) => setPodcastFiles((prev) => ({ ...prev, preview: file }))}
                      files={podcastFiles.preview ? [podcastFiles.preview] : []}
                    />
                    <button type="submit" className="crd-submit-btn">Publish Podcast</button>
                    <ProgressState
                      progress={podcastProgress}
                      status={podcastStatus}
                      error={podcastError}
                    />
                  </form>
                </UploadCard>

                <UploadCard icon="E" title="Episode Details">
                  <form className="crd-form" onSubmit={submitPodcast}>
                    <input
                      placeholder="Episode title"
                      value={podcastForm.title}
                      onChange={(event) =>
                        setPodcastForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      required
                    />
                    <input
                      placeholder="Podcast series"
                      value={podcastForm.podcastSeries}
                      onChange={(event) =>
                        setPodcastForm((prev) => ({ ...prev, podcastSeries: event.target.value }))
                      }
                    />
                    <textarea
                      placeholder="Description"
                      value={podcastForm.description}
                      onChange={(event) =>
                        setPodcastForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      rows={2}
                    />
                    <div className="crd-inline-pair">
                      <input
                        type="number"
                        min="0"
                        placeholder="Season"
                        value={podcastForm.seasonNumber}
                        onChange={(event) =>
                          setPodcastForm((prev) => ({
                            ...prev,
                            seasonNumber: event.target.value,
                          }))
                        }
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="Episode"
                        value={podcastForm.episodeNumber}
                        onChange={(event) =>
                          setPodcastForm((prev) => ({
                            ...prev,
                            episodeNumber: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <select
                      value={podcastForm.accessType}
                      onChange={(event) =>
                        setPodcastForm((prev) => ({ ...prev, accessType: event.target.value }))
                      }
                    >
                      <option value="free">Free</option>
                      <option value="paid">Paid</option>
                    </select>
                    {podcastForm.accessType === "paid" ? (
                      <input
                        type="number"
                        min="0"
                        placeholder="Price"
                        value={podcastForm.price}
                        onChange={(event) =>
                          setPodcastForm((prev) => ({ ...prev, price: event.target.value }))
                        }
                        required
                      />
                    ) : null}
                    <button type="submit" className="crd-submit-btn">Publish Podcast</button>
                  </form>
                </UploadCard>
              </div>
            </section>
          </main>

          <aside className="crd-right-panel">
            <section className="crd-side-card">
              <h3>Earnings</h3>
              <p className="crd-side-muted">Current week</p>
              <strong className="crd-side-total">{fmtMoney(stats.available)}</strong>
              <div className="crd-week-chart" aria-hidden="true">
                <span style={{ height: "24%" }} />
                <span style={{ height: "18%" }} />
                <span style={{ height: "27%" }} />
                <span style={{ height: "22%" }} />
                <span style={{ height: "41%" }} />
                <span style={{ height: "36%" }} />
                <span style={{ height: "58%" }} />
                <span style={{ height: "74%" }} />
                <span style={{ height: "79%" }} />
              </div>
              <ul className="crd-breakdown">
                <li><span>Music Sales</span><b>{fmtMoney(stats.total * 0.18)}</b></li>
                <li><span>Book Sales</span><b>{fmtMoney(stats.total * 0.1)}</b></li>
                <li><span>Video Unlocks</span><b>{fmtMoney(stats.total * 0.14)}</b></li>
                <li><span>Podcast Streams</span><b>{fmtMoney(stats.total * 0.12)}</b></li>
                <li><span>Tips</span><b>{fmtMoney(stats.total * 0.05)}</b></li>
              </ul>
              <button type="button" className="crd-submit-btn">Withdraw Earnings</button>
            </section>

            <section className="crd-side-card">
              <div className="crd-payout-head">
                <h3>Payout Account</h3>
                <span className="crd-soft-dot" />
              </div>
              <div className="crd-payout-user">
                <div className="crd-payout-avatar">{creatorName.slice(0, 1).toUpperCase()}</div>
                <div>
                  <strong>{creatorName}</strong>
                  <p>GTBank - 0441****8905</p>
                </div>
              </div>
              <div className="crd-split-row">
                <span>40% Creator</span>
                <b>{fmtMoney(stats.total)}</b>
              </div>
              <div className="crd-split-row">
                <span>60% Tengacion</span>
                <b>{fmtMoney(stats.platformTotal)}</b>
              </div>
              <button type="button" className="crd-submit-btn">Manage Accounts</button>
              <button type="button" className="crd-light-btn full">Add Account</button>
            </section>

            <section className="crd-side-card compact">
              <div className="crd-card-head">
                <h3>Library</h3>
                <button type="button" className="crd-light-btn" onClick={archiveContent} disabled={archiving}>
                  {archiving ? "Archiving..." : "Reset Display"}
                </button>
              </div>
              <ul className="compact-list">
                <li><span>Singles</span><b>{musicTracks.length}</b></li>
                <li><span>Albums</span><b>{albums.length}</b></li>
                <li><span>Books</span><b>{books.length}</b></li>
                <li><span>Videos</span><b>{videos.length}</b></li>
                <li><span>Podcasts</span><b>{podcastTracks.length}</b></li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
