import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { createCheckout, getAlbum } from "../api";

export default function AlbumDetail() {
  const { albumId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [album, setAlbum] = useState(null);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    const loadAlbum = async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await getAlbum(albumId);
        setAlbum(payload || null);
      } catch (err) {
        setError(err.message || "Failed to load album");
      } finally {
        setLoading(false);
      }
    };

    loadAlbum();
  }, [albumId]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Loading album...
        </div>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {error || "Album not found."}
        </div>
      </div>
    );
  }

  const tracks = Array.isArray(album.tracks) ? album.tracks : [];
  const handleBuyAlbum = async () => {
    if (!album?._id) return;
    setBuying(true);
    setError("");
    try {
      const checkout = await createCheckout({
        itemType: "album",
        itemId: album._id,
        currencyMode: "NG",
      });
      if (checkout?.checkoutUrl) {
        window.open(checkout.checkoutUrl, "_blank", "noopener,noreferrer");
      } else {
        throw new Error("Unable to create checkout");
      }
    } catch (err) {
      setError(err.message || "Unable to start album checkout");
    } finally {
      setBuying(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          {album.coverUrl ? (
            <img
              src={album.coverUrl}
              alt={album.title}
              className="h-32 w-32 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-xs uppercase text-slate-500">
              No cover
            </div>
          )}
          <div className="flex-1 space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">{album.title}</h1>
            {album.description ? <p className="text-sm text-slate-600">{album.description}</p> : null}
            <p className="text-sm font-semibold text-slate-800">
              NGN {Number(album.price || 0).toLocaleString()} • {tracks.length} songs
            </p>
            {!album.canPlayFull && Number(album.price || 0) > 0 ? (
              <button
                type="button"
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                disabled={buying}
                onClick={handleBuyAlbum}
              >
                {buying ? "Preparing..." : "Buy album"}
              </button>
            ) : null}
            <div>
              <Link to={`/creators/${album.creatorId || ""}/albums`} className="text-xs font-semibold text-brand-600 underline">
                Back
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {tracks.length ? (
            tracks.map((track) => (
              <article key={`${track.order}-${track.title}`} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {track.order}. {track.title}
                  </p>
                  {album.canPlayFull && track.downloadUrl ? (
                    <a
                      href={track.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-brand-600 underline"
                    >
                      Download
                    </a>
                  ) : null}
                </div>
                {track.streamUrl ? (
                  <audio controls src={track.streamUrl} className="mt-2 w-full" />
                ) : (
                  <p className="mt-2 text-xs text-slate-500">Preview unavailable for this track.</p>
                )}
              </article>
            ))
          ) : (
            <p className="text-sm text-slate-500">No songs available for this album yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
