import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createBook,
  createBookChapter,
  createTrack,
  getCreatorBooks,
  getCreatorSales,
  getCreatorTracks,
  getMyCreatorProfile,
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
  const [saving, setSaving] = useState(false);

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

  const hasCreator = Boolean(creator?._id);

  const submitCreatorProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const profile = await upsertCreatorProfile(creatorForm);
      setCreator(profile);
      setCreatorForm(defaultCreatorForm);
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Failed to save creator profile");
    } finally {
      setSaving(false);
    }
  };

  const submitTrack = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createTrack({
        ...trackForm,
        price: Number(trackForm.price),
        durationSec: Number(trackForm.durationSec || 0),
      });
      setTrackForm(defaultTrackForm);
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Failed to create track");
    } finally {
      setSaving(false);
    }
  };

  const submitBook = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await createBook({
        ...bookForm,
        price: Number(bookForm.price),
      });
      setBookForm(defaultBookForm);
      setChapterForm((prev) => ({ ...prev, bookId: created?._id || prev.bookId }));
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Failed to create book");
    } finally {
      setSaving(false);
    }
  };

  const submitChapter = async (event) => {
    event.preventDefault();
    if (!chapterForm.bookId) {
      setError("Create a book first, then add chapters.");
      return;
    }

    setSaving(true);
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
      setSaving(false);
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
              disabled={saving}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
            >
              {saving ? "Saving..." : "Create creator profile"}
            </button>
          </form>
        </section>
      ) : null}

      {hasCreator ? (
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
                required
              />
              <input
                value={trackForm.previewUrl}
                onChange={(event) =>
                  setTrackForm((prev) => ({ ...prev, previewUrl: event.target.value }))
                }
                placeholder="Preview URL (required for paid tracks)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
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
                disabled={saving}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
              >
                {saving ? "Saving..." : "Publish track"}
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
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
              >
                {saving ? "Saving..." : "Publish book"}
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
                disabled={saving}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
              >
                {saving ? "Saving..." : "Add chapter"}
              </button>
            </form>
          </article>
        </section>
      ) : null}
    </div>
  );
}
