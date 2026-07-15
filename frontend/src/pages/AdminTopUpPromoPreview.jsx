import { useMemo, useState } from "react";

import AdminShell from "../components/AdminShell";
import { PromoChest } from "../components/TopUpPromoDiscovery";
import {
  DISCOVERY_PLACEMENTS,
  DISCOVERY_TIPS,
  speakOutcome,
} from "../components/topUpPromoConfig";
import "./admin-top-up-promo-preview.css";

const DEMO_PASSCODE = "DEMO7K2Q";

export default function AdminTopUpPromoPreviewPage({ user }) {
  const [selectedStar, setSelectedStar] = useState(1);
  const [outcome, setOutcome] = useState("water");

  const selectedTip = useMemo(
    () => DISCOVERY_TIPS[Math.max(0, selectedStar - 1)] || DISCOVERY_TIPS[0],
    [selectedStar]
  );
  const selectedPlacement = useMemo(
    () => DISCOVERY_PLACEMENTS[Math.max(0, selectedStar - 1)] || DISCOVERY_PLACEMENTS[0],
    [selectedStar]
  );
  const won = outcome === "win";
  const displayName = String(user?.name || user?.username || "Admin").trim();

  const playPreviewVoice = () => {
    speakOutcome({
      name: displayName,
      won,
      customerCarePhone: "08164649980",
    });
  };

  return (
    <AdminShell
      title="Promo UI/UX Preview"
      subtitle="Private Admin-only design inspection. This page never starts a game or records a discovery."
      user={user}
    >
      <section className="adminx-panel adminx-panel--span-12 admin-topup-preview-notice">
        <div>
          <span>Admin preview</span>
          <h2>All 15 application star placements</h2>
          <p>
            The numbered markers below combine the exact viewport coordinates used across permitted
            app pages. Numbers and labels are visible only here; users see one to three faint stars on
            the relevant page.
          </p>
        </div>
        <div className="admin-topup-preview-notice__guard">
          <strong>No live outcome data</strong>
          <small>Winning numbers remain secret. Creator, Marketplace, and Admin surfaces are excluded.</small>
        </div>
      </section>

      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-panel-head">
          <div>
            <h2 className="adminx-panel-title">Application placement map</h2>
            <span className="adminx-section-meta">A combined coordinate view—select a star to see its actual page and zone</span>
          </div>
          <span className="adminx-badge">15 positions</span>
        </div>

        <div className="admin-topup-preview-stage" aria-label="Combined numbered map of all fifteen promo stars across the app">
          <div className="admin-topup-preview-navbar">
            <div className="admin-topup-preview-logo">T</div>
            <div className="admin-topup-preview-search">Search Tengacion</div>
            <div className="admin-topup-preview-navdots"><i /><i /><i /><b /></div>
          </div>
          <div className="admin-topup-preview-home">
            <aside className="admin-topup-preview-rail admin-topup-preview-rail--left">
              <div className="admin-topup-preview-profile"><i /><span><b /> <small /></span></div>
              {Array.from({ length: 7 }, (_, index) => <div key={index} className="admin-topup-preview-menu"><i /><span /></div>)}
            </aside>
            <main className="admin-topup-preview-feed">
              <div className="admin-topup-preview-stories">
                {Array.from({ length: 5 }, (_, index) => <i key={index} />)}
              </div>
              <div className="admin-topup-preview-composer"><i /><span>What's on your mind?</span><b /></div>
              {Array.from({ length: 3 }, (_, index) => (
                <article key={index} className="admin-topup-preview-post">
                  <header><i /><span><b /><small /></span></header>
                  <p /><p />
                  <div className="admin-topup-preview-media" />
                </article>
              ))}
            </main>
            <aside className="admin-topup-preview-rail admin-topup-preview-rail--right">
              <div className="admin-topup-preview-quick"><b />{Array.from({ length: 5 }, (_, index) => <span key={index} />)}</div>
              <div className="admin-topup-preview-quick"><b />{Array.from({ length: 4 }, (_, index) => <span key={index} />)}</div>
            </aside>
          </div>

          {DISCOVERY_PLACEMENTS.map((position) => {
            const number = position.id;
            return (
              <button
                key={number}
                type="button"
                className={`admin-topup-map-star ${selectedStar === number ? "is-selected" : ""}`}
                style={{ left: `${position.x}%`, top: `${position.y}%` }}
                onClick={() => setSelectedStar(number)}
                aria-label={`Inspect star position ${number}`}
                aria-pressed={selectedStar === number}
              >
                <span aria-hidden="true">✦</span>
                <b>{number}</b>
              </button>
            );
          })}
        </div>

        <div className="admin-topup-selected-tip">
          <span>Star {selectedStar}</span>
          <div>
            <strong>{selectedPlacement.page}: {selectedPlacement.zone}</strong>
            <p>{selectedTip.title} — {selectedTip.description}</p>
          </div>
          <code>{selectedPlacement.route}</code>
        </div>
      </section>

      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-panel-head admin-topup-preview-outcome-head">
          <div>
            <h2 className="adminx-panel-title">Chest outcome preview</h2>
            <span className="adminx-section-meta">Switch between the two visual states without consuming a play</span>
          </div>
          <div className="adminx-filter-row">
            <button
              type="button"
              className={`adminx-tab ${outcome === "water" ? "is-active" : ""}`}
              onClick={() => setOutcome("water")}
            >
              Water chest
            </button>
            <button
              type="button"
              className={`adminx-tab ${outcome === "win" ? "is-active" : ""}`}
              onClick={() => setOutcome("win")}
            >
              Winning chest
            </button>
            <button type="button" className="adminx-btn" onClick={playPreviewVoice}>Play voice preview</button>
          </div>
        </div>

        <div className={`admin-topup-outcome-preview ${won ? "is-win" : "is-water"}`}>
          <div className="admin-topup-outcome-preview__flyer">
            <img
              src="/assets/promos/top-up-bank-account-promo.png"
              alt="Top-Up Bank Account Promo flyer"
            />
            <span>Campaign artwork</span>
          </div>
          <div className="admin-topup-outcome-preview__result">
            <span className="admin-topup-eyebrow">Visual result demo</span>
            <h3>{won ? `Congratulations, ${displayName}!` : `Keep searching, ${displayName}`}</h3>
            <PromoChest won={won} revealed />
            {won ? (
              <div className="admin-topup-preview-win-copy">
                <strong>You won ₦5,000!</strong>
                <span>Demo passcode</span>
                <code>{DEMO_PASSCODE}</code>
                <p>Contact Customer Care via 08164649980 to claim your winnings.</p>
              </div>
            ) : (
              <p className="admin-topup-preview-water-copy">
                Water drips from the chest while the voice says: “Keep searching, {displayName}. You might just be lucky.”
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-panel-head">
          <div>
            <h2 className="adminx-panel-title">Placement legend</h2>
            <span className="adminx-section-meta">The learning objective attached to every star</span>
          </div>
        </div>
        <div className="admin-topup-placement-legend">
          {DISCOVERY_PLACEMENTS.map((placement, index) => {
            const tip = DISCOVERY_TIPS[index];
            return (
              <button
                key={placement.id}
                type="button"
                className={selectedStar === index + 1 ? "is-selected" : ""}
                onClick={() => setSelectedStar(index + 1)}
              >
                <span>{placement.id}</span>
                <div><strong>{placement.page}: {placement.zone}</strong><small>{placement.route} · {tip.title}</small></div>
              </button>
            );
          })}
        </div>
      </section>
    </AdminShell>
  );
}
