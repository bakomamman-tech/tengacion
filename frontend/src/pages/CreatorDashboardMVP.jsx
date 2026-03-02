import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createAlbumWithUploadProgress,
  createBook,
  createBookChapter,
  createTrack,
  getCreatorAlbums,
  getCreatorBooks,
  getCreatorSales,
  getCreatorTracks,
  getMyCreatorProfile,
  initPayment,
  resolveImage,
  upsertCreatorProfile,
} from "../api";

const defaultCreatorForm = {
  displayName: "",
  bio: "",
  coverImageUrl: "",
};

const defaultTrackForm = {
  title: "",
  description: "",
  price: "",
  audioUrl: "",
  previewUrl: "",
  coverImageUrl: "",
  durationSec: "",
};

const defaultBookForm = {
  title: "",
  description: "",
  price: "",
  coverImageUrl: "",
  contentUrl: "",
};

const defaultAlbumForm = {
  albumTitle: "",
  description: "",
  price: "",
};

const defaultChapterForm = {
  bookId: "",
  title: "",
  order: "",
  content: "",
  isFree: true,
};

export default function CreatorDashboardMVP() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creator, setCreator] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [books, setBooks] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [sales, setSales] = useState({
    totalSalesCount: 0,
    totalRevenue: 0,
    currency: "NGN",
  });

  const [creatorForm, setCreatorForm] = useState(defaultCreatorForm);
  const [trackForm, setTrackForm] = useState(defaultTrackForm);
  const [bookForm, setBookForm] = useState(defaultBookForm);
  const [albumForm, setAlbumForm] = useState(defaultAlbumForm);
  const [chapterForm, setChapterForm] = useState(defaultChapterForm);
  const [profileSaving, setProfileSaving] = useState(false);
  const [trackSaving, setTrackSaving] = useState(false);
  const [bookSaving, setBookSaving] = useState(false);
  const [albumSaving, setAlbumSaving] = useState(false);
  const [chapterSaving, setChapterSaving] = useState(false);
  const [trackStatus, setTrackStatus] = useState("");
  const trackStatusTimerRef = useRef(null);
  const [trackFiles, setTrackFiles] = useState({
    audio: null,
    preview: null,
    cover: null,
  });
  const [trackFileUrls, setTrackFileUrls] = useState({
    audio: "",
    preview: "",
    cover: "",
  });
  const [bookFiles, setBookFiles] = useState({ cover: null, content: null });
  const [bookFileUrls, setBookFileUrls] = useState({ cover: "", content: "" });
  const [albumCoverFile, setAlbumCoverFile] = useState(null);
  const [albumCoverUrl, setAlbumCoverUrl] = useState("");
  const [albumSongs, setAlbumSongs] = useState([]);
  const [albumPreviews, setAlbumPreviews] = useState([]);
  const [albumProgress, setAlbumProgress] = useState(0);
  const [albumCurrentFile, setAlbumCurrentFile] = useState("");
  const [albumStatus, setAlbumStatus] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const trackFileUrlRef = useRef(trackFileUrls);
  const bookFileUrlRef = useRef(bookFileUrls);
  const albumCoverUrlRef = useRef(albumCoverUrl);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [profileRes, salesRes] = await Promise.all([
        getMyCreatorProfile().catch(() => null),
        getCreatorSales().catch(() => ({ totalSalesCount: 0, totalRevenue: 0, currency: "NGN" })),
      ]);

      setCreator(profileRes || null);
      setSales(salesRes || { totalSalesCount: 0, totalRevenue: 0, currency: "NGN" });

      if (profileRes?._id) {
        const [tracksRes, booksRes, albumsRes] = await Promise.all([
          getCreatorTracks(profileRes._id),
          getCreatorBooks(profileRes._id),
          getCreatorAlbums(profileRes._id),
        ]);
        setTracks(Array.isArray(tracksRes) ? tracksRes : []);
        const booksList = Array.isArray(booksRes) ? booksRes : [];
        setAlbums(Array.isArray(albumsRes) ? albumsRes : []);
        setBooks(booksList);
        setChapterForm((prev) => ({
          ...prev,
          bookId: prev.bookId || booksList[0]?._id || "",
        }));
      } else {
        setTracks([]);
        setBooks([]);
        setAlbums([]);
      }
      return profileRes || null;
    } catch (err) {
      setError(err.message || "Failed to load dashboard");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const releaseObjectUrls = (urls = {}) => {
    Object.values(urls).forEach((value) => {
      if (value) {
        URL.revokeObjectURL(value);
      }
    });
  };

  useEffect(() => {
    trackFileUrlRef.current = trackFileUrls;
  }, [trackFileUrls]);

  useEffect(() => {
    bookFileUrlRef.current = bookFileUrls;
  }, [bookFileUrls]);

  useEffect(() => {
    albumCoverUrlRef.current = albumCoverUrl;
  }, [albumCoverUrl]);

  useEffect(() => {
    return () => {
      releaseObjectUrls(trackFileUrlRef.current);
      releaseObjectUrls(bookFileUrlRef.current);
      if (albumCoverUrlRef.current) {
        URL.revokeObjectURL(albumCoverUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (trackStatusTimerRef.current) {
        clearTimeout(trackStatusTimerRef.current);
      }
    };
  }, []);

  const showTrackStatus = useCallback((message) => {
    setTrackStatus(message || "");
    if (trackStatusTimerRef.current) {
      clearTimeout(trackStatusTimerRef.current);
    }
    if (message) {
      trackStatusTimerRef.current = setTimeout(() => setTrackStatus(""), 6000);
    }
  }, []);

  const handleTrackFileChange = (name, file) => {
    setTrackFiles((prev) => ({ ...prev, [name]: file || null }));
    setTrackFileUrls((prev) => {
      if (prev[name]) {
        URL.revokeObjectURL(prev[name]);
      }
      return { ...prev, [name]: file ? URL.createObjectURL(file) : "" };
    });
  };

  const resetTrackFileUploads = () => {
    releaseObjectUrls(trackFileUrls);
    setTrackFiles({ audio: null, preview: null, cover: null });
    setTrackFileUrls({ audio: "", preview: "", cover: "" });
  };

  const handleBookFileChange = (name, file) => {
    setBookFiles((prev) => ({ ...prev, [name]: file || null }));
    setBookFileUrls((prev) => {
      if (prev[name]) {
        URL.revokeObjectURL(prev[name]);
      }
      return { ...prev, [name]: file ? URL.createObjectURL(file) : "" };
    });
  };

  const resetBookFileUploads = () => {
    releaseObjectUrls(bookFileUrls);
    setBookFiles({ cover: null, content: null });
    setBookFileUrls({ cover: "", content: "" });
  };

  const formatBytes = (value = 0) => {
    const size = Number(value || 0);
    if (size <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const unitIndex = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
    const readable = size / (1024 ** unitIndex);
    return `${readable.toFixed(readable >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const resetAlbumUploads = () => {
    if (albumCoverUrl) {
      URL.revokeObjectURL(albumCoverUrl);
    }
    setAlbumCoverFile(null);
    setAlbumCoverUrl("");
    setAlbumSongs([]);
    setAlbumPreviews([]);
    setAlbumProgress(0);
    setAlbumCurrentFile("");
  };

  const validateAlbumForm = () => {
    const albumTitle = albumForm.albumTitle.trim();
    const price = Number(albumForm.price);
    if (!albumTitle) {
      return "Album title is required.";
    }
    if (!Number.isFinite(price) || price < 0) {
      return "Price must be a valid non-negative number.";
    }
    if (!albumCoverFile) {
      return "Cover image is required.";
    }
    if (albumSongs.length < 1) {
      return "Add at least one song.";
    }
    if (albumSongs.length > 25) {
      return "You can upload a maximum of 25 songs per album.";
    }
    return "";
  };

  const onAlbumCoverChange = (file) => {
    if (albumCoverUrl) {
      URL.revokeObjectURL(albumCoverUrl);
    }
    setAlbumCoverFile(file || null);
    setAlbumCoverUrl(file ? URL.createObjectURL(file) : "");
  };

  const onAlbumSongsChange = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length > 25) {
      setError("You can upload a maximum of 25 songs per album.");
      setAlbumSongs(files.slice(0, 25));
      return;
    }
    setAlbumSongs(files);
  };

  const onAlbumPreviewsChange = (fileList) => {
    const files = Array.from(fileList || []);
    setAlbumPreviews(files.slice(0, 25));
  };

  const removeAlbumSong = (indexToRemove) => {
    setAlbumSongs((prev) => prev.filter((_, index) => index !== indexToRemove));
    setAlbumPreviews((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const hasCreator = Boolean(creator?._id);

  const submitCreatorProfile = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    setError("");
    try {
      const profile = await upsertCreatorProfile({
        ...creatorForm,
        onboardingComplete: true,
      });
      setCreator(profile);
      setCreatorForm(defaultCreatorForm);
      const refreshed = await loadDashboard();
      if (refreshed?.creatorReady && refreshed?._id) {
        navigate(`/creators/${refreshed._id}`);
      }
    } catch (err) {
      setError(err.message || "Failed to save creator profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePaymentLaunch = async (itemType, itemId) => {
    setPaymentLoading(true);
    setError("");
    try {
      const payment = await initPayment({
        itemType,
        itemId,
        returnUrl: window.location.href,
      });

      if (payment?.authorization_url) {
        window.open(payment.authorization_url, "_blank");
      } else {
        setError("Unable to start payment right now.");
      }
    } catch (err) {
      setError(err.message || "Failed to create payment link");
    } finally {
      setPaymentLoading(false);
    }
  };

  const submitTrack = async (event) => {
    event.preventDefault();
    setTrackSaving(true);
    setError("");
    try {
      const trimmedTitle = trackForm.title.trim();
      const trimmedDescription = trackForm.description.trim();
      const price = Number(trackForm.price);
      const durationSec = Number(trackForm.durationSec || 0);
    const needsUpload = Boolean(trackFiles.audio || trackFiles.preview || trackFiles.cover);

      const payload = needsUpload
        ? (() => {
            const form = new FormData();
            form.append("title", trimmedTitle);
            form.append("description", trimmedDescription);
            form.append("price", String(price));
            form.append("durationSec", String(durationSec));
            if (trackFiles.audio) {
              form.append("audio", trackFiles.audio);
            } else if (trackForm.audioUrl.trim()) {
              form.append("audioUrl", trackForm.audioUrl.trim());
            }
            if (trackFiles.preview) {
              form.append("preview", trackFiles.preview);
            } else if (trackForm.previewUrl.trim()) {
              form.append("previewUrl", trackForm.previewUrl.trim());
            }
            if (trackFiles.cover) {
              form.append("cover", trackFiles.cover);
            } else if (trackForm.coverImageUrl.trim()) {
              form.append("coverImageUrl", trackForm.coverImageUrl.trim());
            }
            return form;
          })()
        : {
            title: trimmedTitle,
            description: trimmedDescription,
            price,
            durationSec,
            audioUrl: trackForm.audioUrl.trim(),
            previewUrl: trackForm.previewUrl.trim(),
            coverImageUrl: trackForm.coverImageUrl.trim(),
          };

      await createTrack(payload);
      setTrackForm(defaultTrackForm);
      resetTrackFileUploads();
      const refreshed = await loadDashboard();
      showTrackStatus("Track uploaded; preview and payment links are now live on your feed.");
      if (refreshed?.creatorReady && refreshed?._id) {
        navigate(`/creators/${refreshed._id}`);
      }
    } catch (err) {
      setError(err.message || "Failed to create track");
    } finally {
      setTrackSaving(false);
    }
  };

  const submitBook = async (event) => {
    event.preventDefault();
    setBookSaving(true);
    setError("");
    try {
      const trimmedTitle = bookForm.title.trim();
      const trimmedDescription = bookForm.description.trim();
      const price = Number(bookForm.price);
      const coverUrl = bookForm.coverImageUrl.trim();
      const contentUrl = bookForm.contentUrl.trim();
      if (!bookFiles.content && !contentUrl) {
        throw new Error("Book content URL or upload is required");
      }
      const payload = bookFiles.cover || bookFiles.content
        ? (() => {
            const form = new FormData();
            form.append("title", trimmedTitle);
            form.append("description", trimmedDescription);
            form.append("price", String(price));
            if (coverUrl) {
              form.append("coverImageUrl", coverUrl);
            }
            if (contentUrl) {
              form.append("contentUrl", contentUrl);
            }
            if (bookFiles.cover) {
              form.append("cover", bookFiles.cover);
            }
            if (bookFiles.content) {
              form.append("content", bookFiles.content);
            }
            return form;
          })()
        : {
            title: trimmedTitle,
            description: trimmedDescription,
            price,
            coverImageUrl: coverUrl,
            contentUrl,
          };
      const created = await createBook(payload);
      setBookForm(defaultBookForm);
      resetBookFileUploads();
      setChapterForm((prev) => ({ ...prev, bookId: created?._id || prev.bookId }));
      const refreshed = await loadDashboard();
      if (refreshed?.creatorReady && refreshed?._id) {
        navigate(`/creators/${refreshed._id}`);
      }
    } catch (err) {
      setError(err.message || "Failed to create book");
    } finally {
      setBookSaving(false);
    }
  };

  const submitAlbum = async (event) => {
    event.preventDefault();
    const validationError = validateAlbumForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setAlbumSaving(true);
    setAlbumStatus("");
    setAlbumProgress(0);
    setAlbumCurrentFile("");
    setError("");

    try {
      const form = new FormData();
      form.append("albumTitle", albumForm.albumTitle.trim());
      form.append("description", albumForm.description.trim());
      form.append("price", String(Number(albumForm.price)));
      form.append("coverImage", albumCoverFile);

      albumSongs.forEach((song) => {
        form.append("tracks", song);
      });
      albumPreviews.forEach((preview) => {
        form.append("previews", preview);
      });

      await createAlbumWithUploadProgress(form, {
        onProgress: (percent) => {
          const safePercent = Math.max(0, Math.min(100, Number(percent || 0)));
          setAlbumProgress(safePercent);
          if (albumSongs.length) {
            const currentIndex = Math.min(
              albumSongs.length - 1,
              Math.max(0, Math.floor((safePercent / 100) * albumSongs.length))
            );
            const currentName = albumSongs[currentIndex]?.name || "";
            setAlbumCurrentFile(
              `Uploading ${Math.min(currentIndex + 1, albumSongs.length)}/${albumSongs.length}${
                currentName ? `: ${currentName}` : ""
              }`
            );
          }
        },
      });

      setAlbumForm(defaultAlbumForm);
      resetAlbumUploads();
      setAlbumStatus("Album published successfully.");
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Failed to publish album");
    } finally {
      setAlbumSaving(false);
      setAlbumCurrentFile("");
      setAlbumProgress((prev) => (prev < 100 ? prev : 100));
    }
  };

  const submitChapter = async (event) => {
    event.preventDefault();
    if (!chapterForm.bookId) {
      setError("Create a book first, then add chapters.");
      return;
    }

    setChapterSaving(true);
    setError("");
    try {
      await createBookChapter(chapterForm.bookId, {
        title: chapterForm.title,
        order: Number(chapterForm.order),
        content: chapterForm.content,
        isFree: Boolean(chapterForm.isFree),
      });
      setChapterForm((prev) => ({
        ...defaultChapterForm,
        bookId: prev.bookId,
      }));
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Failed to create chapter");
    } finally {
      setChapterSaving(false);
    }
  };

  const summaryCards = useMemo(
    () => [
      { label: "Total sales", value: sales.totalSalesCount || 0 },
      {
        label: "Revenue",
        value: `${sales.currency || "NGN"} ${Number(sales.totalRevenue || 0).toLocaleString()}`,
      },
      { label: "Tracks", value: tracks.length },
      { label: "Albums", value: albums.length },
      { label: "Books", value: books.length },
    ],
    [albums.length, books.length, sales.currency, sales.totalRevenue, sales.totalSalesCount, tracks.length]
  );

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading creator dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Creator Dashboard (MVP)</h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload tracks, publish books with chapters, and monitor paid sales.
        </p>
        {creator?._id ? (
          <button
            type="button"
            className="mt-3 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => navigate(`/creators/${creator._id}`)}
          >
            View public creator page
          </button>
        ) : null}
      </header>

      {error ? (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {summaryCards.map((entry) => (
          <article key={entry.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">{entry.label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{entry.value}</p>
          </article>
        ))}
      </section>

      {!hasCreator ? (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Create your creator profile</h2>
          <form className="mt-4 grid gap-3" onSubmit={submitCreatorProfile}>
            <input
              value={creatorForm.displayName}
              onChange={(event) =>
                setCreatorForm((prev) => ({ ...prev, displayName: event.target.value }))
              }
              placeholder="Display name"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <textarea
              value={creatorForm.bio}
              onChange={(event) =>
                setCreatorForm((prev) => ({ ...prev, bio: event.target.value }))
              }
              placeholder="Bio"
              rows={3}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={creatorForm.coverImageUrl}
              onChange={(event) =>
                setCreatorForm((prev) => ({ ...prev, coverImageUrl: event.target.value }))
              }
              placeholder="Cover image URL"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={profileSaving}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
            >
              {profileSaving ? "Saving..." : "Create creator profile"}
            </button>
          </form>
        </section>
      ) : null}

      {hasCreator ? (
        <>
          <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Upload Track</h2>
            <form className="mt-4 grid gap-3" onSubmit={submitTrack}>
              <input
                value={trackForm.title}
                onChange={(event) =>
                  setTrackForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Track title"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
              <textarea
                value={trackForm.description}
                onChange={(event) =>
                  setTrackForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Description"
                rows={2}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={trackForm.price}
                onChange={(event) =>
                  setTrackForm((prev) => ({ ...prev, price: event.target.value }))
                }
                placeholder="Price (NGN)"
                type="number"
                min="0"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
              <input
                value={trackForm.audioUrl}
                onChange={(event) =>
                  setTrackForm((prev) => ({ ...prev, audioUrl: event.target.value }))
                }
                placeholder="Full audio URL"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required={!trackFiles.audio}
              />
              <input
                value={trackForm.coverImageUrl}
                onChange={(event) =>
                  setTrackForm((prev) => ({ ...prev, coverImageUrl: event.target.value }))
                }
                placeholder="Cover image URL"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="space-y-3 rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
                <p className="text-xs text-slate-500">
                  Upload audio files or supply links plus a cover image to make your feed entry pop.
                </p>
                <input
                  value={trackForm.previewUrl}
                  onChange={(event) =>
                    setTrackForm((prev) => ({ ...prev, previewUrl: event.target.value }))
                  }
                  placeholder="Preview URL (required for paid tracks)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  required={!trackFiles.preview && Number(trackForm.price) > 0}
                />
              </div>
              <div className="space-y-3 rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
                <p>
                  Upload audio files instead of sharing URLs. The files are stored securely on
                  Tengacion and work with the preview and payment flow.
                </p>
                <label className="block text-xs font-semibold text-slate-700">
                  Full track file (MP3, WAV)
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(event) => handleTrackFileChange("audio", event.target.files?.[0])}
                  className="text-xs"
                />
                {trackFileUrls.audio ? (
                  <audio controls className="w-full" src={trackFileUrls.audio} />
                ) : null}
                <label className="block text-xs font-semibold text-slate-700">
                  Optional preview sample
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(event) => handleTrackFileChange("preview", event.target.files?.[0])}
                  className="text-xs"
                />
                {trackFileUrls.preview ? (
                  <audio controls className="w-full" src={trackFileUrls.preview} />
                ) : null}
                <label className="block text-xs font-semibold text-slate-700">
                  Cover image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleTrackFileChange("cover", event.target.files?.[0])}
                  className="text-xs"
                />
                {trackFileUrls.cover ? (
                  <img
                    src={trackFileUrls.cover}
                    alt="Cover preview"
                    className="mt-1 h-20 w-20 rounded shadow-sm object-cover"
                  />
                ) : null}
              </div>
              <input
                value={trackForm.durationSec}
                onChange={(event) =>
                  setTrackForm((prev) => ({ ...prev, durationSec: event.target.value }))
                }
                placeholder="Duration in seconds"
                type="number"
                min="0"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={trackSaving}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
              >
                {trackSaving ? "Saving..." : "Publish track"}
              </button>
              {trackStatus ? (
                <p className="mt-2 text-xs font-medium text-green-700">{trackStatus}</p>
              ) : null}
            </form>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Create Book</h2>
            <form className="mt-4 grid gap-3" onSubmit={submitBook}>
              <input
                value={bookForm.title}
                onChange={(event) =>
                  setBookForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Book title"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
              <textarea
                value={bookForm.description}
                onChange={(event) =>
                  setBookForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Description"
                rows={2}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={bookForm.price}
                onChange={(event) =>
                  setBookForm((prev) => ({ ...prev, price: event.target.value }))
                }
                placeholder="Price (NGN)"
                type="number"
                min="0"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
              <input
                value={bookForm.coverImageUrl}
                onChange={(event) =>
                  setBookForm((prev) => ({ ...prev, coverImageUrl: event.target.value }))
                }
                placeholder="Cover image URL"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={bookForm.contentUrl}
                onChange={(event) =>
                  setBookForm((prev) => ({ ...prev, contentUrl: event.target.value }))
                }
                placeholder="Book content URL (PDF, EPUB, etc.)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required={!bookFiles.content}
              />
              <div className="space-y-3 rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
                <p>
                  Upload a cover image and/or the book file to keep content within Tengacion.
                  Uploaded files are automatically stored and ready for preview and payments.
                </p>
                <label className="block text-xs font-semibold text-slate-700">Cover image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleBookFileChange("cover", event.target.files?.[0])}
                  className="text-xs"
                />
                {bookFileUrls.cover ? (
                  <img
                    src={bookFileUrls.cover}
                    alt="Cover preview"
                    className="mt-1 h-20 w-20 rounded object-cover"
                  />
                ) : null}
                <label className="block text-xs font-semibold text-slate-700">Book file</label>
                <input
                  type="file"
                  accept=".pdf,.epub,.mobi,.txt"
                  onChange={(event) => handleBookFileChange("content", event.target.files?.[0])}
                  className="text-xs"
                />
                {bookFileUrls.content ? (
                  <a
                    href={bookFileUrls.content}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-brand-600 underline"
                  >
                    Preview uploaded book file
                  </a>
                ) : null}
              </div>
              <button
                type="submit"
                disabled={bookSaving}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
              >
                {bookSaving ? "Saving..." : "Publish book"}
              </button>
            </form>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Upload Album</h2>
            <form className="mt-4 grid gap-3" onSubmit={submitAlbum}>
              <input
                value={albumForm.albumTitle}
                onChange={(event) =>
                  setAlbumForm((prev) => ({ ...prev, albumTitle: event.target.value }))
                }
                placeholder="Album title"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
              <textarea
                value={albumForm.description}
                onChange={(event) =>
                  setAlbumForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Description"
                rows={2}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={albumForm.price}
                onChange={(event) =>
                  setAlbumForm((prev) => ({ ...prev, price: event.target.value }))
                }
                placeholder="Price (NGN)"
                type="number"
                min="0"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
              <div className="space-y-3 rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
                <label className="block text-xs font-semibold text-slate-700">Cover image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => onAlbumCoverChange(event.target.files?.[0])}
                  className="text-xs"
                />
                {albumCoverUrl ? (
                  <img
                    src={albumCoverUrl}
                    alt="Album cover preview"
                    className="mt-1 h-20 w-20 rounded object-cover"
                  />
                ) : null}
                <label className="block text-xs font-semibold text-slate-700">Album songs</label>
                <input
                  type="file"
                  multiple
                  accept="audio/mpeg,audio/mp3,audio/wav"
                  onChange={(event) => onAlbumSongsChange(event.target.files)}
                  className="text-xs"
                />
                <p className="text-xs text-slate-500">{albumSongs.length}/25 selected</p>
                {albumSongs.length ? (
                  <ul className="space-y-1">
                    {albumSongs.map((song, index) => (
                      <li key={`${song.name}-${index}`} className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs">
                          {song.name} <span className="text-slate-400">({formatBytes(song.size)})</span>
                        </span>
                        <button
                          type="button"
                          className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                          onClick={() => removeAlbumSong(index)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <label className="block text-xs font-semibold text-slate-700">Preview samples (optional)</label>
                <input
                  type="file"
                  multiple
                  accept="audio/mpeg,audio/mp3,audio/wav"
                  onChange={(event) => onAlbumPreviewsChange(event.target.files)}
                  className="text-xs"
                />
                <p className="text-xs text-slate-500">
                  If preview count differs from songs, previews will be ignored and can be generated later.
                </p>
              </div>
              {albumSaving ? (
                <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-brand-600 transition-all"
                      style={{ width: `${albumProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-600">{albumCurrentFile || `Uploading... ${albumProgress}%`}</p>
                </div>
              ) : null}
              <button
                type="submit"
                disabled={albumSaving}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
              >
                {albumSaving ? "Publishing..." : "Publish album"}
              </button>
              {albumStatus ? (
                <p className="text-xs font-medium text-green-700">{albumStatus}</p>
              ) : null}
            </form>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-semibold text-slate-900">Add Chapter</h2>
            <form className="mt-4 grid gap-3" onSubmit={submitChapter}>
              <select
                value={chapterForm.bookId}
                onChange={(event) =>
                  setChapterForm((prev) => ({ ...prev, bookId: event.target.value }))
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              >
                <option value="">Select book</option>
                {books.map((book) => (
                  <option key={book._id} value={book._id}>
                    {book.title}
                  </option>
                ))}
              </select>
              <input
                value={chapterForm.title}
                onChange={(event) =>
                  setChapterForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Chapter title"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
              <input
                value={chapterForm.order}
                onChange={(event) =>
                  setChapterForm((prev) => ({ ...prev, order: event.target.value }))
                }
                placeholder="Order (1,2,3...)"
                type="number"
                min="1"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
              <textarea
                value={chapterForm.content}
                onChange={(event) =>
                  setChapterForm((prev) => ({ ...prev, content: event.target.value }))
                }
                placeholder="Chapter content"
                rows={6}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={chapterForm.isFree}
                  onChange={(event) =>
                    setChapterForm((prev) => ({ ...prev, isFree: event.target.checked }))
                  }
                />
                Mark as free preview chapter
              </label>
              <button
                type="submit"
                disabled={chapterSaving}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
              >
                {chapterSaving ? "Saving..." : "Add chapter"}
              </button>
            </form>
          </article>
        </section>
        <section className="mt-6 space-y-6">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Your Tracks</h2>
              <button
                type="button"
                className="text-xs font-medium text-slate-500"
                onClick={loadDashboard}
              >
                Refresh list
              </button>
            </div>
            {tracks.length ? (
              <div className="mt-4 space-y-4">
                {tracks.map((track) => {
                  const coverImage = resolveImage(track.coverImageUrl);
                  return (
                    <div
                      key={track._id}
                      className="rounded-xl border border-slate-200 p-4 shadow-sm"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-100 shadow-inner">
                          {coverImage ? (
                            <img
                              src={coverImage}
                              alt={`${track.title} cover`}
                              className="h-20 w-20 object-cover"
                            />
                          ) : (
                            <div className="flex h-20 w-20 items-center justify-center text-[10px] uppercase text-slate-500">
                              No cover yet
                            </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {track.title}
                              </p>
                              <p className="text-xs text-slate-500">
                                NGN {Number(track.price || 0).toLocaleString()}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={paymentLoading}
                              onClick={() => handlePaymentLaunch("track", track._id)}
                              className="rounded-full border border-brand-200 px-3 py-1 text-xs font-semibold text-brand-600 disabled:opacity-60"
                            >
                              {paymentLoading ? "Preparing..." : "Payment link"}
                            </button>
                          </div>
                          {track.description ? (
                            <p className="text-xs text-slate-500">{track.description}</p>
                          ) : null}
                        </div>
                      </div>
                      {(track.previewUrl || track.audioUrl) && (
                        <audio
                          controls
                          src={track.previewUrl || track.audioUrl}
                          className="mt-3 w-full"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No tracks published yet.</p>
            )}
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Published Books</h2>
              <button
                type="button"
                className="text-xs font-medium text-slate-500"
                onClick={loadDashboard}
              >
                Refresh list
              </button>
            </div>
            {books.length ? (
              <div className="mt-4 space-y-4">
                {books.map((book) => (
                  <div
                    key={book._id}
                    className="space-y-2 rounded-xl border border-slate-200 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900">{book.title}</p>
                        {book.description ? (
                          <p className="text-xs text-slate-500">{book.description}</p>
                        ) : null}
                        <p className="text-xs text-slate-500">
                          NGN {Number(book.price || 0).toLocaleString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={paymentLoading}
                        onClick={() => handlePaymentLaunch("book", book._id)}
                        className="rounded-full border border-brand-200 px-3 py-1 text-xs font-semibold text-brand-600 disabled:opacity-60"
                      >
                        {paymentLoading ? "Preparing..." : "Payment link"}
                      </button>
                    </div>
                    {book.coverImageUrl ? (
                      <img
                        src={book.coverImageUrl}
                        alt="Book cover"
                        className="h-24 w-24 rounded object-cover"
                      />
                    ) : null}
                    {book.contentUrl ? (
                      <a
                        href={book.contentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-brand-600 underline"
                      >
                        Open / preview book file
                      </a>
                    ) : (
                      <p className="text-xs text-slate-500">Content URL not provided.</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No books published yet.</p>
            )}
          </article>
        </section>
      </>
      ) : null}
    </div>
  );
}
