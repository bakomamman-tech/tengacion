import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import SeoHead from "../../components/seo/SeoHead";
import { buildBreadcrumbJsonLd } from "../../lib/seo";
import BrightFutureLayout from "./BrightFutureLayout";
import { CANONICAL_ROOT, SUBJECTS } from "./brightFutureData";
import { getBrightFutureLeaderboard, getBrightFutureParticipants } from "./brightFutureApi";
import useBrightFuture from "./useBrightFuture";

const SEO_DESCRIPTION = "Register for Bright Future Academy's 50-question CBT challenge covering Nigerian entertainment, football, technology, English, mathematics and science/STEM.";

const STATUS_LABELS = {
  registration_upcoming: "Registration upcoming",
  registration_open: "Registration open",
  examination_open: "Examination open",
  examination_closed: "Examination closed",
  results_published: "Results published",
};

export default function BrightFutureLandingPage() {
  const { competition } = useBrightFuture();
  const [leaderboard, setLeaderboard] = useState(null);
  const [participantCount, setParticipantCount] = useState(0);

  useEffect(() => {
    getBrightFutureLeaderboard({ limit: 3 }).then(setLeaderboard).catch(() => null);
    getBrightFutureParticipants({ limit: 1 }).then((data) => setParticipantCount(data.total || 0)).catch(() => null);
  }, []);

  return (
    <BrightFutureLayout fullBleed>
      <SeoHead
        title="Bright Future Academy | Smart School Portal & CBT Challenge"
        description={SEO_DESCRIPTION}
        canonical={CANONICAL_ROOT}
        robots="index,follow"
        structuredData={[
          { "@context": "https://schema.org", "@type": "EducationalOrganization", name: "Bright Future Academy", url: `https://tengacion.com${CANONICAL_ROOT}`, slogan: "Learn. Compete. Excel." },
          buildBreadcrumbJsonLd([{ name: "Tengacion", url: "/" }, { name: "Bright Future Academy", url: CANONICAL_ROOT }]),
        ]}
      />
      <section className="bfa-hero">
        <div className="bfa-hero__glow bfa-hero__glow--one" />
        <div className="bfa-hero__glow bfa-hero__glow--two" />
        <div className="bfa-hero__content">
          <span className="bfa-status-pill"><i />{STATUS_LABELS[competition?.competitionStatus] || "National academic challenge"}</span>
          <p className="bfa-eyebrow">Bright Future Academy – Smart School Portal</p>
          <h1>Learn. Compete. <span>Excel.</span></h1>
          <p className="bfa-hero__lead">One smart school portal. One exciting national academic challenge. A confident path from the classroom to the leaderboard.</p>
          <div className="bfa-hero__actions">
            <Link className="bfa-button bfa-button--primary bfa-button--large" to={`${CANONICAL_ROOT}/register`}>Register as a Student <span>→</span></Link>
            <Link className="bfa-button bfa-button--glass bfa-button--large" to={`${CANONICAL_ROOT}/exam/instructions`}>Enter CBT Challenge</Link>
          </div>
          <div className="bfa-trust-row"><span>✓ No email required</span><span>✓ Secure Candidate ID</span><span>✓ Server-verified results</span></div>
        </div>
        <div className="bfa-hero__visual" aria-label="Five-category academic challenge preview">
          <div className="bfa-challenge-card">
            <div className="bfa-challenge-card__head"><span>National CBT Challenge</span><strong>50 Questions</strong></div>
            <div className="bfa-challenge-card__score"><span>01</span><div><small>Question of 50</small><strong>Ready to rise?</strong></div><b>00:50</b></div>
            <div className="bfa-challenge-card__question"><i />Think clearly. Choose confidently. Every second counts.</div>
            <div className="bfa-mini-options"><span>A</span><span>B</span><span>C</span><span>D</span><span>E</span></div>
            <div className="bfa-challenge-card__progress"><i /></div>
          </div>
          <span className="bfa-floating-badge bfa-floating-badge--top">🏆 Live ranking</span>
          <span className="bfa-floating-badge bfa-floating-badge--bottom">✦ 5 categories · 10 each</span>
        </div>
      </section>

      <section className="bfa-stat-strip" aria-label="Competition facts">
        <article><strong>{participantCount.toLocaleString()}+</strong><span>Registered learners</span></article>
        <article><strong>50</strong><span>Challenging questions</span></article>
        <article><strong>5</strong><span>Challenge categories</span></article>
        <article><strong>50s</strong><span>For each question</span></article>
      </section>

      <section className="bfa-section bfa-section--center">
        <p className="bfa-eyebrow">A complete learning experience</p>
        <h2>Everything a focused student needs</h2>
        <p className="bfa-section__intro">Organise school life, prepare with purpose and compete on a secure national stage—all from one polished student portal.</p>
        <div className="bfa-feature-grid">
          {[
            ["✦", "National CBT Challenge", "A single five-category examination for learners from Basic One through SSS 3."],
            ["▥", "Instant verified results", "Category scores, percentage, response statistics and live provisional rank from the server."],
            ["⌂", "Smart student dashboard", "Profile, subjects, assignments, attendance, announcements and teacher information in one place."],
            ["♛", "Transparent leaderboard", "Privacy-safe rankings based on percentage, STEM, General English and legitimate completion time."],
          ].map(([icon, title, copy]) => <article className="bfa-feature-card" key={title}><span>{icon}</span><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </section>

      <section className="bfa-section bfa-academic-section">
        <div className="bfa-section-heading"><div><p className="bfa-eyebrow">Academic excellence</p><h2>Five categories. One shared challenge.</h2></div><p>All registered candidates answer the same balanced reasoning-led examination, regardless of class.</p></div>
        <div className="bfa-subject-grid">
          {SUBJECTS.map((subject, index) => <article className={`bfa-subject-card is-${subject.tone}`} key={subject.key}><span>{subject.mark}</span><small>Category {String(index + 1).padStart(2, "0")}</small><h3>{subject.name}</h3><p>{subject.copy}</p><b>10 questions <i>→</i></b></article>)}
        </div>
      </section>

      <section className="bfa-section bfa-leader-preview">
        <div className="bfa-section-heading"><div><p className="bfa-eyebrow">National standings</p><h2>{leaderboard?.leader ? "Meet the current front-runners" : "The leaderboard awaits its first champions"}</h2></div><Link to={`${CANONICAL_ROOT}/leaderboard`}>View full leaderboard →</Link></div>
        <div className="bfa-podium-grid">
          {(leaderboard?.entries || []).slice(0, 3).map((entry, index) => <article key={`${entry.rank}-${entry.candidateId}`} className={`bfa-podium-card place-${index + 1}`}><span>{["🥇", "🥈", "🥉"][index]}</span><small>#{entry.rank}</small><h3>{entry.displayName}</h3><p>{entry.schoolName}</p><strong>{entry.score}<i>/{entry.maximumScore || 50}</i></strong><b>{entry.percentage}%</b></article>)}
          {!leaderboard?.entries?.length ? <div className="bfa-empty-card"><span>♛</span><h3>Ready for the first verified result</h3><p>Complete the challenge to take your place among Bright Future Academy's leading learners.</p></div> : null}
        </div>
      </section>

      <section className="bfa-cta-band"><div><p className="bfa-eyebrow">Your bright future starts here</p><h2>Ready to learn, compete and excel?</h2><p>Registration takes only a few minutes and does not require an email address.</p></div><Link className="bfa-button bfa-button--light bfa-button--large" to={`${CANONICAL_ROOT}/register`}>Create Student Profile →</Link></section>
    </BrightFutureLayout>
  );
}
