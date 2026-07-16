import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import {
  discoverTopUpPromoChest,
  getTopUpPromoStatus,
} from "../api";
import {
  DISCOVERY_PLACEMENTS,
  DISCOVERY_TIPS,
  TOTAL_DISCOVERY_STARS,
  speakOutcome,
} from "./topUpPromoConfig";
import { getSocket } from "../socket";
import "./top-up-promo-discovery.css";

const ADMIN_ROLES = new Set(["admin", "super_admin", "moderator", "trust_safety_admin"]);

const CONFETTI = Array.from({ length: 42 }, (_, index) => ({
  id: index,
  x: (index * 37) % 100,
  delay: (index % 9) * 0.09,
  duration: 1.9 + (index % 5) * 0.22,
  color: ["#f6c84f", "#fff4b0", "#2bcf8b", "#2c83ff", "#ff6c76"][index % 5],
  rotation: (index * 47) % 180,
  drift: ((index * 23) % 90) - 45,
}));

const DEFAULT_CAMPAIGN = {
  title: "Top-Up Bank Account Promo",
  totalChests: TOTAL_DISCOVERY_STARS,
  prizeChests: 2,
  prizeAmount: 5000,
  customerCarePhone: "08164649980",
  artworkUrl: "/assets/promos/top-up-bank-account-promo.png",
};

const formatNaira = (value) => `₦${Number(value || 0).toLocaleString("en-NG")}`;

