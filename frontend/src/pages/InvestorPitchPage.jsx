import { Link } from "react-router-dom";

import SeoHead from "../components/seo/SeoHead";
import {
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from "../lib/seo";

import "./investor-pitch.css";

const PDF_PATH = "/assets/investors/Tengacion-Investor-Pitch-June-2026.pdf?v=2";
const PAGE_TITLE = "Investor Pitch | Tengacion";
const PAGE_DESCRIPTION =
  "Download the Tengacion investor pitch and explore the market opportunity, creator-commerce model, revenue strategy, financial outlook, and seed investment ask.";

const INVESTMENT_SIGNALS = [
  { value: "47.8m", label: "Nigeria social media identities" },
  { value: "$29.84bn", label: "Projected African creator economy by 2032" },
  { value: "5", label: "Complementary revenue streams" },
  { value: "18 months", label: "Focused seed execution runway" },
];

const DECK_TOPICS = [
  "The creator monetization gap Tengacion is built to solve",
  "A unified social, creator, marketplace, and AI product ecosystem",
  "African creator-economy market sizing and initial Nigeria wedge",
  "Transaction-led revenue model and five-year base-case projection",
  "Seed investment ask, use of funds, and 18-month milestones",
];

export default function InvestorPitchPage() {
  return (
    <main className="investor-pitch">
      <SeoHead
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        canonical="/investors"
        robots="index,follow"
        ogType="website"
        structuredData={[
          buildWebSiteJsonLd(),
          buildOrganizationJsonLd(),
          buildBreadcrumbJsonLd([
            { name: "Tengacion", url: "/" },
            { name: "Investor Pitch", url: "/investors" },
          ]),
        ]}
      />

      <header className="investor-pitch__header">
        <nav className="investor-pitch__nav" aria-label="Investor page navigation">
          <Link className="investor-pitch__brand" to="/" aria-label="Tengacion home">
            <img src="/tengacion_logo_128.png" alt="" />
            <span>Tengacion</span>
          </Link>
          <div className="investor-pitch__nav-links">
            <Link to="/about">About</Link>
            <Link to="/leadership">Leadership</Link>
            <Link to="/contact">Contact</Link>
          </div>
        </nav>
      </header>

      <section className="investor-pitch__hero" aria-labelledby="investor-pitch-title">
        <div className="investor-pitch__hero-copy">
          <p className="investor-pitch__eyebrow">Investor resources / June 2026</p>
          <h1 id="investor-pitch-title">Tengacion Investor Pitch</h1>
          <p>
            See how Tengacion is building an Africa-first platform that turns social
            discovery into creator income, trusted commerce, and durable community value.
          </p>
          <div className="investor-pitch__actions">
            <a
              className="investor-pitch__button investor-pitch__button--primary"
              href={PDF_PATH}
              download="Tengacion-Investor-Pitch-June-2026.pdf"
              type="application/pdf"
            >
              Download free PDF
            </a>
            <a className="investor-pitch__button" href="#pitch-preview">
              Preview the deck
            </a>
          </div>
          <div className="investor-pitch__file-meta" aria-label="Pitch deck file details">
            <span>PDF format</span>
            <span>9 pages</span>
            <span>No sign-up required</span>
          </div>
        </div>

        <div className="investor-pitch__cover" aria-label="Tengacion investor pitch cover">
          <div className="investor-pitch__cover-brand">
            <img src="/tengacion_logo_256.png" alt="" />
            <span>Tengacion</span>
          </div>
          <div className="investor-pitch__cover-copy">
            <span>Investor pitch</span>
            <strong>Social activity, transformed into creator income.</strong>
            <p>Africa-first social creator-commerce.</p>
          </div>
          <div className="investor-pitch__cover-footer">
            <span>Prepared June 2026</span>
            <span>tengacion.com</span>
          </div>
        </div>
      </section>

      <section className="investor-pitch__signals" aria-label="Investment highlights">
        {INVESTMENT_SIGNALS.map((signal) => (
          <article key={signal.label}>
            <strong>{signal.value}</strong>
            <span>{signal.label}</span>
          </article>
        ))}
      </section>

      <section className="investor-pitch__story" aria-labelledby="investor-story-title">
        <div className="investor-pitch__story-copy">
          <p className="investor-pitch__eyebrow">Inside the pitch</p>
          <h2 id="investor-story-title">The investment case, in one focused brief</h2>
          <p>
            Tengacion connects the behavior people already understand - posting, discovering,
            following, buying, and supporting creators - inside a transaction-enabled network
            designed for African users, creators, and sellers.
          </p>
          <ul>
            {DECK_TOPICS.map((topic) => (
              <li key={topic}>{topic}</li>
            ))}
          </ul>
        </div>

        <aside className="investor-pitch__ask">
          <span>Suggested seed ask</span>
          <strong>₦100m–₦250m</strong>
          <p>
            Capital for product polish, creator acquisition, payments, infrastructure,
            trust and safety, and 18 months of disciplined execution.
          </p>
          <a href={PDF_PATH} download="Tengacion-Investor-Pitch-June-2026.pdf">
            Get the investor brief
          </a>
        </aside>
      </section>

      <section
        className="investor-pitch__preview-section"
        id="pitch-preview"
        aria-labelledby="pitch-preview-title"
      >
        <div className="investor-pitch__preview-head">
          <div>
            <p className="investor-pitch__eyebrow">Document preview</p>
            <h2 id="pitch-preview-title">Read before you download</h2>
          </div>
          <a href={PDF_PATH} download="Tengacion-Investor-Pitch-June-2026.pdf">
            Download PDF
          </a>
        </div>

        <div className="investor-pitch__viewer">
          <object data={PDF_PATH} type="application/pdf" aria-label="Tengacion investor pitch PDF">
            <div className="investor-pitch__viewer-fallback">
              <img src="/tengacion_logo_256.png" alt="" />
              <h3>PDF preview unavailable in this browser</h3>
              <p>The full investor brief is still available as a free download.</p>
              <a href={PDF_PATH} download="Tengacion-Investor-Pitch-June-2026.pdf">
                Download the pitch
              </a>
            </div>
          </object>
        </div>
      </section>

      <footer className="investor-pitch__footer">
        <div>
          <Link className="investor-pitch__brand" to="/">
            <img src="/tengacion_logo_128.png" alt="" />
            <span>Tengacion</span>
          </Link>
          <p>Africa&apos;s social commerce and creator monetization platform.</p>
        </div>
        <div className="investor-pitch__footer-links">
          <Link to="/leadership">Leadership</Link>
          <Link to="/about">About</Link>
          <Link to="/contact">Investor contact</Link>
          <a href={PDF_PATH} download="Tengacion-Investor-Pitch-June-2026.pdf">
            Download pitch
          </a>
        </div>
      </footer>
    </main>
  );
}
