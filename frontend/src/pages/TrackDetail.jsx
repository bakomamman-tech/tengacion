import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { checkEntitlement, getTrack, getTrackStream, initPayment } from "../api";
import PaywallModal from "../components/PaywallModal";
import { useAuth } from "../context/AuthContext";

const PREVIEW_LIMIT_SEC = 30;

export default function TrackDetail() {
  const { trackId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const audioRef = useRef(null);

  const [track, setTrack] = useState(null);
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  const isLoggedIn = Boolean(user?._id || localStorage.getItem("token"));

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

    if (audio.currentTime >= PREVIEW_LIMIT_SEC) {
      audio.pause();
      audio.currentTime = PREVIEW_LIMIT_SEC;
      setPaywallOpen(true);
    }
  };

  const handleEnded = () => {
    if (stream && !stream.allowedFullAccess) {
      setPaywallOpen(true);
    }
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
      const returnUrl = `${window.location.origin}${location.pathname}`;
      const payment = await initPayment({
        itemType: "track",
        itemId: track._id,
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

  const subtitle = useMemo(() => {
    if (stream?.allowedFullAccess) {
      return "You have full access to this track.";
    }
    return "Preview is limited to 30 seconds. Buy to unlock full playback.";
  }, [stream?.allowedFullAccess]);

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
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">Track</p>
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

        {!stream?.allowedFullAccess ? (
          <button
            type="button"
            className="mt-4 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            onClick={() => setPaywallOpen(true)}
          >
            Buy to unlock
          </button>
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
