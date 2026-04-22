import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { checkEntitlement, getTrack, getTrackStream, initPayment } from "../api";
import PaywallModal from "../components/PaywallModal";
import SeoHead from "../components/seo/SeoHead";
import { useAuth } from "../context/AuthContext";
import useEntitlementSocket from "../hooks/useEntitlementSocket";
import {
  buildBreadcrumbJsonLd,
  buildMusicRecordingJsonLd,
  buildOrganizationJsonLd,
  buildPodcastEpisodeJsonLd,
  buildWebSiteJsonLd,
  pickFirstText,
} from "../lib/seo";
import {
  buildPaystackCallbackUrl,
  resolveOwnedPurchaseLabel,
  resolvePurchaseCtaLabel,
} from "../utils/purchaseUx";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default function TrackDetail() {
  const { trackId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const user = auth?.user ?? null;
  const audioRef = useRef(null);

  const [track, setTrack] = useState(null);
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  const isLoggedIn = Boolean(user?._id);
  const previewStartSec = Math.max(0, Number(stream?.previewStartSec || 0));
  const previewLimitSec = Math.max(0, Number(stream?.previewLimitSec || 30));
  const previewEndSec = previewStartSec + previewLimitSec;

  const loadTrack = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [trackRes, streamRes] = await Promise.all([
        getTrack(trackId),
        getTrackStream(trackId),
      ]);
      setTrack(trackRes);
      setStream(streamRes);
    } catch (err) {
      setError(err.message || "Failed to load track");
    } finally {
      setLoading(false);
    }
  }, [trackId]);

  useEffect(() => {
    loadTrack();
  }, [loadTrack]);

  useEntitlementSocket({
    enabled: isLoggedIn,
    onEntitlement: async (event = {}) => {
      if (String(event.itemType || "") !== "track" || String(event.itemId || "") !== String(trackId || "")) {
        return;
      }

      try {
        await loadTrack();
        setPaywallOpen(false);
        setPaying(false);
        setPayError("");
        toast.success("Track unlocked. Full playback is ready.");
      } catch {
        // Let the existing retry and refresh paths continue if needed.
      }
    },
  });

  const checkAndUnlock = useCallback(async () => {
    if (!isLoggedIn) {
      return false;
    }
    try {
      const entitlement = await checkEntitlement({ itemType: "track", itemId: trackId });
      if (entitlement?.entitled) {
        await loadTrack();
        setPaywallOpen(false);
        setPayError("");
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [isLoggedIn, loadTrack, trackId]);

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

  const handlePreviewLimit = () => {
    if (!stream || stream.allowedFullAccess) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const boundedEnd = Math.min(
      Number(audio.duration || previewEndSec || 0) || previewEndSec,
      previewEndSec
    );

    if (audio.currentTime >= boundedEnd) {
      audio.pause();
      audio.currentTime = boundedEnd;
      setPaywallOpen(true);
    }
  };

  const handlePreviewLoadedMetadata = () => {
    if (!stream || stream.allowedFullAccess) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const boundedStart = clamp(
      previewStartSec,
      0,
      Number(audio.duration || previewStartSec || 0) || previewStartSec
    );
    audio.currentTime = boundedStart;
  };

  const handlePreviewSeeking = () => {
    if (!stream || stream.allowedFullAccess) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const boundedEnd = Math.min(
      Number(audio.duration || previewEndSec || 0) || previewEndSec,
      previewEndSec
    );

    if (audio.currentTime < previewStartSec) {
      audio.currentTime = previewStartSec;
      return;
    }

    if (audio.currentTime > boundedEnd) {
      audio.currentTime = boundedEnd;
    }
  };

  const handlePreviewPlay = () => {
    if (!stream || stream.allowedFullAccess) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const boundedEnd = Math.min(
      Number(audio.duration || previewEndSec || 0) || previewEndSec,
      previewEndSec
    );

    if (
      audio.currentTime < previewStartSec
      || audio.currentTime >= Math.max(boundedEnd - 0.1, previewStartSec)
    ) {
      audio.currentTime = previewStartSec;
    }
  };

  const handleEnded = () => {
    if (stream && !stream.allowedFullAccess) {
      setPaywallOpen(true);
    }
  };

  const openPlayer = () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.scrollIntoView({ behavior: "smooth", block: "center" });
    audio.play().catch(() => null);
  };

  const buyNow = async () => {
    if (!track) {
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
        itemType: "track",
        itemId: track._id,
      });
      const payment = await initPayment({
        itemType: "track",
        itemId: track._id,
        returnUrl,
      });
      if (!payment?.authorization_url) {
        throw new Error("Payment link is missing");
      }
      toast.success("Checkout opened. This track will unlock automatically after payment.");
      window.location.assign(payment.authorization_url);
    } catch (err) {
      setPayError(err.message || "Failed to start payment");
      setPaying(false);
    }
  };

  const subtitle = useMemo(() => {
    if (stream?.allowedFullAccess) {
      return "You have full access to this track.";
    }
    return previewStartSec > 0
      ? "Preview is limited to 30 seconds from the selected chorus section. Buy to unlock full playback."
      : "Preview is limited to 30 seconds. Buy to unlock full playback.";
  }, [previewStartSec, stream?.allowedFullAccess]);
  const creatorName = track?.creator?.displayName || "Tengacion Creator";
  const creatorPath = track?.creator?._id ? `/creators/${track.creator._id}` : "/creators";
  const isPodcast = String(track?.kind || "").toLowerCase() === "podcast";
  const pageLabel = isPodcast ? "Podcast Episode" : "Track";
  const seoTitle = track
    ? `${track.title} by ${creatorName} | Tengacion`
    : `${pageLabel} | Tengacion`;
  const seoDescription = pickFirstText(
    track?.description,
    isPodcast
      ? `Listen to ${track?.title || "this episode"} from ${creatorName} on Tengacion.`
      : `Stream ${track?.title || "this track"} by ${creatorName} on Tengacion.`
  );
  const structuredData = useMemo(() => {
    if (!track) {
      return [buildWebSiteJsonLd(), buildOrganizationJsonLd()];
    }

    return [
      buildWebSiteJsonLd(),
      buildOrganizationJsonLd(),
      isPodcast
        ? buildPodcastEpisodeJsonLd({
            title: track.title,
            description: seoDescription,
            image: track.coverImageUrl,
            canonicalPath: `/tracks/${track._id}`,
            creatorName,
            publishedAt: track.createdAt,
            durationSec: track.durationSec,
            seriesTitle: track.podcastSeries,
          })
        : buildMusicRecordingJsonLd({
            title: track.title,
            description: seoDescription,
            image: track.coverImageUrl,
            canonicalPath: `/tracks/${track._id}`,
            creatorName,
            creatorPath,
            durationSec: track.durationSec,
            publishedAt: track.createdAt,
          }),
      buildBreadcrumbJsonLd([
        { name: "Creators", url: "/creators" },
        { name: creatorName, url: creatorPath },
        { name: track.title, url: `/tracks/${track._id}` },
      ]),
    ];
  }, [creatorName, creatorPath, isPodcast, seoDescription, track]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading track...
        </div>
      </div>
    );
  }

  if (error || !track) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          {error || "Track not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <SeoHead
        title={seoTitle}
        description={seoDescription}
        canonical={`/tracks/${track?._id || trackId}`}
        ogType={isPodcast ? "article" : "music.song"}
        ogImage={track?.coverImageUrl}
        ogImageAlt={`${track?.title || pageLabel} cover`}
        structuredData={structuredData}
      />
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">{pageLabel}</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{track.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{track.description || "No description"}</p>
        {track?.creator?._id ? (
          <button
            type="button"
            className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => navigate(`/creators/${track.creator._id}`)}
          >
            View creator page
          </button>
        ) : null}

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <audio
            ref={audioRef}
            controls
            src={stream?.streamUrl || ""}
            className="w-full"
            onLoadedMetadata={handlePreviewLoadedMetadata}
            onPlay={handlePreviewPlay}
            onSeeking={handlePreviewSeeking}
            onTimeUpdate={handlePreviewLimit}
            onEnded={handleEnded}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold text-slate-900">
              NGN {Number(track.price || 0).toLocaleString()}
            </span>
            <span className="text-slate-600">
              {stream?.allowedFullAccess ? "Unlocked" : "Preview mode"}
            </span>
          </div>
        </div>

        <div className="mt-4">
          {!stream?.allowedFullAccess ? (
            <>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-2xl border border-brand-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(231,244,234,0.92))] px-5 py-2.5 text-sm font-semibold text-brand-900 shadow-[0_14px_28px_rgba(18,44,30,0.08)] transition hover:-translate-y-0.5 hover:bg-white"
                onClick={() => setPaywallOpen(true)}
              >
                {resolvePurchaseCtaLabel(track)}
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Pay securely with Paystack using card, USSD, or bank transfer.
              </p>
            </>
          ) : (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-2xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_30px_rgba(15,64,39,0.24)] transition hover:bg-brand-700"
              onClick={openPlayer}
            >
              {resolveOwnedPurchaseLabel(track)}
            </button>
          )}
        </div>

        {payError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {payError}
          </div>
        ) : null}
      </article>

      <PaywallModal
        open={paywallOpen && !stream?.allowedFullAccess}
        onClose={() => setPaywallOpen(false)}
        onBuy={buyNow}
        title={track.title}
        subtitle={subtitle}
        price={track.price}
        loading={paying}
        error={payError}
      />
    </div>
  );
}
