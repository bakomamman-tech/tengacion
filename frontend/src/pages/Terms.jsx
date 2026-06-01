import { Link } from "react-router-dom";

import SeoHead from "../components/seo/SeoHead";

import "./public-policy.css";

const TERMS_SECTIONS = [
  {
    title: "Who can use Tengacion",
    items: [
      "You must be at least 13 years old, or the higher age required by your local law, to create or use an account.",
      "If you are under the age of legal majority, you may need permission from a parent or guardian before using paid features, creator tools, messaging, or marketplace features.",
      "You are responsible for keeping your account information accurate, your password secure, and your account activity lawful.",
    ],
  },
  {
    title: "Content and community rules",
    items: [
      "Do not post harassment, hate, threats, scams, spam, impersonation, sexual exploitation, child-safety risk, or content that violates another person's rights.",
      "Creators must own or have permission to upload music, books, podcasts, videos, artwork, descriptions, and any other media they publish.",
      "Tengacion may remove content, limit visibility, require review, restrict uploads, suspend accounts, or preserve records when policy or safety risks appear.",
    ],
  },
  {
    title: "Creator monetization and seller rules",
    items: [
      "Paid releases, subscriptions, creator earnings, seller payouts, and marketplace listings require eligible content, accurate account details, and platform review.",
      "Sellers must keep product titles, images, condition, price, stock, pickup, delivery, and contact details accurate.",
      "Payouts can be delayed, reduced, reversed, or restricted when there are refunds, chargebacks, fraud signals, rights issues, missing payout details, or unresolved policy reviews.",
    ],
  },
  {
    title: "Payments, refunds, and disputes",
    items: [
      "Payment processors may handle payment details, authorization, settlement, failed payments, chargebacks, and fraud checks.",
      "Refunds are reviewed under Tengacion's refund policy and may depend on payment status, entitlement delivery, marketplace fulfillment, duplicate charges, and abuse prevention.",
      "Users should report payment or order problems with transaction references, account email, product or creator links, and a clear description of the issue.",
    ],
  },
  {
    title: "Reports, enforcement, and changes",
    items: [
      "Use public reporting routes for copyright, safety, privacy, abuse, child safety, marketplace, or account concerns.",
      "Tengacion may update these terms as features, payments, creator tools, marketplace workflows, laws, and safety processes change.",
      "Using Tengacion after updated terms are posted means you accept the updated terms for continued use.",
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="public-policy-page">
      <SeoHead
        title="Terms of Service | Tengacion"
        description="Read the Tengacion Terms of Service covering platform rules, creator responsibilities, and paid features."
        canonical="/terms"
      />
      <section className="public-policy-hero">
        <Link className="public-policy-brand" to="/">
          <img src="/tengacion_logo_128.png" alt="" />
          <span>Tengacion</span>
        </Link>
        <p className="public-policy-eyebrow">Platform rules</p>
        <h1>Terms of Service</h1>
        <p>
          These terms explain the baseline rules for accounts, public content, creator
          monetization, marketplace selling, payments, moderation, and reports on Tengacion.
        </p>
        <small>Last updated: June 1, 2026</small>
      </section>

      <section className="public-policy-grid" aria-label="Terms details">
        {TERMS_SECTIONS.map((section) => (
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
          <p className="public-policy-eyebrow">Need help?</p>
          <h2>Report a concern or review related policies</h2>
        </div>
        <div className="public-policy-links">
          <Link to="/contact">Contact and reports</Link>
          <Link to="/refund-policy">Refund policy</Link>
          <Link to="/creator-monetization-terms">Creator monetization</Link>
          <Link to="/marketplace-seller-terms">Seller terms</Link>
        </div>
      </section>
    </main>
  );
}
