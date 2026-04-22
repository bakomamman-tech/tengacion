import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link, useParams } from "react-router-dom";
import { createCheckout, getAlbum, getPublicCreatorProfile, resolveImage } from "../api";
import { useAuth } from "../context/AuthContext";
import SeoHead from "../components/seo/SeoHead";
import useEntitlementSocket from "../hooks/useEntitlementSocket";
import {
  buildAlbumSeoDescription,
  buildBreadcrumbJsonLd,
  buildMusicAlbumJsonLd,
  buildOrganizationJsonLd,
  shouldIndexPublicEntity,
  buildWebSiteJsonLd,
} from "../lib/seo";
import { buildCreatorPublicPath } from "../lib/publicRoutes";

export default function AlbumDetail() {
  const { albumId } = useParams();
  const auth = useAuth();
  const user = auth?.user ?? null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [album, setAlbum] = useState(null);
  const [creatorContext, setCreatorContext] = useState(null);
  const [buying, setBuying] = useState(false);
  const isLoggedIn = Boolean(user?._id || user?.id);

  const loadAlbum = useCallback(async () => {
    setLoading(true);
    setError("");
    setCreatorContext(null);
    try {
      const payload = await getAlbum(albumId);
      const creatorRes = payload?.creator?._id
        ? await getPublicCreatorProfile(payload.creator.username || payload.creator._id).catch(() => null)
        : null;
      setAlbum(payload || null);
      setCreatorContext(creatorRes);
    } catch (err) {
      setError(err.message || "Failed to load album");
    } finally {
      setLoading(false);
    }
  }, [albumId]);

  useEffect(() => {
    loadAlbum();
  }, [loadAlbum]);

  useEntitlementSocket({
    enabled: isLoggedIn,
    onEntitlement: async (event = {}) => {
      if (String(event.itemType || "") !== "album" || String(event.itemId || "") !== String(albumId || "")) {
        return;
      }
      try {
        await loadAlbum();
        toast.success("Album unlocked. Full download and playback are ready.");
      } catch {
        // Keep the current album state stable if refresh fails.
      }
    },
  });

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
  const creatorName = album?.creator?.displayName || "Tengacion Creator";
  const creatorPath = creatorContext?.creator?.canonicalPath || buildCreatorPublicPath({
    creatorId: album?.creator?._id || album?.creatorId || "",
    username: album?.creator?.username,
  });
  const seoTitle = album ? `${album.title} by ${creatorName} | Tengacion` : "Album | Tengacion";
  const seoDescription = buildAlbumSeoDescription({
    album,
    creatorName,
    trackCount: tracks.length,
  });
  const relatedAlbums = Array.isArray(creatorContext?.music?.albums)
    ? creatorContext.music.albums
        .filter((item) => String(item?.route || "").trim())
        .filter((item) => String(item?.id || "") !== String(album?._id || ""))
        .slice(0, 4)
    : [];
  const shouldIndexPage = shouldIndexPublicEntity({
    title: album?.title,
    creatorName,
    description: seoDescription,
  });
  const structuredData = useMemo(() => {
    if (!album) {
      return [buildWebSiteJsonLd(), buildOrganizationJsonLd()];
    }

    return [
      buildWebSiteJsonLd(),
      buildOrganizationJsonLd(),
      buildMusicAlbumJsonLd({
        title: album.title,
        description: seoDescription,
        image: album.coverUrl,
        canonicalPath: `/albums/${album._id}`,
        creatorName,
        creatorPath,
        publishedAt: album.createdAt,
        trackCount: tracks.length,
      }),
      buildBreadcrumbJsonLd([
        { name: "Creators", url: "/creators" },
        { name: creatorName, url: creatorPath },
        { name: album.title, url: `/albums/${album._id}` },
      ]),
    ];
  }, [album, creatorName, creatorPath, seoDescription, tracks.length]);

  const handleBuyAlbum = async () => {
    if (!album?._id) {return;}
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
        toast.success("Checkout opened. This album page will update as soon as payment confirms.");
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
      <SeoHead
        title={seoTitle}
        description={seoDescription}
        canonical={`/albums/${album?._id || albumId}`}
        robots={shouldIndexPage ? "index,follow" : "noindex,follow"}
        ogType="music.album"
        ogImage={album?.coverUrl}
        ogImageAlt={`${album?.title || "Album"} cover art`}
        structuredData={structuredData}
      />
      <div className="overflow-hidden rounded-[2rem] border border-stone-200 bg-[linear-gradient(180deg,#fffdf9_0%,#fff_42%,#fbf6ec_100%)] p-6 shadow-[0_32px_80px_rgba(62,39,16,0.12)]">
        <div className="flex flex-wrap items-start gap-4">
          {album.coverUrl ? (
            <img
              src={resolveImage(album.coverUrl)}
              alt={album.title}
              className="h-32 w-32 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-xs uppercase text-slate-500">
              No cover
            </div>
          )}
          <div className="flex-1 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Album release</p>
            <h1 className="text-3xl font-bold text-slate-900">{album.title}</h1>
            {album.description ? <p className="max-w-2xl text-sm leading-7 text-slate-600">{album.description}</p> : null}
            <p className="text-sm font-semibold text-slate-800">
              NGN {Number(album.price || 0).toLocaleString()} | {tracks.length} songs
            </p>
            <div className="grid gap-3 pt-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-stone-200 bg-white/80 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Creator</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{creatorName}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white/80 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Release Type</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{album.releaseType || "Album"}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white/80 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Track Count</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{tracks.length}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {!album.canPlayFull && Number(album.price || 0) > 0 ? (
                <button
                  type="button"
                  className="rounded-2xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
                  disabled={buying}
                  onClick={handleBuyAlbum}
                >
                  {buying ? "Preparing..." : "Buy album"}
                </button>
              ) : null}
              {album.canPlayFull && album.downloadUrl ? (
                <a
                  href={album.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-stone-300 bg-white/90 px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-stone-400 hover:bg-white"
                >
                  Download album bundle
                </a>
              ) : null}
              <Link to={creatorPath} className="text-xs font-semibold text-brand-600 underline">
                Visit creator page
              </Link>
            </div>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-stone-200 bg-white/85 p-5">
          <h2 className="text-lg font-semibold text-slate-900">About This Album</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            {album.description || seoDescription}
          </p>
        </section>

        <div className="mt-8 space-y-3">
          {tracks.length ? (
            tracks.map((track) => (
              <article
                key={`${track.order}-${track.title}`}
                className="rounded-2xl border border-stone-200 bg-white/90 p-4 shadow-[0_18px_42px_rgba(15,23,42,0.06)]"
              >
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

        {relatedAlbums.length ? (
          <section className="mt-8 rounded-2xl border border-stone-200 bg-white/85 p-5">
            <h2 className="text-lg font-semibold text-slate-900">More From {creatorName}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {relatedAlbums.map((item) => (
                <Link
                  key={item.id}
                  to={item.route}
                  className="rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-stone-300"
                >
                  <strong className="block text-sm text-slate-900">{item.title}</strong>
                  <span className="mt-1 block text-xs text-slate-500">
                    {item.releaseType || "Album"}
                    {item.totalTracks ? ` • ${item.totalTracks} tracks` : ""}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
