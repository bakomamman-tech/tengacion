import { Link } from "react-router-dom";

import SeoHead from "../components/seo/SeoHead";

import "./public-policy.css";

const PRIVACY_SECTIONS = [
  {
    title: "Information Tengacion uses",
    items: [
      "Account details such as name, username, email, phone number, profile image, creator profile details, seller profile details, and security settings.",
      "Content and activity such as posts, comments, reactions, uploads, creator releases, marketplace listings, purchases, messages metadata, reports, and moderation records.",
      "Payment and payout records such as transaction references, order details, entitlement status, settlement status, refund or dispute history, and payout readiness signals. Card or bank processing may be handled by payment providers.",
      "Technical information such as device, browser, IP-derived security signals, logs, cookies, session records, performance events, and abuse-prevention signals.",
    ],
  },
  {
    title: "How information is used",
    items: [
      "Provide core features including accounts, feeds, creator profiles, uploads, purchases, subscriptions, marketplace orders, notifications, and support.",
      "Protect the platform through security logging, abuse prevention, moderation, copyright review, child-safety escalation, fraud detection, and payment dispute handling.",
      "Improve discovery, ranking, onboarding, recommendations, analytics, product quality, reliability, and support workflows.",
      "Communicate about account access, reports, purchases, creator activity, seller activity, policy updates, and operational support.",
    ],
  },
  {
    title: "Sharing and service providers",
    items: [
      "Tengacion may share necessary information with infrastructure, storage, media, analytics, email, payment, security, moderation, and support providers that help operate the service.",
      "Marketplace buyers and sellers may see order, fulfillment, pickup, delivery, and contact details needed to complete a transaction.",
      "Information may be preserved or shared when required for legal compliance, safety escalation, fraud prevention, rights enforcement, or valid law-enforcement requests.",
    ],
  },
  {
    title: "Controls and requests",
    items: [
      "Users can manage profile visibility, messaging permissions, notification preferences, security settings, and account details from settings where available.",
      "You can permanently delete your account and associated personal content from Settings or the public account deletion page. You can also request access, correction, deletion help, or privacy review through the public contact route.",
      "Limited transaction, accounting, fraud-prevention, dispute, and safety records may be retained where legally required. Tengacion removes profile details from retained records where possible.",
      "Public content, creator pages, marketplace listings, and profile information may remain visible until removed, unpublished, restricted, or deleted under platform controls.",
    ],
  },
  {
    title: "Children and sensitive reports",
    items: [
      "Tengacion is not intended for children under 13, or under the higher age required by local law.",
      "Reports involving minors, exploitation, grooming, coercion, or unsafe contact are treated as urgent safety matters and may be escalated under the child safety policy.",
      "Do not submit unnecessary sensitive personal information in public report forms unless it is needed to investigate the issue.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="public-policy-page">
      <SeoHead
        title="Privacy Policy | Tengacion"
        description="Learn how Tengacion processes account information, creator content, and privacy controls across the platform."
        canonical="/privacy"
      />
      <section className="public-policy-hero">
        <Link className="public-policy-brand" to="/">
          <img src="/tengacion_logo_128.png" alt="" />
          <span>Tengacion</span>
        </Link>
        <p className="public-policy-eyebrow">Privacy and data</p>
        <h1>Privacy Policy</h1>
        <p>
          This policy explains how Tengacion uses account, creator, marketplace, payment,
          safety, and technical information to operate and protect the platform.
        </p>
        <small>Last updated: June 27, 2026</small>
      </section>

      <section className="public-policy-grid" aria-label="Privacy details">
        {PRIVACY_SECTIONS.map((section) => (
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
          <p className="public-policy-eyebrow">Privacy requests</p>
          <h2>Request access, correction, deletion, or privacy review</h2>
        </div>
        <div className="public-policy-links">
          <Link to="/contact">Submit privacy request</Link>
          <Link to="/account-deletion">Delete account</Link>
          <Link to="/child-safety">Child safety</Link>
          <Link to="/terms">Terms</Link>
        </div>
      </section>
    </main>
  );
}
