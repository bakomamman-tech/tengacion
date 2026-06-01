import { Link } from "react-router-dom";
import SeoHead from "../components/seo/SeoHead";

import "./public-policy.css";

const COPYRIGHT_SECTIONS = [
  {
    title: "Creator responsibility",
    items: [
      "Creators must own or have permission to upload and monetize music, books, podcasts, videos, artwork, covers, images, text, and related metadata.",
      "Do not upload copied work, leaked files, unauthorized samples, unlicensed beats, pirated books, reposted podcast audio, or content that violates another person's rights.",
      "Tengacion screening helps detect risk, but creators remain responsible for rights, licenses, clearances, permissions, and takedown responses.",
    ],
  },
  {
    title: "Copyright review and takedown reports",
    items: [
      "Rights owners or authorized representatives can submit a report with the work title, rights owner, source URL, Tengacion URL, contact email, and a clear explanation of the issue.",
      "Tengacion may remove, restrict, de-monetize, or hold content while reviewing a credible rights complaint.",
      "Incomplete reports may require follow-up before action can be taken, especially when ownership or the exact content URL is unclear.",
    ],
  },
  {
    title: "Creator responses and repeat issues",
    items: [
      "Creators may be asked for ownership proof, license details, release documentation, distributor records, or other evidence before content is restored or monetized.",
      "Repeated infringement claims, false ownership statements, or attempts to re-upload removed content can restrict creator tools, payouts, and account access.",
      "False or abusive takedown requests may also be rejected or escalated for review.",
    ],
  },
  {
    title: "Uploads, monetization, and payouts",
    items: [
      "Rights-sensitive uploads can be blocked, held for manual review, unpublished, or excluded from paid access until the issue is resolved.",
      "Creator earnings connected to disputed content may be held, adjusted, reversed, or delayed while rights, refunds, disputes, or payment exposure are reviewed.",
      "Marketplace listings and digital products can also be reviewed when images, descriptions, books, audio, or branded materials appear to violate rights.",
    ],
  },
];

export default function CopyrightPolicy() {
  return (
    <main className="public-policy-page">
      <SeoHead
        title="Copyright Policy | Tengacion"
        description="Understand how Tengacion handles copyright screening, creator responsibilities, and flagged uploads."
        canonical="/copyright-policy"
      />
      <section className="public-policy-hero">
        <Link className="public-policy-brand" to="/">
          <img src="/tengacion_logo_128.png" alt="" />
          <span>Tengacion</span>
        </Link>
        <p className="public-policy-eyebrow">Rights and takedowns</p>
        <h1>Copyright Policy</h1>
        <p>
          Tengacion is built for original creator discovery. This policy explains upload
          responsibility, rights reports, takedown review, creator responses, and payout-sensitive
          copyright handling.
        </p>
        <small>Last updated: June 1, 2026</small>
      </section>

      <section className="public-policy-grid" aria-label="Copyright policy details">
        {COPYRIGHT_SECTIONS.map((section) => (
          <article key={section.title} className="public-policy-card">
            <h2>{section.title}</h2>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="public-policy-band">
        <div>
          <p className="public-policy-eyebrow">Rights report</p>
          <h2>Submit copyright concerns with source links and ownership details</h2>
        </div>
        <div className="public-policy-links">
          <Link to="/contact">Submit copyright report</Link>
          <Link to="/creator-monetization-terms">Monetization terms</Link>
          <Link to="/community-guidelines">Guidelines</Link>
        </div>
      </section>
    </main>
  );
}
