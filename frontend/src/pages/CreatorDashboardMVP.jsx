import { useCallback, useEffect, useMemo, useState } from "react";
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
import "./creator-redesign.css";

const CREATOR_DEFAULTS = {
  displayName: "",
  bio: "",
  heroBannerUrl: "",
  tagline: "",
  genresRaw: "",
  youtube: "",
  spotify: "",
};

const TRACK_DEFAULT = {
  title: "",
  description: "",
  price: "",
};

const BOOK_DEFAULT = {
  title: "",
  description: "",
  price: "",
};

const ALBUM_DEFAULT = {
  albumTitle: "",
  description: "",
  price: "",
};

const VIDEO_DEFAULT = {
  title: "",
  description: "",
  price: "",
};

const PODCAST_DEFAULT = {
  title: "",
  podcastSeries: "",
  description: "",
  seasonNumber: "",
  episodeNumber: "",
  accessType: "free",
  price: "",
};

const fmtMoney = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

function DropZone({ label, description, accept, multiple = false, files = [], onChange }) {
  const [dragging, setDragging] = useState(false);

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    const list = Array.from(event.dataTransfer?.files || []);
    if (!list.length) return;
    onChange(multiple ? list : list[0]);
  };

  return (
    <label
      className={`crd-drop ${dragging ? "is-dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
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
      <strong>{label}</strong>
      <span>{description}</span>
      {files.length ? (
        <ul>
          {files.map((file, idx) => (
            <li key={`${file.name}-${idx}`}>{file.name}</li>
          ))}
        </ul>
      ) : null}
    </label>
  );
}

function ProgressState({ progress, status, error }) {
  if (!progress && !status && !error) return null;
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

export default function CreatorDashboardMVP() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [creator, setCreator] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [books, setBooks] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [videos, setVideos] = useState([]);
  const [sales, setSales] = useState({ totalSalesCount: 0, totalRevenue: 0, currency: "NGN" });

  const [profileForm, setProfileForm] = useState(CREATOR_DEFAULTS);
  const [profileSaving, setProfileSaving] = useState(false);

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

  const [archiving, setArchiving] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const [profileRes, salesRes, dashRes] = await Promise.all([
        getMyCreatorProfile().catch(() => null),
        getCreatorSales().catch(() => ({ totalSalesCount: 0, totalRevenue: 0, currency: "NGN" })),
        getCreatorDashboard().catch(() => null),
      ]);

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
        setTracks(Array.isArray(tracksRes) ? tracksRes : []);
        setBooks(Array.isArray(booksRes) ? booksRes : []);
        setAlbums(Array.isArray(albumsRes) ? albumsRes : []);
        setVideos(Array.isArray(videosRes) ? videosRes : []);

        const links = Array.isArray(profileRes.links) ? profileRes.links : [];
        const youtube = links.find((entry) => String(entry?.label || "").toLowerCase().includes("youtube"))?.url || "";
        const spotify = links.find((entry) => String(entry?.label || "").toLowerCase().includes("spotify"))?.url || "";

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
      setPageError(err.message || "Failed to load creator dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const total = Number(sales.totalRevenue || 0);
    const withdrawn = Math.round(total * 0.35);
    const pending = Math.round(total * 0.25);
    const available = Math.max(0, total - withdrawn - pending);
    return {
      available,
      pending,
      withdrawn,
      total,
    };
  }, [sales.totalRevenue]);

  const profileAvatar = resolveImage(creator?.user?.avatar || creator?.avatarUrl) || "/avatar.png";
  const profileName = creator?.displayName || creator?.user?.name || "Creator";

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

      const payload = await upsertCreatorProfile({
        displayName: profileForm.displayName.trim(),
        bio: profileForm.bio.trim(),
        heroBannerUrl: profileForm.heroBannerUrl.trim(),
        coverImageUrl: profileForm.heroBannerUrl.trim(),
        tagline: profileForm.tagline.trim(),
        genres,
        links,
        onboardingComplete: true,
      });
      setCreator(payload);
      await loadDashboard();
    } catch (err) {
      setPageError(err.message || "Failed to save profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const submitTrack = async (event) => {
    event.preventDefault();
    setTrackStatus("");
    setTrackError("");
    setTrackProgress(0);
    try {
      const form = new FormData();
      form.append("title", trackForm.title.trim());
      form.append("description", trackForm.description.trim());
      form.append("price", String(Number(trackForm.price || 0)));
      form.append("kind", "music");
      if (trackFiles.audio) form.append("audio", trackFiles.audio);
      if (trackFiles.preview) form.append("preview", trackFiles.preview);
      if (trackFiles.cover) form.append("cover", trackFiles.cover);
      if (!trackFiles.audio) throw new Error("Full audio file is required.");

      await createTrackWithUploadProgress(form, {
        onProgress: (percent) => setTrackProgress(Number(percent || 0)),
      });
      setTrackForm(TRACK_DEFAULT);
      setTrackFiles({ audio: null, preview: null, cover: null });
      setTrackStatus("Track published successfully.");
      await loadDashboard();
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
      if (!bookFiles.content) throw new Error("Book file upload is required.");
      const form = new FormData();
      form.append("title", bookForm.title.trim());
      form.append("description", bookForm.description.trim());
      form.append("price", String(Number(bookForm.price || 0)));
      if (bookFiles.cover) form.append("cover", bookFiles.cover);
      form.append("content", bookFiles.content);

      await createBookWithUploadProgress(form, {
        onProgress: (percent) => setBookProgress(Number(percent || 0)),
      });
      setBookForm(BOOK_DEFAULT);
      setBookFiles({ cover: null, content: null });
      setBookStatus("Book published successfully.");
      await loadDashboard();
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
      if (!albumFiles.cover) throw new Error("Album cover is required.");
      if (!albumFiles.tracks.length) throw new Error("Upload at least one album song.");
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
      setAlbumStatus("Album published successfully.");
      await loadDashboard();
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
      if (!videoFiles.video) throw new Error("Video file is required.");
      const form = new FormData();
      form.append("title", videoForm.title.trim());
      form.append("description", videoForm.description.trim());
      form.append("price", String(Number(videoForm.price || 0)));
      form.append("video", videoFiles.video);
      if (videoFiles.thumbnail) form.append("thumbnail", videoFiles.thumbnail);
      if (videoFiles.previewClip) form.append("previewClip", videoFiles.previewClip);

      await createCreatorVideoWithUploadProgress(form, {
        onProgress: (percent) => setVideoProgress(Number(percent || 0)),
      });
      setVideoForm(VIDEO_DEFAULT);
      setVideoFiles({ video: null, thumbnail: null, previewClip: null });
      setVideoStatus("Video published successfully.");
      await loadDashboard();
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
      if (!podcastFiles.audio) throw new Error("Full podcast audio is required.");
      const isPaid = podcastForm.accessType === "paid";
      const form = new FormData();
      form.append("title", podcastForm.title.trim());
      form.append("description", podcastForm.description.trim());
      form.append("kind", "podcast");
      form.append("podcastSeries", podcastForm.podcastSeries.trim());
      form.append("seasonNumber", String(Number(podcastForm.seasonNumber || 0)));
      form.append("episodeNumber", String(Number(podcastForm.episodeNumber || 0)));
      form.append("price", String(isPaid ? Number(podcastForm.price || 0) : 0));
      form.append("audio", podcastFiles.audio);
      if (podcastFiles.cover) form.append("cover", podcastFiles.cover);
      if (podcastFiles.preview) form.append("preview", podcastFiles.preview);

      await createTrackWithUploadProgress(form, {
        onProgress: (percent) => setPodcastProgress(Number(percent || 0)),
      });
      setPodcastForm(PODCAST_DEFAULT);
      setPodcastFiles({ audio: null, cover: null, preview: null });
      setPodcastStatus("Podcast published successfully.");
      await loadDashboard();
    } catch (err) {
      setPodcastError(err.message || "Podcast upload failed.");
    }
  };

  const archiveContent = async () => {
    if (!creator?._id) return;
    const confirmReset = window.confirm(
      "Archive all currently displayed creator content for a fresh start? This is non-destructive and can be restored manually in database operations."
    );
    if (!confirmReset) return;
    setArchiving(true);
    setPageError("");
    try {
      await archiveMyCreatorContent();
      await loadDashboard();
    } catch (err) {
      setPageError(err.message || "Failed to archive creator content.");
    } finally {
      setArchiving(false);
    }
  };

  const musicTracks = tracks.filter((entry) => (entry.kind || "music") === "music");
  const podcastTracks = tracks.filter((entry) => (entry.kind || "music") === "podcast");

  if (loading) {
    return <div className="crd-shell"><div className="crd-empty">Loading creator dashboard...</div></div>;
  }

  return (
    <div className="crd-shell">
      <aside className="crd-sidebar">
        <div className="crd-logo">Tengacion</div>
        <nav className="crd-menu">
          <button className="active" type="button">Dashboard</button>
          <button type="button">My Content</button>
          <button type="button">Earnings</button>
          <button type="button">Account</button>
          <button type="button">Support</button>
        </nav>
        <div className="crd-submenu-title">Creator tools</div>
        <nav className="crd-menu secondary">
          <button type="button">My Content</button>
          <button type="button">Earnings</button>
          <button type="button">Payouts</button>
          <button type="button">Account Settings</button>
          <button type="button">Support</button>
        </nav>
      </aside>

      <div className="crd-main">
        <header className="crd-topbar">
          <div>
            <h1>Creator Dashboard</h1>
            <p>Upload and manage premium content for fans.</p>
          </div>
          <div className="crd-top-actions">
            {creator?._id ? (
              <button type="button" className="ghost" onClick={() => navigate(`/creators/${creator._id}`)}>
                View Public Creator Page
              </button>
            ) : null}
            <span className="pill">Lagos, Nigeria</span>
            <button type="button" className="icon" aria-label="Notifications">N</button>
            <img src={profileAvatar} alt={profileName} />
          </div>
        </header>

        {pageError ? <div className="crd-banner error">{pageError}</div> : null}

        <section className="crd-summary-grid">
          <article><p>Available Balance</p><strong>{fmtMoney(stats.available)}</strong></article>
          <article><p>Pending Balance</p><strong>{fmtMoney(stats.pending)}</strong></article>
          <article><p>Withdrawn</p><strong>{fmtMoney(stats.withdrawn)}</strong></article>
          <article><p>Total Earnings</p><strong>{fmtMoney(stats.total)}</strong></article>
        </section>

        <div className="crd-layout">
          <main className="crd-content">
            <section className="crd-card">
              <div className="crd-card-head">
                <h2>Profile and Links</h2>
                <button type="button" className="warn" onClick={archiveContent} disabled={archiving}>
                  {archiving ? "Archiving..." : "Archive Existing Content"}
                </button>
              </div>
              <form className="crd-form two" onSubmit={saveProfile}>
                <input
                  placeholder="Display name"
                  value={profileForm.displayName}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, displayName: event.target.value }))}
                  required
                />
                <input
                  placeholder="Tagline"
                  value={profileForm.tagline}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, tagline: event.target.value }))}
                />
                <textarea
                  placeholder="Creator bio"
                  value={profileForm.bio}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, bio: event.target.value }))}
                  rows={3}
                />
                <input
                  placeholder="Hero/cover image URL"
                  value={profileForm.heroBannerUrl}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, heroBannerUrl: event.target.value }))}
                />
                <input
                  placeholder="Categories (comma separated)"
                  value={profileForm.genresRaw}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, genresRaw: event.target.value }))}
                />
                <input
                  placeholder="YouTube URL"
                  value={profileForm.youtube}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, youtube: event.target.value }))}
                />
                <input
                  placeholder="Spotify URL"
                  value={profileForm.spotify}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, spotify: event.target.value }))}
                />
                <button type="submit" className="primary" disabled={profileSaving}>
                  {profileSaving ? "Saving..." : "Save Profile"}
                </button>
              </form>
            </section>

            <section className="crd-upload-section">
              <h2>Upload New Content</h2>

              <article className="crd-card">
                <h3>Upload Track</h3>
                <form className="crd-form" onSubmit={submitTrack}>
                  <input placeholder="Track title" value={trackForm.title} onChange={(e) => setTrackForm((p) => ({ ...p, title: e.target.value }))} required />
                  <textarea placeholder="Description" value={trackForm.description} onChange={(e) => setTrackForm((p) => ({ ...p, description: e.target.value }))} rows={2} />
                  <input type="number" min="0" placeholder="Price" value={trackForm.price} onChange={(e) => setTrackForm((p) => ({ ...p, price: e.target.value }))} required />
                  <div className="crd-grid-3">
                    <DropZone label="Full audio" description="Drag file or click" accept="audio/*" onChange={(file) => setTrackFiles((p) => ({ ...p, audio: file }))} files={trackFiles.audio ? [trackFiles.audio] : []} />
                    <DropZone label="Preview sample" description="Optional for free tracks" accept="audio/*" onChange={(file) => setTrackFiles((p) => ({ ...p, preview: file }))} files={trackFiles.preview ? [trackFiles.preview] : []} />
                    <DropZone label="Cover image" description="Square recommended" accept="image/*" onChange={(file) => setTrackFiles((p) => ({ ...p, cover: file }))} files={trackFiles.cover ? [trackFiles.cover] : []} />
                  </div>
                  <button type="submit" className="primary">Publish Track</button>
                  <ProgressState progress={trackProgress} status={trackStatus} error={trackError} />
                </form>
              </article>

              <article className="crd-card">
                <h3>Create Book</h3>
                <form className="crd-form" onSubmit={submitBook}>
                  <input placeholder="Book title" value={bookForm.title} onChange={(e) => setBookForm((p) => ({ ...p, title: e.target.value }))} required />
                  <textarea placeholder="Description" value={bookForm.description} onChange={(e) => setBookForm((p) => ({ ...p, description: e.target.value }))} rows={2} />
                  <input type="number" min="0" placeholder="Price" value={bookForm.price} onChange={(e) => setBookForm((p) => ({ ...p, price: e.target.value }))} required />
                  <div className="crd-grid-2">
                    <DropZone label="Cover image upload" description="Drag image here" accept="image/*" onChange={(file) => setBookFiles((p) => ({ ...p, cover: file }))} files={bookFiles.cover ? [bookFiles.cover] : []} />
                    <DropZone label="Book file upload" description="PDF, EPUB, MOBI, TXT" accept=".pdf,.epub,.mobi,.txt" onChange={(file) => setBookFiles((p) => ({ ...p, content: file }))} files={bookFiles.content ? [bookFiles.content] : []} />
                  </div>
                  <button type="submit" className="primary">Publish Book</button>
                  <ProgressState progress={bookProgress} status={bookStatus} error={bookError} />
                </form>
              </article>

              <article className="crd-card">
                <h3>Upload Album</h3>
                <form className="crd-form" onSubmit={submitAlbum}>
                  <input placeholder="Album title" value={albumForm.albumTitle} onChange={(e) => setAlbumForm((p) => ({ ...p, albumTitle: e.target.value }))} required />
                  <textarea placeholder="Description" value={albumForm.description} onChange={(e) => setAlbumForm((p) => ({ ...p, description: e.target.value }))} rows={2} />
                  <input type="number" min="0" placeholder="Price" value={albumForm.price} onChange={(e) => setAlbumForm((p) => ({ ...p, price: e.target.value }))} required />
                  <DropZone label="Cover image upload" description="Album art" accept="image/*" onChange={(file) => setAlbumFiles((p) => ({ ...p, cover: file }))} files={albumFiles.cover ? [albumFiles.cover] : []} />
                  <div className="crd-grid-2">
                    <DropZone label="Album songs upload" description="Multiple files" accept="audio/*" multiple onChange={(files) => setAlbumFiles((p) => ({ ...p, tracks: files.slice(0, 25) }))} files={albumFiles.tracks} />
                    <DropZone label="Optional preview samples" description="Optional" accept="audio/*" multiple onChange={(files) => setAlbumFiles((p) => ({ ...p, previews: files.slice(0, 25) }))} files={albumFiles.previews} />
                  </div>
                  <button type="submit" className="primary">Publish Album</button>
                  <ProgressState progress={albumProgress} status={albumStatus} error={albumError} />
                </form>
              </article>

              <article className="crd-card">
                <h3>Upload Music Video</h3>
                <form className="crd-form" onSubmit={submitVideo}>
                  <input placeholder="Video title" value={videoForm.title} onChange={(e) => setVideoForm((p) => ({ ...p, title: e.target.value }))} required />
                  <textarea placeholder="Description" value={videoForm.description} onChange={(e) => setVideoForm((p) => ({ ...p, description: e.target.value }))} rows={2} />
                  <input type="number" min="0" placeholder="Price" value={videoForm.price} onChange={(e) => setVideoForm((p) => ({ ...p, price: e.target.value }))} required />
                  <div className="crd-grid-3">
                    <DropZone label="Video file upload" description="Main video" accept="video/*" onChange={(file) => setVideoFiles((p) => ({ ...p, video: file }))} files={videoFiles.video ? [videoFiles.video] : []} />
                    <DropZone label="Thumbnail upload" description="Poster image" accept="image/*" onChange={(file) => setVideoFiles((p) => ({ ...p, thumbnail: file }))} files={videoFiles.thumbnail ? [videoFiles.thumbnail] : []} />
                    <DropZone label="Preview clip upload" description="Short teaser" accept="video/*" onChange={(file) => setVideoFiles((p) => ({ ...p, previewClip: file }))} files={videoFiles.previewClip ? [videoFiles.previewClip] : []} />
                  </div>
                  <button type="submit" className="primary">Publish Video</button>
                  <ProgressState progress={videoProgress} status={videoStatus} error={videoError} />
                </form>
              </article>

              <article className="crd-card">
                <h3>Upload Podcast</h3>
                <form className="crd-form" onSubmit={submitPodcast}>
                  <input placeholder="Episode title" value={podcastForm.title} onChange={(e) => setPodcastForm((p) => ({ ...p, title: e.target.value }))} required />
                  <input placeholder="Podcast series" value={podcastForm.podcastSeries} onChange={(e) => setPodcastForm((p) => ({ ...p, podcastSeries: e.target.value }))} />
                  <textarea placeholder="Description" value={podcastForm.description} onChange={(e) => setPodcastForm((p) => ({ ...p, description: e.target.value }))} rows={2} />
                  <div className="crd-grid-3">
                    <input type="number" min="0" placeholder="Season number" value={podcastForm.seasonNumber} onChange={(e) => setPodcastForm((p) => ({ ...p, seasonNumber: e.target.value }))} />
                    <input type="number" min="0" placeholder="Episode number" value={podcastForm.episodeNumber} onChange={(e) => setPodcastForm((p) => ({ ...p, episodeNumber: e.target.value }))} />
                    <select value={podcastForm.accessType} onChange={(e) => setPodcastForm((p) => ({ ...p, accessType: e.target.value }))}>
                      <option value="free">Free</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                  {podcastForm.accessType === "paid" ? (
                    <input type="number" min="0" placeholder="Podcast price" value={podcastForm.price} onChange={(e) => setPodcastForm((p) => ({ ...p, price: e.target.value }))} required />
                  ) : null}
                  <div className="crd-grid-3">
                    <DropZone label="Full audio upload" description="Main episode" accept="audio/*" onChange={(file) => setPodcastFiles((p) => ({ ...p, audio: file }))} files={podcastFiles.audio ? [podcastFiles.audio] : []} />
                    <DropZone label="Cover image upload" description="Episode art" accept="image/*" onChange={(file) => setPodcastFiles((p) => ({ ...p, cover: file }))} files={podcastFiles.cover ? [podcastFiles.cover] : []} />
                    <DropZone label="Preview sample upload" description="Teaser sample" accept="audio/*" onChange={(file) => setPodcastFiles((p) => ({ ...p, preview: file }))} files={podcastFiles.preview ? [podcastFiles.preview] : []} />
                  </div>
                  <button type="submit" className="primary">Publish Podcast</button>
                  <ProgressState progress={podcastProgress} status={podcastStatus} error={podcastError} />
                </form>
              </article>
            </section>
          </main>

          <aside className="crd-right-panel">
            <section className="crd-card earnings">
              <h3>Earnings</h3>
              <div className="crd-week-chart" aria-hidden="true">
                <span style={{ height: "35%" }} />
                <span style={{ height: "60%" }} />
                <span style={{ height: "42%" }} />
                <span style={{ height: "78%" }} />
                <span style={{ height: "55%" }} />
                <span style={{ height: "88%" }} />
                <span style={{ height: "66%" }} />
              </div>
              <ul className="crd-breakdown">
                <li><span>Music Sales</span><b>{fmtMoney(stats.total * 0.38)}</b></li>
                <li><span>Book Sales</span><b>{fmtMoney(stats.total * 0.16)}</b></li>
                <li><span>Video Unlocks</span><b>{fmtMoney(stats.total * 0.19)}</b></li>
                <li><span>Podcast Streams</span><b>{fmtMoney(stats.total * 0.11)}</b></li>
                <li><span>Tips</span><b>{fmtMoney(stats.total * 0.16)}</b></li>
              </ul>
              <button type="button" className="primary full">Withdraw Earnings</button>
            </section>

            <section className="crd-card payout">
              <h3>Payout Account</h3>
              <p>Connect payout channels to receive creator earnings quickly.</p>
              <button type="button" className="ghost full">Manage Accounts</button>
              <button type="button" className="primary full">Add Account</button>
            </section>

            <section className="crd-card compact">
              <h3>Published Summary</h3>
              <ul className="compact-list">
                <li><span>Singles</span><b>{musicTracks.length}</b></li>
                <li><span>Podcasts</span><b>{podcastTracks.length}</b></li>
                <li><span>Albums</span><b>{albums.length}</b></li>
                <li><span>Books</span><b>{books.length}</b></li>
                <li><span>Videos</span><b>{videos.length}</b></li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
