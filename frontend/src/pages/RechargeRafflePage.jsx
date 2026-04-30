import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import Navbar from "../Navbar";
import Sidebar from "../Sidebar";
import RightQuickNav from "../components/RightQuickNav";
import {
  getRechargeRaffleStatus,
  spinRechargeRaffle,
} from "../api";

import "./recharge-raffle.css";

const FALLBACK_NETWORKS = [
  { id: "mtn", label: "MTN", dialCodes: ["*555*PIN#", "*311*PIN#"], pinLengths: [16, 17] },
  { id: "airtel", label: "Airtel", dialCodes: ["*126*PIN#", "*444*PIN#"], pinLengths: [16] },
];

const WHEEL_SEGMENTS = [
  "N100",
  "N500",
  "N1000",
  "N10000",
  "Bonus",
  "Try",
  "N100",
  "Mystery",
];

const SPIN_FEEDBACK_DURATION_MS = 2800;
const RATE_LIMIT_MESSAGE = "Try Again After 2 days";
const CONFETTI_COLORS = ["#ffe08b", "#34d399", "#60a5fa", "#fb7185", "#ffffff"];

const formatCount = (value) => Number(value || 0).toLocaleString();

const formatDateTime = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getNetworkMeta = (networks = [], selectedNetwork = "") =>
  (networks || []).find((network) => network.id === selectedNetwork) ||
  FALLBACK_NETWORKS.find((network) => network.id === selectedNetwork) ||
  null;

const copyText = async (value, label = "Copied") => {
  const text = String(value || "").trim();
  if (!text) {
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Copy failed. Please select the PIN manually.");
  }
};

const getConfettiStyle = (index, seed = 0) => {
  const left = (index * 17 + seed * 11) % 100;
  const drift = (index % 2 === 0 ? 1 : -1) * (28 + ((index * 13 + seed) % 74));
  const rotate = 180 + ((index * 31 + seed) % 340);
  const duration = 1700 + ((index * 47 + seed) % 900);
  const delay = (index * 37 + seed) % 680;

  return {
    left: `${left}%`,
    backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    animationDelay: `${delay}ms`,
    animationDuration: `${duration}ms`,
    "--confetti-drift": `${drift}px`,
    "--confetti-rotate": `${rotate}deg`,
  };
};

