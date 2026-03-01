import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCreator, getCreatorBooks, getCreatorTracks, resolveImage } from "../api";
import styles from "./CreatorPage.module.css";

export default function CreatorPage() {
  const { creatorId } = useParams();
  const navigate = useNavigate();
  const [creator, setCreator] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [books, setBooks] = useState([]);
  const [activeTab, setActiveTab] = useState("music");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [creatorRes, tracksRes, booksRes] = await Promise.all([
          getCreator(creatorId),
          getCreatorTracks(creatorId),
          getCreatorBooks(creatorId),
        ]);
        if (!alive) {
          return;
        }
        setCreator(creatorRes || null);
        setTracks(Array.isArray(tracksRes) ? tracksRes : []);
        setBooks(Array.isArray(booksRes) ? booksRes : []);
      } catch (err) {
        if (!alive) {
          return;
        }
        setError(err.message || "Failed to load creator page");
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
  }, [creatorId]);

  const primaryBuyTarget = useMemo(() => {
    if (tracks[0]) {
      return { type: "track", id: tracks[0]._id };
    }
    if (books[0]) {
      return { type: "book", id: books[0]._id };
    }
    return null;
  }, [books, tracks]);

  const heroAvatar =
    resolveImage(
      creator?.profilePhoto ||
        creator?.avatarUrl ||
        creator?.user?.avatar ||
        creator?.coverImageUrl
    ) || "/avatar.png";

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading creator page...
        </div>
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          {error || "Creator not found"}
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-auto w-full max-w-5xl px-4 py-8 ${styles.creatorPage}`}>
      <section className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ${styles.creatorShell}`}>
        <div className={`relative h-64 w-full bg-slate-100 ${styles.creatorHero}`}>
          {creator.coverImageUrl ? (
            <img
              src={resolveImage(creator.coverImageUrl)}
              alt={creator.displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className={`h-full w-full ${styles.creatorHeroFallback}`} />
          )}
          <div className={`absolute inset-0 ${styles.creatorHeroOverlay}`} />
          <div className={`absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-4 ${styles.creatorHeroContent}`}>
            <div className={styles.creatorHeroIdentity}>
              <div className={styles.creatorAvatarWrap} aria-hidden="true">
                <img src={heroAvatar} alt="" className={styles.creatorAvatar} />
              </div>
              <div className={styles.creatorHeroText}>
                <h1 className={`text-3xl font-bold text-white ${styles.creatorTitle}`}>
                  {creator.displayName}
                </h1>
                <p className={`mt-1 max-w-2xl text-sm text-slate-100 ${styles.creatorBio}`}>
                  {creator.bio || "Creator profile"}
                </p>
              </div>
            </div>
            <div className={`flex flex-wrap items-center gap-2 ${styles.creatorHeaderActions}`}>
              <button
                type="button"
                className="rounded-xl border border-white/60 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
                onClick={() => navigate(`/creators/${creatorId}/songs`)}
              >
                Uploaded Songs
              </button>
              {primaryBuyTarget ? (
                <button
                  type="button"
                  className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                  onClick={() =>
                    navigate(
                      primaryBuyTarget.type === "track"
                        ? `/tracks/${primaryBuyTarget.id}`
                        : `/books/${primaryBuyTarget.id}`
                    )
                  }
                >
                  Support / Buy
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className={`border-t border-slate-200 px-5 py-4 ${styles.creatorTabsWrap}`}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                activeTab === "music"
                  ? "bg-brand-600 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              onClick={() => setActiveTab("music")}
            >
              Music
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                activeTab === "books"
                  ? "bg-brand-600 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              onClick={() => setActiveTab("books")}
            >
              Books
            </button>
          </div>
        </div>
      </section>

      <section className={`mt-6 grid gap-4 sm:grid-cols-2 ${styles.creatorCardsGrid}`}>
        {activeTab === "music" &&
          (tracks.length ? (
            tracks.map((track) => (
              <article
                key={track._id}
                className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${styles.creatorItemCard}`}
              >
                <h3 className="text-lg font-semibold text-slate-900">{track.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{track.description || "No description"}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">
                    NGN {Number(track.price || 0).toLocaleString()}
                  </span>
                  <button
                    type="button"
                    className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                    onClick={() => navigate(`/tracks/${track._id}`)}
                  >
                    Play preview
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="text-sm text-slate-600">No tracks yet.</p>
          ))}

        {activeTab === "books" &&
          (books.length ? (
            books.map((book) => (
              <article
                key={book._id}
                className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${styles.creatorItemCard}`}
              >
                <h3 className="text-lg font-semibold text-slate-900">{book.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{book.description || "No description"}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">
                    NGN {Number(book.price || 0).toLocaleString()}
                  </span>
                  <button
                    type="button"
                    className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                    onClick={() => navigate(`/books/${book._id}`)}
                  >
                    Read preview
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="text-sm text-slate-600">No books yet.</p>
          ))}
      </section>
    </div>
  );
}
