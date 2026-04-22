import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  checkEntitlement,
  getBook,
  getBookChapter,
  getBookChapters,
  getPublicCreatorProfile,
  initPayment,
  resolveImage,
} from "../api";
import PaywallModal from "../components/PaywallModal";
import SeoHead from "../components/seo/SeoHead";
import { useAuth } from "../context/AuthContext";
import useEntitlementSocket from "../hooks/useEntitlementSocket";
import {
  buildBookJsonLd,
  buildBreadcrumbJsonLd,
  buildBookSeoDescription,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  shouldIndexPublicEntity,
} from "../lib/seo";
import { buildCreatorPublicPath } from "../lib/publicRoutes";
import {
  buildPaystackCallbackUrl,
  resolveOwnedPurchaseLabel,
  resolvePurchaseCtaLabel,
} from "../utils/purchaseUx";

export default function BookDetail() {
  const { bookId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth?.user ?? null;

  const [book, setBook] = useState(null);
  const [creatorContext, setCreatorContext] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [chapterContent, setChapterContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [error, setError] = useState("");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const readerRef = useRef(null);

  const isLoggedIn = Boolean(user?._id);

  const loadBook = useCallback(async () => {
    setLoading(true);
    setError("");
    setCreatorContext(null);
    try {
      const [bookRes, chaptersRes] = await Promise.all([getBook(bookId), getBookChapters(bookId)]);
      const creatorRes = bookRes?.creator?._id
        ? await getPublicCreatorProfile(bookRes.creator.username || bookRes.creator._id).catch(() => null)
        : null;
      setBook(bookRes || null);
      setCreatorContext(creatorRes);
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

  useEntitlementSocket({
    enabled: isLoggedIn,
    onEntitlement: async (event = {}) => {
      if (String(event.itemType || "") !== "book" || String(event.itemId || "") !== String(bookId || "")) {
        return;
      }

      try {
        await loadBook();
        setPaywallOpen(false);
        setPaying(false);
        setPayError("");
        toast.success("Book unlocked. Your library refreshed instantly.");
      } catch {
        // Keep the reader stable and allow the callback polling fallback to continue.
      }
    },
  });

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
      const returnUrl = buildPaystackCallbackUrl({
        returnTo: `${location.pathname}${location.search}`,
        itemType: "book",
        itemId: book._id,
      });
      const payment = await initPayment({
        itemType: "book",
        itemId: book._id,
        returnUrl,
      });
      if (!payment?.authorization_url) {
        throw new Error("Payment link is missing");
      }
      toast.success("Checkout opened. This book will unlock automatically after payment.");
      window.location.assign(payment.authorization_url);
    } catch (err) {
      setPayError(err.message || "Failed to start payment");
      setPaying(false);
    }
  };

  const openReader = () => {
    readerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const selectedChapter = useMemo(
    () => chapters.find((entry) => entry._id === selectedChapterId) || null,
    [chapters, selectedChapterId]
  );
  const creatorName = book?.creator?.displayName || "Tengacion Creator";
  const creatorPath = creatorContext?.creator?.canonicalPath || buildCreatorPublicPath({
    creatorId: book?.creator?._id || "",
    username: book?.creator?.username,
  });
  const seoTitle = book ? `${book.title} by ${creatorName} | Tengacion` : "Book | Tengacion";
  const seoDescription = buildBookSeoDescription({ book, creatorName });
  const relatedBooks = Array.isArray(creatorContext?.books)
    ? creatorContext.books
        .filter((item) => String(item?.route || "").trim())
        .filter((item) => String(item?.id || "") !== String(book?._id || ""))
        .slice(0, 4)
    : [];
  const shouldIndexPage = shouldIndexPublicEntity({
    title: book?.title,
    creatorName,
    description: seoDescription,
  });
  const structuredData = useMemo(() => {
    if (!book) {
      return [buildWebSiteJsonLd(), buildOrganizationJsonLd()];
    }

    return [
      buildWebSiteJsonLd(),
      buildOrganizationJsonLd(),
      buildBookJsonLd({
        title: book.title,
        description: seoDescription,
        image: book.coverImageUrl,
        canonicalPath: `/books/${book._id}`,
        creatorName,
        creatorPath,
        language: book.language,
        publishedAt: book.createdAt,
      }),
      buildBreadcrumbJsonLd([
        { name: "Creators", url: "/creators" },
        { name: creatorName, url: creatorPath },
        { name: book.title, url: `/books/${book._id}` },
      ]),
    ];
  }, [book, creatorName, creatorPath, seoDescription]);

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
      <SeoHead
        title={seoTitle}
        description={seoDescription}
        canonical={`/books/${book?._id || bookId}`}
        robots={shouldIndexPage ? "index,follow" : "noindex,follow"}
        ogType="book"
        ogImage={book?.coverImageUrl}
        ogImageAlt={`${book?.title || "Book"} cover`}
        structuredData={structuredData}
      />
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
          <p className="mt-2 text-sm text-slate-600">
            {book.description || book.previewExcerptText || "Discover this public book on Tengacion."}
          </p>
          {book?.creator?._id ? (
            <Link
              to={creatorPath}
              className="mt-3 inline-flex rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Visit {creatorName}
            </Link>
          ) : null}
          <p className="mt-3 text-sm font-semibold text-slate-900">
            NGN {Number(book.price || 0).toLocaleString()}
          </p>

          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Genre</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{book.genre || "Book release"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Language</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{book.language || "Not specified"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Format</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{book.fileFormat || "Digital book"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Chapters</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{Number(book.chapterCount || chapters.length || 0)}</p>
            </div>
          </div>

          <div className="mt-3">
            {!book.canReadFull ? (
              <>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-brand-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(231,244,234,0.92))] px-4 py-2.5 text-sm font-semibold text-brand-900 shadow-[0_14px_28px_rgba(18,44,30,0.08)] transition hover:-translate-y-0.5 hover:bg-white"
                  onClick={() => setPaywallOpen(true)}
                >
                  {resolvePurchaseCtaLabel(book)}
                </button>
                <p className="mt-2 text-xs text-slate-500">
                  Pay securely with Paystack using card, USSD, or bank transfer.
                </p>
              </>
            ) : (
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_30px_rgba(15,64,39,0.24)] transition hover:bg-brand-700"
                onClick={openReader}
              >
                {resolveOwnedPurchaseLabel(book)}
              </button>
            )}
          </div>

          {payError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {payError}
            </div>
          ) : null}
        </aside>

        <article ref={readerRef} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-lg font-semibold text-slate-900">About This Book</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              {book.description || book.previewExcerptText || seoDescription}
            </p>
          </section>

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

          {relatedBooks.length ? (
            <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-lg font-semibold text-slate-900">More Books From {creatorName}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {relatedBooks.map((item) => (
                  <Link
                    key={item.id}
                    to={item.route}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"
                  >
                    <strong className="block text-sm text-slate-900">{item.title}</strong>
                    <span className="mt-1 block text-xs text-slate-500">
                      {item.genre || item.fileFormat || "Book"}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
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
