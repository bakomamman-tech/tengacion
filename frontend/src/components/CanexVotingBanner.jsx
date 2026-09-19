import { useEffect, useState } from "react";

export const CANEX_VOTE_URL = "https://dala.gebeya.com/cannex-vote/a8475b3d-12c0-4edc-a82e-070f3fb42140";
export const CANEX_CLOSE_AT = "2026-09-28T20:59:00.000Z"; // September 28, 23:59 East Africa Time
const DISMISS_KEY = "tengacion:canex-generator-choir:dismissed";

export default function CanexVotingBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try { return window.sessionStorage.getItem(DISMISS_KEY) === "1"; }
    catch { return false; }
  });
  const [open, setOpen] = useState(() => Date.now() < Date.parse(CANEX_CLOSE_AT));
  useEffect(() => {
    if (!open) return undefined;
    const ms = Date.parse(CANEX_CLOSE_AT) - Date.now();
    if (ms <= 0) { setOpen(false); return undefined; }
    const timer = window.setTimeout(() => setOpen(false), ms);
    return () => window.clearTimeout(timer);
  }, [open]);
  if (dismissed || !open) return null;
  const dismiss = () => {
    setDismissed(true);
    try { window.sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* optional storage */ }
  };
  return (
    <section className="card" aria-label="Optional CANEX Create-thon voting invitation" style={{ padding: "1.1rem", border: "1px solid #b7d4c1", background: "linear-gradient(115deg,#f2fff6,#fff8eb)", color: "#183b2e" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
        <div>
          <strong style={{ fontSize: "1.08rem" }}>🎶 Support THE GENERATOR CHOIR 🇳🇬</strong>
          <p style={{ margin: "0.45rem 0" }}>Our founder Stephen Daniel Kurah’s music project is in the CANEX Create-thon public voting stage. If you enjoy it, you can choose to vote on the official competition website.</p>
          <p style={{ margin: "0.4rem 0", fontSize: "0.86rem" }}>Voting closes September 28, 2026. No Tengacion account details are sent to the voting website by this banner.</p>
          <a href={CANEX_VOTE_URL} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", background: "#17613a", color: "#fff", padding: "0.65rem 1rem", borderRadius: "0.6rem", textDecoration: "none", fontWeight: 700 }}>Listen and vote voluntarily ↗</a>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss CANEX voting invitation" style={{ border: 0, background: "transparent", color: "#183b2e", cursor: "pointer", fontSize: "1.35rem" }}>×</button>
      </div>
    </section>
  );
}
