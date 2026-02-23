import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  checkEntitlement,
  getBook,
  getBookChapter,
  getBookChapters,
  initPayment,
  resolveImage,
} from "../api";
import PaywallModal from "../components/PaywallModal";
import { useAuth } from "../context/AuthContext";

export default function BookDetail() {
  const { bookId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [chapterContent, setChapterContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [error, setError] = useState("");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  const isLoggedIn = Boolean(user?._id || localStorage.getItem("token"));

  const loadBook = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [bookRes, chaptersRes] = await Promise.all([getBook(bookId), getBookChapters(bookId)]);
      setBook(bookRes || null);
      const list = Array.isArray(chaptersRes) ? chaptersRes : [];
      setChapters(list);

      const preferred = list.find((entry) => !entry.locked) || list[0];
      if (preferred?._id) {
        setSelectedChapterId(preferred._id);
      } else {
        setSelectedChapterId("");
        setChapterContent("");
      }
    } catch (err) {
      setError(err.message || "Failed to load book");
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    loadBook();
  }, [loadBook]);

  const loadChapter = useCallback(
    async (chapterId) => {
      const chapter = chapters.find((entry) => entry._id === chapterId);
      if (!chapter) {
        return;
      }

      setSelectedChapterId(chapterId);
      if (chapter.locked) {
        setPaywallOpen(true);
        return;
      }

      setChapterLoading(true);
      setError("");
      try {
        const payload = await getBookChapter(bookId, chapterId);
        setChapterContent(payload?.content || "");
      } catch (err) {
        setError(err.message || "Failed to load chapter");
      } finally {
        setChapterLoading(false);
      }
    },
    [bookId, chapters]
  );

  useEffect(() => {
    if (!selectedChapterId) {
      return;
    }
    loadChapter(selectedChapterId);
  }, [loadChapter, selectedChapterId]);

  const checkAndUnlock = useCallback(async () => {
    if (!isLoggedIn) {
      return false;
    }
    try {
      const entitlement = await checkEntitlement({ itemType: "book", itemId: bookId });
      if (entitlement?.entitled) {
        await loadBook();
        setPaywallOpen(false);
        setPayError("");
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [bookId, isLoggedIn, loadBook]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hasPaystackCallback = params.has("reference") || params.has("trxref");
    if (!hasPaystackCallback || !isLoggedIn) {
      return;
    }

    let cancelled = false;
    let tries = 0;
    const timer = window.setInterval(async () => {
      if (cancelled) {
        return;
      }
      tries += 1;
      const unlocked = await checkAndUnlock();
      if (unlocked || tries >= 8) {
        window.clearInterval(timer);
      }
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [checkAndUnlock, isLoggedIn, location.search]);

  const buyNow = async () => {
    if (!book) {
      return;
    }

    if (!isLoggedIn) {
      const returnTo = `${location.pathname}${location.search}`;
      navigate(`/?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
      return;
    }

    try {
      setPaying(true);
      setPayError("");
      const returnUrl = `${window.location.origin}${location.pathname}`;
      const payment = await initPayment({
        itemType: "book",
        itemId: book._id,
        returnUrl,
      });
      if (!payment?.authorization_url) {
        throw new Error("Payment link is missing");
      }
      window.location.assign(payment.authorization_url);
    } catch (err) {
      setPayError(err.message || "Failed to start payment");
      setPaying(false);
    }
  };

  const selectedChapter = useMemo(
    () => chapters.find((entry) => entry._id === selectedChapterId) || null,
    [chapters, selectedChapterId]
  );

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading book...
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          {error || "Book not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <section className="grid gap-6 lg:grid-cols-[280px,1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="h-56 overflow-hidden rounded-xl bg-slate-100">
            {book.coverImageUrl ? (
              <img
                src={resolveImage(book.coverImageUrl)}
                alt={book.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-blue-100 via-sky-100 to-cyan-100" />
            )}
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">{book.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{book.description || "No description"}</p>
          {book?.creator?._id ? (
            <button
              type="button"
              className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => navigate(`/creators/${book.creator._id}`)}
            >
              View creator page
            </button>
          ) : null}
          <p className="mt-3 text-sm font-semibold text-slate-900">
            NGN {Number(book.price || 0).toLocaleString()}
          </p>

          {!book.canReadFull ? (
            <button
              type="button"
              className="mt-3 w-full rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              onClick={() => setPaywallOpen(true)}
            >
              Buy to unlock full book
            </button>
          ) : null}
        </aside>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Chapters</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {chapters.map((chapter) => (
              <button
                key={chapter._id}
                type="button"
                onClick={() => loadChapter(chapter._id)}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${
                  chapter._id === selectedChapterId
                    ? "border-brand-500 bg-brand-50 text-brand-800"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="font-medium">Chapter {chapter.order}: {chapter.title}</span>
                <span className="mt-1 block text-xs">
                  {chapter.locked ? "Locked" : chapter.isFree ? "Free preview" : "Unlocked"}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              {selectedChapter ? `Reading: Chapter ${selectedChapter.order}` : "Reader"}
            </h3>
            {chapterLoading ? (
              <p className="mt-2 text-sm text-slate-600">Loading chapter...</p>
            ) : (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {chapterContent || "Select a chapter to start reading."}
              </p>
            )}
          </div>
        </article>
      </section>

      <PaywallModal
        open={paywallOpen && !book.canReadFull}
        onClose={() => setPaywallOpen(false)}
        onBuy={buyNow}
        title={book.title}
        subtitle="Read 1-2 free chapters, then unlock the full book."
        price={book.price}
        loading={paying}
        error={payError}
      />
    </div>
  );
}
