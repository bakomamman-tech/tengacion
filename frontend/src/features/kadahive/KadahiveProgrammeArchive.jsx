import { Link } from "react-router-dom";

import KadahiveBrand from "./KadahiveBrand";
import "./kadahive.css";

const SCRATCH_MODULES = [
  {
    number: "01",
    title: "Getting started",
    text: "Meet Scratch, create a privacy-conscious account with a parent or guardian, and learn how its block-based approach turns ideas into games, stories and animation.",
    points: [
      "Visit Scratch and open the Create workspace",
      "Use a nickname instead of a child’s real name",
      "Explore projects, ideas and the moderated community",
      "Understand how blocks connect like building pieces",
    ],
  },
  {
    number: "02",
    title: "Your first project",
    text: "Explore the four parts of the Scratch editor and experiment before building a complete project.",
    points: [
      "Stage: where the project comes to life",
      "Sprites: characters controlled by code",
      "Code blocks: colourful instructions",
      "Scripts area: where instructions connect in sequence",
    ],
  },
  {
    number: "03",
    title: "Understanding code",
    text: "Learn why computers need clear, ordered instructions, then turn one large idea into small actions that can be tested and improved.",
    points: [
      "Move a sprite with precise step values",
      "Switch costumes to create walking animation",
      "Use repeat blocks to introduce loops",
      "Debug results by adjusting numbers and order",
    ],
  },
  {
    number: "04",
    title: "Your first real script",
    text: "Combine events, motion, looks and control blocks into complete programs, beginning with the traditional Hello, World project.",
    points: [
      "Start a script with the green-flag event",
      "Build repeat and forever loops",
      "Move a sprite to random positions",
      "Make a sprite follow the mouse pointer",
    ],
  },
];

const KIDS_SKILLS = [
  ["Coding basics", "Logic-building exercises that develop computational thinking."],
  ["Scratch programming", "Interactive games, stories and animation with visual code blocks."],
  ["HTML web design", "Simple web pages and an introduction to the language of the internet."],
  ["Python basics", "A friendly first step into text-based programming."],
  ["AI introduction", "Age-appropriate activities that explain how artificial intelligence works."],
];

const CYBER_TOPICS = [
  {
    number: "01",
    title: "The Digital Lockdown",
    subtitle: "Protect WhatsApp, banking apps and social accounts.",
    points: [
      "Check whether a WhatsApp account may be monitored",
      "Apply safer mobile-banking settings",
      "Protect social accounts from takeover",
      "Use two-factor authentication and stronger passwords",
    ],
    facilitator: "Ugwu Uriel · Cyber Analyst",
  },
  {
    number: "02",
    title: "Phishing to Fishing",
    subtitle: "Recognise the tactics used to steal money and identities.",
    points: [
      "Understand how Nigerian phishing attacks are structured",
      "Spot fake bank alerts and POS fraud",
      "Respond quickly after an unexpected debit",
      "Recognise social engineering and scam messages",
    ],
    facilitator: "Imran Hassan · Ethical Hacker",
  },
  {
    number: "03",
    title: "From Zero to Cyber Hero",
    subtitle: "Build a practical path into a cybersecurity career.",
    points: [
      "Explore entry certifications that do not require a degree",
      "Use free platforms for structured self-learning",
      "Understand the Nigerian cybersecurity job market",
      "Build a portfolio and professional network from scratch",
    ],
    facilitator: "Abdulrasheed Audu · Cybersecurity Consultant",
  },
];

function ArchiveHeader() {
  return (
    <header className="kh-programme-header">
      <div className="kh-container kh-programme-header__inner">
        <KadahiveBrand />
        <nav aria-label="Programme navigation">
          <Link to="/kadahive">Main site</Link>
          <Link to="/kadahive/portal">Member portal</Link>
          <Link className="kh-programme-header__cta" to="/kadahive/register">
            Join Kadahive
          </Link>
        </nav>
      </div>
    </header>
  );
}

function ArchiveNotice({ children }) {
  return (
    <div className="kh-archive-notice">
      <strong>Programme archive</strong>
      <p>{children}</p>
    </div>
  );
}

