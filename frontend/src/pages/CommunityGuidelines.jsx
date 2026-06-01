import { Link } from "react-router-dom";

import SeoHead from "../components/seo/SeoHead";

import "./public-policy.css";

const GUIDELINE_SECTIONS = [
  {
    title: "Respectful participation",
    items: [
      "Do not harass, bully, threaten, shame, dox, impersonate, or target people because of identity, beliefs, appearance, location, work, or creator status.",
      "Do not coordinate abuse, spam mentions, manipulate engagement, or use accounts to evade enforcement.",
      "Use comments, messages, public posts, and creator spaces to build community rather than intimidate or exploit people.",
    ],
  },
  {
    title: "Safety and prohibited content",
    items: [
      "Do not post sexual exploitation, child-safety risk, grooming behavior, coercion, non-consensual intimate content, credible threats, or instructions for serious harm.",
      "Do not share scams, fake giveaways, malicious links, fraud attempts, counterfeit listings, or misleading payment requests.",
      "Graphic violence, hate, extremist praise, unsafe challenges, and content designed to shock or harm users may be removed or restricted.",
    ],
  },
  {
    title: "Creator and copyright standards",
    items: [
      "Creators must publish work they own or have permission to use, including music, cover art, books, podcast audio, video, and descriptions.",
      "Do not misrepresent another artist, author, seller, public figure, brand, school, organization, or rights owner.",
      "Repeated rights violations, upload abuse, or misleading creator claims can limit publishing, monetization, and account access.",
    ],
  },
  {
    title: "Marketplace trust",
    items: [
      "Marketplace listings must use accurate images, titles, prices, stock status, condition notes, pickup details, delivery terms, and seller information.",
      "Do not list prohibited, dangerous, counterfeit, stolen, deceptive, or unavailable items.",
      "Buyers and sellers must cooperate with order, refund, dispute, and safety reviews when a transaction is questioned.",
    ],
  },
  {
    title: "Reporting and enforcement",
    items: [
      "Reports may lead to no action, warning, content removal, visibility limits, account restriction, seller review, payout hold, or escalation for severe safety risks.",
      "Tengacion may use automated signals and human review for high-impact moderation, copyright, marketplace, payout, and child-safety decisions.",
      "Repeated violations, evasion, fraud, or severe abuse can result in account suspension or removal.",
    ],
  },
];

export default function CommunityGuidelinesPage() {
  return (
    <main className="public-policy-page">
      <SeoHead
        title="Community Guidelines | Tengacion"
        description="Review Tengacion community guidelines for respectful participation, safety, moderation, and reporting."
        canonical="/community-guidelines"
      />
      <section className="public-policy-hero">
        <Link className="public-policy-brand" to="/">
          <img src="/tengacion_logo_128.png" alt="" />
          <span>Tengacion</span>
        </Link>
        <p className="public-policy-eyebrow">Community safety</p>
        <h1>Community Guidelines</h1>
        <p>
          These guidelines define the behavior and content standards that protect public posts,
          creator discovery, messaging, marketplace trust, and paid creator workflows.
        </p>
        <small>Last updated: June 1, 2026</small>
      </section>

      <section className="public-policy-grid" aria-label="Community guideline details">
        {GUIDELINE_SECTIONS.map((section) => (
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
          <p className="public-policy-eyebrow">Report abuse</p>
          <h2>Send safety, abuse, copyright, or marketplace concerns for review</h2>
        </div>
        <div className="public-policy-links">
          <Link to="/contact">Submit report</Link>
          <Link to="/moderation-policy">Moderation policy</Link>
          <Link to="/child-safety">Child safety</Link>
        </div>
      </section>
    </main>
  );
}
