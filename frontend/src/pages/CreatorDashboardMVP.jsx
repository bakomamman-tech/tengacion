import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createBook,
  createBookChapter,
  createTrack,
  getCreatorBooks,
  getCreatorSales,
  getCreatorTracks,
  getMyCreatorProfile,
  initPayment,
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
  durationSec: "",
};

const defaultBookForm = {
  title: "",
  description: "",
  price: "",
  coverImageUrl: "",
  contentUrl: "",
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
  const [sales, setSales] = useState({
    totalSalesCount: 0,
    totalRevenue: 0,
    currency: "NGN",
  });

  const [creatorForm, setCreatorForm] = useState(defaultCreatorForm);
  const [trackForm, setTrackForm] = useState(defaultTrackForm);
  const [bookForm, setBookForm] = useState(defaultBookForm);
  const [chapterForm, setChapterForm] = useState(defaultChapterForm);
  const [profileSaving, setProfileSaving] = useState(false);
  const [trackSaving, setTrackSaving] = useState(false);
  const [bookSaving, setBookSaving] = useState(false);
  const [chapterSaving, setChapterSaving] = useState(false);
  const [trackFiles, setTrackFiles] = useState({ audio: null, preview: null });
  const [trackFileUrls, setTrackFileUrls] = useState({ audio: "", preview: "" });
  const [bookFiles, setBookFiles] = useState({ cover: null, content: null });
  const [bookFileUrls, setBookFileUrls] = useState({ cover: "", content: "" });
  const [paymentLoading, setPaymentLoading] = useState(false);
  const trackFileUrlRef = useRef(trackFileUrls);
  const bookFileUrlRef = useRef(bookFileUrls);

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
        const [tracksRes, booksRes] = await Promise.all([
          getCreatorTracks(profileRes._id),
          getCreatorBooks(profileRes._id),
        ]);
        setTracks(Array.isArray(tracksRes) ? tracksRes : []);
        const booksList = Array.isArray(booksRes) ? booksRes : [];
        setBooks(booksList);
        setChapterForm((prev) => ({
          ...prev,
          bookId: prev.bookId || booksList[0]?._id || "",
        }));
      } else {
        setTracks([]);
        setBooks([]);
      }
    } catch (err) {
      setError(err.message || "Failed to load dashboard");
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
    return () => {
      releaseObjectUrls(trackFileUrlRef.current);
      releaseObjectUrls(bookFileUrlRef.current);
    };
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
    setTrackFiles({ audio: null, preview: null });
    setTrackFileUrls({ audio: "", preview: "" });
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

  const hasCreator = Boolean(creator?._id);

  const submitCreatorProfile = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    setError("");
    try {
      const profile = await upsertCreatorProfile(creatorForm);
      setCreator(profile);
      setCreatorForm(defaultCreatorForm);
      await loadDashboard();
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
      const needsUpload = Boolean(trackFiles.audio || trackFiles.preview);

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
            return form;
          })()
        : {
            title: trimmedTitle,
            description: trimmedDescription,
            price,
            durationSec,
            audioUrl: trackForm.audioUrl.trim(),
            previewUrl: trackForm.previewUrl.trim(),
          };

      await createTrack(payload);
      setTrackForm(defaultTrackForm);
      resetTrackFileUploads();
      await loadDashboard();
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
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Failed to create book");
    } finally {
      setBookSaving(false);
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
      { label: "Books", value: books.length },
    ],
    [books.length, sales.currency, sales.totalRevenue, sales.totalSalesCount, tracks.length]
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

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                value={trackForm.previewUrl}
                onChange={(event) =>
                  setTrackForm((prev) => ({ ...prev, previewUrl: event.target.value }))
                }
                placeholder="Preview URL (required for paid tracks)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required={!trackFiles.preview && Number(trackForm.price) > 0}
              />
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
                {tracks.map((track) => (
                  <div
                    key={track._id}
                    className="rounded-xl border border-slate-200 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{track.title}</p>
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
                      <p className="mt-2 text-xs text-slate-500">{track.description}</p>
                    ) : null}
                    {(track.previewUrl || track.audioUrl) && (
                      <audio
                        controls
                        src={track.previewUrl || track.audioUrl}
                        className="mt-3 w-full"
                      />
                    )}
                  </div>
                ))}
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