function KidsCodeArchive() {
  return (
    <div className="kh-programme-page">
      <ArchiveHeader />
      <main>
        <section className="kh-programme-hero kh-programme-hero--kids">
          <img
            src="/assets/kadahive/kadahive-training-lab.png"
            alt="Young learners taking part in a practical Kadahive technology class"
            fetchPriority="high"
            decoding="async"
          />
          <div className="kh-programme-hero__veil" />
          <div className="kh-container kh-programme-hero__content">
            <span className="kh-programme-hero__eyebrow">Kids Code · Holiday programme archive</span>
            <h1>Transform screen time into creation time.</h1>
            <p>
              A friendly coding journey for children aged five and above—moving from visual
              programming into web development, Python and the ideas behind AI.
            </p>
            <div className="kh-programme-hero__meta">
              <span>19 Dec 2025 – 16 Jan 2026</span>
              <span>10:00am – 2:00pm daily</span>
              <span>11B Sambo Road, Kaduna</span>
            </div>
          </div>
        </section>

        <section className="kh-programme-body">
          <div className="kh-container">
            <ArchiveNotice>
              This four-week Christmas programme has ended. Its curriculum, historical pricing
              and referral terms are preserved here for parents and future programme planning;
              no old bank-transfer or access-token flow is active on this page.
            </ArchiveNotice>

            <div className="kh-programme-intro">
              <div>
                <span>Scratch fundamentals</span>
                <h2>Four modules that turn curiosity into working code.</h2>
              </div>
              <p>
                Scratch teaches real programming ideas through colourful blocks. Learners build
                confidence by testing, making mistakes, debugging and seeing their ideas move on
                screen.
              </p>
            </div>

            <div className="kh-curriculum-grid">
              {SCRATCH_MODULES.map((module) => (
                <article key={module.number}>
                  <span>{module.number}</span>
                  <h3>{module.title}</h3>
                  <p>{module.text}</p>
                  <ul>
                    {module.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="kh-programme-band">
          <div className="kh-container kh-programme-band__layout">
            <div>
              <span className="kh-programme-band__eyebrow">What children learned</span>
              <h2>Creativity + code = a powerful first step.</h2>
              <p>
                The programme combined guided tutorials, independent experimentation and
                instructor support, ending with a digital certificate and projects learners could
                continue developing.
              </p>
            </div>
            <div className="kh-skill-list">
              {KIDS_SKILLS.map(([title, text]) => (
                <article key={title}>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="kh-programme-body kh-programme-body--details">
          <div className="kh-container">
            <div className="kh-programme-intro">
              <div>
                <span>Original programme details</span>
                <h2>A practical four-week holiday experience.</h2>
              </div>
              <p>
                These figures are historical and are not a current offer. Contact Kadahive for
                current cohorts, dates and fees.
              </p>
            </div>
            <div className="kh-detail-grid">
              <article>
                <span>Age group</span>
                <strong>5 years and above</strong>
              </article>
              <article>
                <span>Historical programme fee</span>
                <strong>₦50,000</strong>
              </article>
              <article>
                <span>Original referral offer</span>
                <strong>₦3,000 per child</strong>
                <small>₦10,000 per child for three or more referrals</small>
              </article>
              <article>
                <span>Included</span>
                <strong>Instructor support</strong>
                <small>Four modules, project access and digital certificate</small>
              </article>
            </div>
          </div>
        </section>

        <ProgrammeFooter
          title="Looking for the next Kids Code cohort?"
          body="Join the Kadahive community or contact the hub for current programme dates."
        />
      </main>
    </div>
  );
}

function CyberSmartArchive() {
  return (
    <div className="kh-programme-page">
      <ArchiveHeader />
      <main>
        <section className="kh-programme-hero kh-programme-hero--cyber">
          <img
            src="/assets/kadahive/kadahive-innovation-hero.png"
            alt="Kadahive technology learners collaborating around a laptop and prototype"
            fetchPriority="high"
            decoding="async"
          />
          <div className="kh-programme-hero__veil" />
          <div className="kh-container kh-programme-hero__content">
            <span className="kh-programme-hero__eyebrow">
              Cyber Smart Bootcamp · 2026 archive
            </span>
            <h1>Secure your digital life. Start a cyber career.</h1>
            <p>
              A two-day workshop created for students, families, businesses and travellers who
              want to protect their money, privacy, accounts and devices.
            </p>
            <div className="kh-programme-hero__meta">
              <span>27–28 February 2026</span>
              <span>Two-day intensive workshop</span>
              <span>11B Sambo Road, Kaduna</span>
            </div>
          </div>
        </section>

        <section className="kh-programme-body">
          <div className="kh-container">
            <ArchiveNotice>
              This bootcamp has ended. The agenda, access levels and referral figures below are
              retained as an accurate programme record and should not be treated as a current
              registration or price offer.
            </ArchiveNotice>

            <div className="kh-programme-intro">
              <div>
                <span>Purpose</span>
                <h2>A more cyber-resilient Kaduna.</h2>
              </div>
              <div className="kh-purpose-copy">
                <p>
                  <strong>Mission:</strong> empower Kaduna’s students, families, businesses and
                  travellers with the cyber-hygiene skills to identify threats, protect finances
                  and secure their digital lives.
                </p>
                <p>
                  <strong>Vision:</strong> build a community that operates with digital confidence
                  and less fear of online threats.
                </p>
              </div>
            </div>

            <div className="kh-reason-grid">
              {[
                ["Stop financial theft", "Recognise scam tactics and act before money is lost."],
                ["Protect your privacy", "Check and strengthen private chats and social accounts."],
                ["Start a career", "Map the first steps toward a global cybersecurity career."],
                ["Learn by doing", "Apply security changes to real devices during the workshop."],
              ].map(([title, text], index) => (
                <article key={title}>
                  <span>0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="kh-programme-band">
          <div className="kh-container">
            <div className="kh-programme-intro kh-programme-intro--light">
              <div>
                <span>Bootcamp agenda</span>
                <h2>From digital defence to a career roadmap.</h2>
              </div>
              <p>Two focused days balanced immediate protection with long-term opportunity.</p>
            </div>
            <div className="kh-agenda-grid">
              <AgendaDay
                label="Day 01 · The Shield"
                sessions={[
                  ["10:00", "The threat landscape", "Phishing, POS fraud and common scams."],
                  ["12:00", "Digital Lockdown", "Live WhatsApp and banking-app security."],
                  [
                    "14:00",
                    "Breakout tracks",
                    "Safe Business for SMEs and Secured Ring for couples.",
                  ],
                ]}
              />
              <AgendaDay
                label="Day 02 · The Sword"
                sessions={[
                  [
                    "10:00",
                    "Protecting your identity",
                    "Safe travel, digital rights and privacy.",
                  ],
                  [
                    "12:00",
                    "Introduction to ethical hacking",
                    "How attackers think—and how defenders respond.",
                  ],
                  [
                    "14:00",
                    "Careers and futures",
                    "Certification, portfolios and getting a job in cyber.",
                  ],
                ]}
              />
            </div>
          </div>
        </section>

        <section className="kh-programme-body">
          <div className="kh-container">
            <div className="kh-programme-intro">
              <div>
                <span>Key topics</span>
                <h2>Practical security, explained by practitioners.</h2>
              </div>
              <p>
                Each topic linked an everyday risk to concrete action, with a specialist guiding
                the session.
              </p>
            </div>
            <div className="kh-cyber-topic-grid">
              {CYBER_TOPICS.map((topic) => (
                <article key={topic.number}>
                  <span>{topic.number}</span>
                  <h3>{topic.title}</h3>
                  <p>{topic.subtitle}</p>
                  <ul>
                    {topic.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                  <small>{topic.facilitator}</small>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="kh-programme-body kh-programme-body--details">
          <div className="kh-container">
            <div className="kh-programme-intro">
              <div>
                <span>Original access levels</span>
                <h2>Two ways participants joined the bootcamp.</h2>
              </div>
              <p>All pricing and referral values below are historical records from February 2026.</p>
            </div>
            <div className="kh-access-grid">
              <AccessCard
                label="Regular access"
                price="₦5,000"
                groupRate="₦2,000 per person for groups of three or more"
                features={[
                  "Two-day intensive training",
                  "Workshop materials",
                  "Expert networking",
                  "Basic cybersecurity checklist",
                ]}
              />
              <AccessCard
                label="Premium access"
                price="₦7,000"
                groupRate="₦4,000 per person for groups of three or more"
                features={[
                  "Everything in Regular",
                  "Digital resource pack and templates",
                  "Lifetime session recordings",
                  "Priority Q&A and career roadmap",
                ]}
                premium
              />
            </div>

            <div className="kh-archive-facts">
              <article>
                <h3>Who it served</h3>
                <p>
                  Students and youth, SMEs and families, couples, civilians and travellers—each
                  with scenarios tailored to their digital lives.
                </p>
              </article>
              <article>
                <h3>Original referral structure</h3>
                <p>
                  Regular referrals paid ₦500 for one or ₦2,000 each for three or more; Premium
                  referrals paid ₦1,000 for one or ₦4,000 each for three or more.
                </p>
              </article>
              <article>
                <h3>What participants needed</h3>
                <p>
                  A laptop was optional, while a smartphone was recommended for the live Digital
                  Lockdown session. Lunch was not included.
                </p>
              </article>
            </div>
          </div>
        </section>

        <ProgrammeFooter
          title="Want to hear about the next Cyber Smart programme?"
          body="Create a member account and stay connected to Kadahive’s upcoming workshops."
        />
      </main>
    </div>
  );
}

function AgendaDay({ label, sessions }) {
  return (
    <article>
      <span>{label}</span>
      <ol>
        {sessions.map(([time, title, text]) => (
          <li key={`${time}-${title}`}>
            <time>{time}</time>
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}

function AccessCard({ label, price, groupRate, features, premium = false }) {
  return (
    <article className={premium ? "is-premium" : ""}>
      <span>{label}</span>
      <strong>{price}</strong>
      <small>{groupRate}</small>
      <ul>
        {features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
    </article>
  );
}

function ProgrammeFooter({ title, body }) {
  return (
    <section className="kh-programme-cta">
      <div className="kh-container">
        <span>Build what comes next</span>
        <h2>{title}</h2>
        <p>{body}</p>
        <div>
          <Link className="kh-btn kh-btn--amber" to="/kadahive/register">
            Join the community <span>↗</span>
          </Link>
          <a className="kh-btn kh-btn--ghost" href="mailto:info@kadahivehub.com">
            Email Kadahive
          </a>
        </div>
      </div>
    </section>
  );
}

export default function KadahiveProgrammeArchive({ programme = "kids" }) {
  return programme === "cyber" ? <CyberSmartArchive /> : <KidsCodeArchive />;
}