function RaffleSpinFeedback({ feedback }) {
  if (!feedback) {
    return null;
  }

  const isSuccess = feedback.type === "success";
  const confettiSeed = Number(feedback.key || 0);

  return (
    <div
      key={feedback.key}
      className={`raffle-spin-feedback is-${feedback.type}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {isSuccess ? (
        <>
          <div className="raffle-confetti-rain" aria-hidden="true">
            {Array.from({ length: 64 }).map((_, index) => (
              <span
                key={index}
                style={getConfettiStyle(index, confettiSeed)}
              />
            ))}
          </div>
          <span className="raffle-stage-smoke raffle-stage-smoke--one" aria-hidden="true" />
          <span className="raffle-stage-smoke raffle-stage-smoke--two" aria-hidden="true" />
        </>
      ) : null}
      <strong>{feedback.message}</strong>
    </div>
  );
}

function RaffleWheel({ rotation, spinning, disabled, onSpin }) {
  return (
    <div className={`raffle-wheel-wrap${spinning ? " is-spinning" : ""}`}>
      <div className="raffle-wheel-pointer" aria-hidden="true" />
      <button
        type="button"
        className="raffle-wheel"
        style={{ transform: `rotate(${rotation}deg)` }}
        disabled={disabled}
        onClick={onSpin}
        aria-label="Spin recharge raffle wheel"
      >
        <span className="raffle-wheel-core">
          <span>SPIN</span>
          <small>WIN</small>
        </span>
        {WHEEL_SEGMENTS.map((label, index) => (
          <span
            key={`${label}-${index}`}
            className="raffle-wheel-label"
            style={{ transform: `rotate(${index * 45}deg) translateY(-118px) rotate(-${index * 45}deg)` }}
          >
            {label}
          </span>
        ))}
      </button>
    </div>
  );
}

function RequirementList({ requirements = [], onProfile, onPostFeed }) {
  return (
    <div className="raffle-requirements">
      {requirements.map((item) => (
        <div
          key={item.id}
          className={`raffle-requirement${item.complete ? " is-done" : ""}`}
        >
          <span className="raffle-check" aria-hidden="true">
            {item.complete ? "OK" : "!"}
          </span>
          <div>
            <strong>{item.label}</strong>
            <small>
              {item.complete
                ? "Ready"
                : item.id === "avatar"
                  ? "Required before spinning"
                  : item.id === "feed_post"
                    ? "Share a post on your registered feed page"
                    : "Needs attention"}
            </small>
          </div>
          {!item.complete && item.id === "avatar" ? (
            <button type="button" onClick={onProfile}>Upload</button>
          ) : null}
          {!item.complete && item.id === "feed_post" ? (
            <button type="button" onClick={onPostFeed}>Post</button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function PrizePanel({ prize, networkMeta, cooldown }) {
  if (!prize) {
    return (
      <section className="raffle-panel raffle-prize-panel">
        <div className="raffle-panel-head">
          <p>Prize Vault</p>
          <strong>Waiting for your spin</strong>
        </div>
        <div className="raffle-empty-vault">
          <span aria-hidden="true">PIN</span>
          <p>Your recharge PIN appears here immediately after a winning spin.</p>
        </div>
      </section>
    );
  }

  const dialCodes = Array.isArray(prize.dialCodes) && prize.dialCodes.length
    ? prize.dialCodes
    : (networkMeta?.dialCodes || []).map((code) => code.replace("PIN", prize.pin));
  const nextAvailable = formatDateTime(cooldown?.nextAvailableAt);

  return (
    <section className="raffle-panel raffle-prize-panel is-won">
      <div className="raffle-panel-head">
        <p>Prize Vault</p>
        <strong>{prize.networkLabel || networkMeta?.label || "Recharge"} N{formatCount(prize.amount)} PIN</strong>
      </div>

      <div className="raffle-pin-box">
        <span>{prize.pin}</span>
        <button type="button" onClick={() => copyText(prize.pin, "PIN copied")}>
          Copy PIN
        </button>
      </div>

      <div className="raffle-load-codes">
        {dialCodes.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => copyText(code, "Load code copied")}
          >
            {code}
          </button>
        ))}
      </div>

      {cooldown?.active ? (
        <div className="raffle-limit-note" role="status">
          <strong>{RATE_LIMIT_MESSAGE}</strong>
          {nextAvailable ? ` Next available: ${nextAvailable}.` : null}
        </div>
      ) : null}
    </section>
  );
}

export default function RechargeRafflePage({ user }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [selectedNetwork, setSelectedNetwork] = useState("");
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [error, setError] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [spinFeedback, setSpinFeedback] = useState(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await getRechargeRaffleStatus();
      setStatus(payload);
      if (payload?.play?.network) {
        setSelectedNetwork(payload.play.network);
      }
    } catch (err) {
      setError(err?.message || "Failed to load Spin & Win.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const networks = useMemo(
    () => (Array.isArray(status?.networks) && status.networks.length ? status.networks : FALLBACK_NETWORKS),
    [status?.networks]
  );
  const selectedNetworkMeta = useMemo(
    () => getNetworkMeta(networks, selectedNetwork),
    [networks, selectedNetwork]
  );
  const play = status?.play || null;
  const prize = play?.prize || null;
  const eligibility = status?.eligibility || { eligible: false, requirements: [] };
  const cooldown = status?.cooldown || { active: false };
  const activeRound = play?.status === "active";
  const spinsUsed = activeRound ? Number(play?.spinsUsed || 0) : 0;
  const spinsRemaining = activeRound ? Number(play?.spinsRemaining || 5) : 5;
  const canSpin =
    Boolean(eligibility.eligible) &&
    Boolean(selectedNetwork) &&
    !cooldown.active &&
    !spinning &&
    (!activeRound || spinsRemaining > 0);
  const stockForNetwork = selectedNetwork
    ? Number(status?.availability?.[selectedNetwork]?.available || 0)
    : 0;
  const displayResultMessage = cooldown.active ? RATE_LIMIT_MESSAGE : resultMessage;

  useEffect(() => {
    if (!spinFeedback) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setSpinFeedback(null);
    }, SPIN_FEEDBACK_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [spinFeedback]);

  const goProfile = () => navigate(`/profile/${user?.username || ""}`);
  const goPostFeed = () => navigate("/home", { state: { openComposer: true } });

  const handleSpin = async () => {
    if (!selectedNetwork) {
      toast.error("Choose MTN or Airtel before spinning.");
      return;
    }
    if (!eligibility.eligible) {
      toast.error("Upload a profile picture to unlock the wheel.");
      return;
    }

    setSpinning(true);
    setError("");
    setResultMessage("");
    setWheelRotation((current) => current + 1440 + Math.floor(Math.random() * 240) + 90);

    try {
      const payload = await spinRechargeRaffle({ network: selectedNetwork });
      window.setTimeout(() => {
        const rateLimited = Boolean(payload?.rateLimited);
        const won = Boolean(payload?.spin?.won);

        setStatus(payload);
        setResultMessage(rateLimited ? RATE_LIMIT_MESSAGE : won ? (payload?.spin?.message || "") : "Try Again");
        if (payload?.play?.network) {
          setSelectedNetwork(payload.play.network);
        }
        if (won && !rateLimited) {
          setSpinFeedback({
            type: "success",
            message: "Congratulations",
            key: Date.now(),
          });
          toast.success("Recharge PIN unlocked.");
        } else if (!rateLimited) {
          setSpinFeedback({
            type: "loss",
            message: "Try Again",
            key: Date.now(),
          });
        }
        setSpinning(false);
      }, 900);
    } catch (err) {
      setSpinning(false);
      const message = err?.message || "Spin failed. Please try again.";
      const rateLimited = err?.status === 429 || err?.payload?.rateLimited;
      if (rateLimited) {
        setResultMessage(RATE_LIMIT_MESSAGE);
      } else {
        setError(message);
        toast.error(message);
      }
      if (err?.payload?.eligibility) {
        setStatus((current) => ({
          ...(current || {}),
          eligibility: err.payload.eligibility,
        }));
      }
    }
  };

  return (
    <>
      <Navbar
        user={user}
        onLogout={() => navigate("/")}
        onOpenMessenger={() => navigate("/messages")}
        onOpenCreatePost={() => navigate("/home", { state: { openComposer: true } })}
      />

      <div className="raffle-app-shell">
        <aside className="sidebar">
          <Sidebar
            user={user}
            openChat={() => navigate("/messages")}
            openProfile={goProfile}
          />
        </aside>

        <main className="raffle-page">
          <section className="raffle-stage" aria-labelledby="raffle-title">
            <div className="raffle-stage-copy">
              <span className="raffle-eyebrow">Tengacion Spin & Win</span>
              <h1 id="raffle-title">Choose your network, spin the wheel, copy your recharge PIN.</h1>
              <p>
                Complete your account, upload a profile picture, and stand a chance to win
                N100, N500, N1,000 or N10,000 recharge card PINs.
              </p>

              <div className="raffle-prize-strip" aria-label="Prize tiers">
                {(status?.prizeTiers || [100, 500, 1000, 10000]).map((amount) => (
                  <span key={amount}>N{formatCount(amount)}</span>
                ))}
              </div>
            </div>

            <div className="raffle-game-console">
              <div className="raffle-network-row" role="group" aria-label="Choose recharge network">
                {networks.map((network) => (
                  <button
                    key={network.id}
                    type="button"
                    className={`raffle-network-btn raffle-network-btn--${network.id}${selectedNetwork === network.id ? " is-active" : ""}`}
                    onClick={() => setSelectedNetwork(network.id)}
                    disabled={spinning || (activeRound && play?.network !== network.id && spinsUsed > 0)}
                  >
                    <strong>{network.label}</strong>
                    <span>{network.pinLengths.join(" or ")} digits</span>
                  </button>
                ))}
              </div>

              <RaffleWheel
                rotation={wheelRotation}
                spinning={spinning}
                disabled={!canSpin}
                onSpin={handleSpin}
              />

              <div className="raffle-console-actions">
                <button
                  type="button"
                  className="raffle-spin-btn"
                  onClick={handleSpin}
                  disabled={!canSpin}
                >
                  {spinning ? "Spinning..." : cooldown.active ? RATE_LIMIT_MESSAGE : "Spin the wheel"}
                </button>
                <button type="button" className="raffle-refresh-btn" onClick={loadStatus}>
                  Refresh
                </button>
              </div>

              {displayResultMessage ? <div className="raffle-result-note">{displayResultMessage}</div> : null}
              {error ? <div className="raffle-error" role="alert">{error}</div> : null}
            </div>

            <RaffleSpinFeedback feedback={spinFeedback} />
          </section>

          <section className="raffle-dashboard" aria-label="Game registration dashboard">
            <section className="raffle-panel">
              <div className="raffle-panel-head">
                <p>Game Registration</p>
                <strong>{eligibility.eligible ? "Eligible to play" : "Finish setup"}</strong>
              </div>
              {loading ? (
                <div className="raffle-loading">Checking your raffle status...</div>
              ) : (
                <RequirementList
                  requirements={eligibility.requirements || []}
                  onProfile={goProfile}
                  onPostFeed={goPostFeed}
                />
              )}
            </section>

            <section className="raffle-panel">
              <div className="raffle-panel-head">
                <p>Spin Meter</p>
                <strong>{spinsRemaining} of 5 left</strong>
              </div>
              <div className="raffle-meter">
                {Array.from({ length: 5 }).map((_, index) => (
                  <span
                    key={index}
                    className={index < spinsUsed ? "is-used" : ""}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <div className="raffle-rule-copy">
                <span>5 daily spins</span>
                <span>Next round opens after two days</span>
                <span>Return rounds need a new feed post</span>
              </div>
              {selectedNetwork ? (
                <div className="raffle-stock-note">
                  {selectedNetworkMeta?.label} cards ready: {formatCount(stockForNetwork)}
                </div>
              ) : (
                <div className="raffle-stock-note">Choose MTN or Airtel to begin.</div>
              )}
            </section>

            <PrizePanel prize={prize} networkMeta={selectedNetworkMeta} cooldown={cooldown} />
          </section>
        </main>

        <aside className="home-right-rail raffle-right-rail">
          <RightQuickNav />
          <section className="raffle-side-note">
            <strong>Load codes</strong>
            <span>MTN: *555*PIN# or *311*PIN#</span>
            <span>Airtel: *126*PIN# or *444*PIN#</span>
          </section>
        </aside>
      </div>
    </>
  );
}