export function PromoChest({ won, revealed }) {
  return (
    <div className={`topup-chest-scene ${revealed ? "is-revealed" : ""} ${won ? "is-win" : "is-water"}`}>
      {won && revealed ? (
        <div className="topup-confetti" aria-hidden="true">
          {CONFETTI.map((piece) => (
            <i
              key={piece.id}
              style={{
                "--confetti-x": `${piece.x}%`,
                "--confetti-delay": `${piece.delay}s`,
                "--confetti-duration": `${piece.duration}s`,
                "--confetti-color": piece.color,
                "--confetti-rotation": `${piece.rotation}deg`,
                "--confetti-drift": `${piece.drift}px`,
              }}
            />
          ))}
        </div>
      ) : null}

      <svg className="topup-chest-svg" viewBox="0 0 420 330" role="img" aria-label={won ? "Open gold treasure chest" : "Open treasure chest with water"}>
        <defs>
          <linearGradient id="topupWood" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7c3519" />
            <stop offset="0.46" stopColor="#3b170e" />
            <stop offset="1" stopColor="#8f431c" />
          </linearGradient>
          <linearGradient id="topupGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff0a3" />
            <stop offset="0.38" stopColor="#f4b926" />
            <stop offset="0.7" stopColor="#a45b05" />
            <stop offset="1" stopColor="#ffd85b" />
          </linearGradient>
          <linearGradient id="topupWater" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a8f5ff" />
            <stop offset="0.45" stopColor="#28bce0" />
            <stop offset="1" stopColor="#087fae" />
          </linearGradient>
          <filter id="topupGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <ellipse cx="210" cy="301" rx="151" ry="20" fill="rgba(2, 9, 24, .4)" />

        <g className="topup-chest-contents">
          {won ? (
            <g className="topup-gold-bars" filter="url(#topupGlow)">
              <path d="M119 194l30-25h48l22 25z" fill="url(#topupGold)" stroke="#fff1a8" strokeWidth="3" />
              <path d="M182 188l30-31h51l25 31z" fill="url(#topupGold)" stroke="#fff1a8" strokeWidth="3" />
              <path d="M252 196l24-25h43l20 25z" fill="url(#topupGold)" stroke="#fff1a8" strokeWidth="3" />
              <path d="M151 168l26-24h42l22 24z" fill="url(#topupGold)" stroke="#fff1a8" strokeWidth="3" />
              <path d="M224 157l21-25h40l20 25z" fill="url(#topupGold)" stroke="#fff1a8" strokeWidth="3" />
              <circle cx="115" cy="183" r="5" fill="#fff7c5" />
              <circle cx="311" cy="159" r="4" fill="#fff7c5" />
              <circle cx="202" cy="127" r="3" fill="#fff7c5" />
            </g>
          ) : (
            <g className="topup-water-fill">
              <path d="M92 173c28-19 50 14 78-3s48 17 77-2 54 15 84-1v76H92z" fill="url(#topupWater)" opacity=".96" />
              <path d="M100 177c25-15 48 12 73-2s48 13 76-1 47 10 73-1" fill="none" stroke="#d7fbff" strokeWidth="6" strokeLinecap="round" opacity=".7" />
              <circle cx="138" cy="147" r="8" fill="#72def4" />
              <circle cx="292" cy="143" r="6" fill="#72def4" />
            </g>
          )}
        </g>

        <g className="topup-chest-lid">
          <path d="M77 102c0-45 37-77 83-77h100c46 0 83 32 83 77v58H77z" fill="url(#topupWood)" stroke="#51230e" strokeWidth="7" />
          <path d="M96 103c0-35 28-58 64-58h100c36 0 64 23 64 58v37H96z" fill="none" stroke="url(#topupGold)" strokeWidth="11" />
          <path d="M126 31v118M294 31v118" stroke="url(#topupGold)" strokeWidth="10" />
          <path d="M77 130h266" stroke="url(#topupGold)" strokeWidth="13" />
          <circle cx="87" cy="130" r="8" fill="#ffe795" /><circle cx="333" cy="130" r="8" fill="#ffe795" />
        </g>

        <g className="topup-chest-base">
          <path d="M73 181h274v105c0 12-10 22-22 22H95c-12 0-22-10-22-22z" fill="url(#topupWood)" stroke="#4e1e0c" strokeWidth="7" />
          <path d="M77 190h266M77 241h266M112 184v119M308 184v119" stroke="url(#topupGold)" strokeWidth="9" />
          <rect x="159" y="202" width="102" height="55" rx="9" fill="#51200e" stroke="url(#topupGold)" strokeWidth="6" />
          <circle cx="210" cy="229" r="17" fill="url(#topupGold)" />
          <path d="M210 215l7 10-7 19-7-19z" fill="#5f2b0c" />
          <circle cx="91" cy="199" r="7" fill="#ffe795" /><circle cx="329" cy="199" r="7" fill="#ffe795" />
          <circle cx="91" cy="286" r="7" fill="#ffe795" /><circle cx="329" cy="286" r="7" fill="#ffe795" />
        </g>
      </svg>

      {!won && revealed ? (
        <div className="topup-water-drips" aria-hidden="true">
          {Array.from({ length: 11 }, (_, index) => (
            <i key={index} style={{ "--drop-index": index }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function TopUpPromoDiscovery({ user, onExploreTip }) {
  const location = useLocation();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [play, setPlay] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState("");
  const [selectedChest, setSelectedChest] = useState(0);
  const revealTimerRef = useRef(null);

  const role = String(user?.role || "user").trim().toLowerCase();
  const isAdminAccount = ADMIN_ROLES.has(role);
  const path = String(location.pathname || "/");
  const isExcludedSurface = /^\/(?:admin|creator|marketplace)(?:\/|$)/i.test(path);
  const routePlacements = useMemo(
    () => DISCOVERY_PLACEMENTS.filter((placement) =>
      placement.match === "prefix"
        ? path === placement.route || path.startsWith(placement.route)
        : path === placement.route
    ),
    [path]
  );
  const discoveredChestNumbers = useMemo(
    () => new Set((status?.discoveredChestNumbers || []).map(Number)),
    [status?.discoveredChestNumbers]
  );
  const visiblePlacements = useMemo(
    () => routePlacements.filter(
      (placement) => !discoveredChestNumbers.has(placement.id)
    ),
    [discoveredChestNumbers, routePlacements]
  );

  const loadStatus = useCallback(async () => {
    if (isAdminAccount || isExcludedSurface) {
      setLoading(false);
      return;
    }
    try {
      const payload = await getTopUpPromoStatus();
      setStatus(payload || null);
      setPlay(payload?.play || null);
    } catch {
      // The promo should never prevent the current app surface from loading.
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [isAdminAccount, isExcludedSurface]);

  useEffect(() => {
    void loadStatus();
    return () => {
      if (revealTimerRef.current) {
        window.clearTimeout(revealTimerRef.current);
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [loadStatus]);

  useEffect(() => {
    if (isAdminAccount || isExcludedSurface) {
      return undefined;
    }

    const refreshWhenActive = () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        void loadStatus();
      }
    };
    const refreshTimer = window.setInterval(refreshWhenActive, 30000);
    window.addEventListener("focus", refreshWhenActive);
    document.addEventListener("visibilitychange", refreshWhenActive);

    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshWhenActive);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, [isAdminAccount, isExcludedSurface, loadStatus]);

  useEffect(() => {
    if (isAdminAccount || isExcludedSurface) {
      return undefined;
    }

    let activeSocket = null;
    const onDiscovered = (payload = {}) => {
      const chestNumber = Number(payload.chestNumber || 0);
      setStatus((current) => {
        if (!current || !Number.isInteger(chestNumber) || chestNumber < 1) {
          return current;
        }

        const discoveredChestNumbers = [...new Set([
          ...(payload.discoveredChestNumbers || current.discoveredChestNumbers || []),
          chestNumber,
        ].map(Number))].sort((left, right) => left - right);

        return {
          ...current,
          discoveredChestNumbers,
          remainingChests:
            payload.remainingChests ??
            Math.max(0, (current.campaign?.totalChests || DEFAULT_CAMPAIGN.totalChests) - discoveredChestNumbers.length),
        };
      });
    };
    const attachSocket = () => {
      const nextSocket = getSocket();
      if (!nextSocket || nextSocket === activeSocket) {
        return Boolean(nextSocket);
      }
      activeSocket?.off("top-up-promo:discovered", onDiscovered);
      activeSocket = nextSocket;
      activeSocket.on("top-up-promo:discovered", onDiscovered);
      return true;
    };

    if (attachSocket()) {
      return () => activeSocket?.off("top-up-promo:discovered", onDiscovered);
    }

    const attachTimer = window.setInterval(() => {
      if (attachSocket()) {
        window.clearInterval(attachTimer);
      }
    }, 1000);

    return () => {
      window.clearInterval(attachTimer);
      activeSocket?.off("top-up-promo:discovered", onDiscovered);
    };
  }, [isAdminAccount, isExcludedSurface]);

  const campaign = status?.campaign || DEFAULT_CAMPAIGN;
  const displayName = String(user?.name || user?.username || "friend").trim();
  const tipIndex = Math.max(
    0,
    Math.min(DISCOVERY_TIPS.length - 1, Number(play?.chestNumber || selectedChest || 1) - 1)
  );
  const tip = useMemo(() => {
    const value = DISCOVERY_TIPS[tipIndex] || DISCOVERY_TIPS[0];
    return {
      ...value,
      path: value.path.replace(":username", encodeURIComponent(String(user?.username || ""))),
    };
  }, [tipIndex, user?.username]);

  const handleDiscover = async (chestNumber) => {
    if (discovering || status?.hasPlayed) {
      return;
    }
    setSelectedChest(chestNumber);
    setModalOpen(true);
    setDiscovering(true);
    setRevealed(false);
    setError("");

    try {
      const payload = await discoverTopUpPromoChest(chestNumber);
      const nextPlay = payload?.play || null;
      setStatus((current) => ({
        ...(current || {}),
        campaign: payload?.campaign || current?.campaign || DEFAULT_CAMPAIGN,
        hasPlayed: true,
        play: nextPlay,
        visibility: current?.visibility || { visible: true, reason: "available" },
        discoveredChestNumbers:
          payload?.discoveredChestNumbers || current?.discoveredChestNumbers || [],
        remainingChests:
          payload?.remainingChests ?? current?.remainingChests ?? DEFAULT_CAMPAIGN.totalChests,
      }));
      setPlay(nextPlay);

      revealTimerRef.current = window.setTimeout(() => {
        setRevealed(true);
        speakOutcome({
          name: displayName,
          won: Boolean(nextPlay?.won),
          customerCarePhone: payload?.campaign?.customerCarePhone || campaign.customerCarePhone,
        });
      }, 520);
    } catch (err) {
      if (err?.payload?.code === "chest_already_discovered") {
        setStatus((current) => ({
          ...(current || {}),
          discoveredChestNumbers:
            err.payload.discoveredChestNumbers || current?.discoveredChestNumbers || [],
          remainingChests:
            err.payload.remainingChests ?? current?.remainingChests ?? 0,
        }));
        setSelectedChest(0);
        setModalOpen(false);
        return;
      }
      setError(err?.message || "This chest could not be opened. Please try again.");
      setModalOpen(true);
    } finally {
      setDiscovering(false);
    }
  };

  const openSavedResult = () => {
    setSelectedChest(Number(play?.chestNumber || 1));
    setModalOpen(true);
    setRevealed(true);
    setError("");
  };

  const closeModal = () => {
    setModalOpen(false);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const exploreTip = () => {
    closeModal();
    onExploreTip?.(tip);
  };

  if (
    loading ||
    !status ||
    isAdminAccount ||
    isExcludedSurface ||
    status?.visibility?.visible === false ||
    routePlacements.length === 0 ||
    (!status?.hasPlayed && visiblePlacements.length === 0)
  ) {
    return null;
  }

  const won = Boolean(play?.won);

  return (
    <>
      {visiblePlacements.length > 0 ? (
        <div className="topup-discovery-layer" aria-label={`${campaign.title} discovery area`}>
          {visiblePlacements.map((position) => (
            <button
              key={position.id}
              type="button"
              className="topup-discovery-star"
              style={{
                "--star-x": `${position.x}%`,
                "--star-y": `${position.y}%`,
                "--star-delay": `${position.delay}s`,
                "--star-scale": position.scale,
              }}
              onClick={status?.hasPlayed
                ? openSavedResult
                : () => handleDiscover(position.id)}
              aria-label={status?.hasPlayed
                ? `View revealed promo chest from available discovery star ${position.id} of ${campaign.totalChests} near ${position.zone}`
                : `Open discovery star ${position.id} of ${campaign.totalChests} near ${position.zone}`}
              title={status?.hasPlayed
                ? "View your revealed promo chest. This star remains available for another Tengacion player."
                : undefined}
            >
              <span aria-hidden="true">✦</span>
            </button>
          ))}
        </div>
      ) : null}

      {status?.hasPlayed ? (
        <button type="button" className="topup-saved-result" onClick={openSavedResult}>
          <span aria-hidden="true">✦</span>
          View promo result
        </button>
      ) : null}

      {modalOpen ? (
        <div className="topup-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target && !discovering) {
            closeModal();
          }
        }}>
          <section
            className={`topup-modal ${revealed ? "is-revealed" : ""} ${won ? "is-win" : "is-water"}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="topup-promo-title"
          >
            <button type="button" className="topup-modal-close" onClick={closeModal} disabled={discovering} aria-label="Close promo result">
              ×
            </button>

            <div className="topup-modal-artwork">
              <img src={campaign.artworkUrl || DEFAULT_CAMPAIGN.artworkUrl} alt="Tengacion Find the Passcode and Top Up Your Bank Account Promo flyer" />
              <div className="topup-artwork-shade" />
              <div className="topup-artwork-caption">
                <span>Secure • Discover • Prosper</span>
                <strong>{campaign.title}</strong>
              </div>
            </div>

            <div className="topup-modal-content">
              <div className="topup-modal-kicker">
                Discovery {selectedChest || play?.chestNumber} of {campaign.totalChests}
              </div>
              <h2 id="topup-promo-title">
                {discovering
                  ? "Opening your chest…"
                  : error
                    ? "This chest stayed locked"
                    : won
                      ? `Congratulations, ${displayName}!`
                      : `Keep searching, ${displayName}`}
              </h2>

              {error ? (
                <div className="topup-promo-error">
                  <p>{error}</p>
                  <button type="button" onClick={closeModal}>Return to Home</button>
                </div>
              ) : (
                <>
                  <PromoChest won={won} revealed={revealed} />

                  <div className="topup-outcome" aria-live="assertive">
                    {discovering || !revealed ? (
                      <p>One moment—your discovery is being recorded securely.</p>
                    ) : won ? (
                      <>
                        <div className="topup-prize-declaration">You won {formatNaira(play?.prizeAmount || campaign.prizeAmount)}!</div>
                        <div className="topup-passcode-card">
                          <span>Your unique 8-character passcode</span>
                          <strong>{play?.passcode}</strong>
                        </div>
                        <p>
                          Kindly contact the Customer Care team via <a href={`tel:${campaign.customerCarePhone}`}>{campaign.customerCarePhone}</a> to claim your winnings.
                        </p>
                      </>
                    ) : (
                      <p className="topup-encouragement">Water this time—but your next Tengacion discovery might be the one that changes everything.</p>
                    )}
                  </div>

                  {revealed ? (
                    <aside className="topup-learning-card">
                      <span>Navigation discovery</span>
                      <strong>{tip.title}</strong>
                      <p>{tip.description}</p>
                      <button type="button" onClick={exploreTip}>{tip.actionLabel}</button>
                    </aside>
                  ) : null}
                </>
              )}

              {play?.discoveredAt ? (
                <small className="topup-recorded-time">
                  Discovery securely recorded {new Date(play.discoveredAt).toLocaleString()}
                </small>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
