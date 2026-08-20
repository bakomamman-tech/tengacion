import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { loadKadahivePublic } from "../../api";
import KadahiveBrand from "./KadahiveBrand";
import "./kadahive.css";

const NAV_ITEMS = [
  ["Home", "home"],
  ["Services", "services"],
  ["Portal", "portal"],
  ["Events", "events"],
  ["Community", "community"],
  ["About", "about"],
  ["Contact", "contact"],
];

const SERVICES = [
  {
    number: "01",
    icon: "⌁",
    title: "Co-working spaces",
    text: "Flexible workspaces for startups, freelancers and remote teams, with fast internet and thoughtful amenities.",
    meta: "Desks · Meeting rooms · Event space",
  },
  {
    number: "02",
    icon: "⌘",
    title: "Training programmes",
    text: "Hands-on learning in software development, data science, digital marketing, AI and emerging technology.",
    meta: "Practical · Mentor-led · Career ready",
  },
  {
    number: "03",
    icon: "↗",
    title: "Startup incubation",
    text: "Mentorship, funding connections and venture-building resources that move ambitious ideas toward the market.",
    meta: "Strategy · Network · Investment readiness",
  },
  {
    number: "04",
    icon: "◎",
    title: "Event hosting",
    text: "A home for technology meetups, hackathons, workshops and conferences in the heart of Kaduna.",
    meta: "Meetups · Hackathons · Conferences",
  },
];

const BENEFITS = [
  ["Resource library", "Premium guides, templates, courses and industry reports."],
  ["Event discounts", "Member rates for workshops, programmes and hub events."],
  ["Networking tools", "Connect with mentors, investors and fellow innovators."],
  ["Project collaboration", "Find the people, tools and rooms to build together."],
];

const PROGRAMME_TRACKS = [
  "Digital skills training",
  "Brand identity & design",
  "Content creation",
  "Animation & 3D",
  "Graphic design",
  "Data science",
  "Programming & internet",
  "Product design",
  "Flutter",
  "PlayTech for children",
];

const FALLBACK_EVENTS = [
  {
    _id: "ai-workshop",
    title: "AI & Machine Learning Workshop",
    summary:
      "Learn the fundamentals of artificial intelligence and machine learning with hands-on projects.",
    dateLabel: "15 December 2025",
    status: "archived",
    category: "workshop",
  },
  {
    _id: "kids-code",
    title: "KADA Hive Christmas Program",
    summary:
      "A four-week holiday programme that gave children aged five and above practical coding skills.",
    dateLabel: "19 December 2025 – 16 January 2026",
    status: "archived",
    category: "training",
  },
  {
    _id: "cyber-smart",
    title: "Cyber Smart Bootcamp",
    summary:
      "An intensive two-day programme on cybersecurity, digital safety and practical protection.",
    dateLabel: "27–28 February 2026",
    status: "archived",
    category: "bootcamp",
  },
];

const archivedEventLink = (event) => {
  const identity = `${event?.slug || ""} ${event?.title || ""}`.toLowerCase();
  if (identity.includes("cyber")) {
    return "/kadahive/programmes/cyber-smart";
  }
  if (identity.includes("christmas") || identity.includes("kids") || identity.includes("code")) {
    return "/kadahive/programmes/kids-code";
  }
  return "/kadahive#contact";
};

function SectionIntro({ eyebrow, title, body, dark = false }) {
  return (
    <div className={`kh-section-intro ${dark ? "kh-section-intro--dark" : ""}`}>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
    </div>
  );
}

function EventDate({ event }) {
  const label = event.dateLabel || "";
  const [first = "", ...rest] = label.split(" ");
  return (
    <div className="kh-event-date" aria-label={label}>
      <strong>{first || "NEW"}</strong>
      <span>{rest.join(" ") || "DATE"}</span>
    </div>
  );
}

export default function KadahiveLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [events, setEvents] = useState(FALLBACK_EVENTS);

  useEffect(() => {
    let alive = true;
    loadKadahivePublic()
      .then((payload) => {
        if (alive && Array.isArray(payload?.events) && payload.events.length) {
          setEvents(payload.events);
        }
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, []);

  const featuredEvents = useMemo(() => events.slice(0, 3), [events]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="kh-site">
      <div className="kh-topline">
        <div className="kh-container kh-topline__inner">
          <span>Kaduna&apos;s home for builders, founders and future-ready talent.</span>
          <div>
            <a href="tel:+2347066326192">07066326192</a>
            <span aria-hidden="true">•</span>
            <a href="mailto:sady9043@gmail.com">sady9043@gmail.com</a>
            <span className="kh-powered">Powered by Tengacion</span>
          </div>
        </div>
      </div>

      <header className="kh-header">
        <div className="kh-container kh-header__inner">
          <KadahiveBrand />
          <button
            type="button"
            className="kh-menu-toggle"
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <span />
            <span />
          </button>
          <nav className={`kh-nav ${menuOpen ? "is-open" : ""}`} aria-label="Kadahive navigation">
            {NAV_ITEMS.map(([label, id]) => (
              <a key={id} href={`#${id}`} onClick={closeMenu}>
                {label}
              </a>
            ))}
            <Link className="kh-nav__login" to="/kadahive/login" onClick={closeMenu}>
              Member login
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="kh-hero" id="home">
          <img
            className="kh-hero__photo"
            src="/assets/kadahive/kadahive-innovation-hero.png"
            alt="Kaduna innovators collaborating in a modern technology hub"
            fetchPriority="high"
            decoding="async"
          />
          <div className="kh-hero__veil" />
          <div className="kh-hero__grid" aria-hidden="true" />
          <div className="kh-container kh-hero__content">
            <div className="kh-hero__copy">
              <div className="kh-kicker">
                <span />
                Kaduna, Nigeria
              </div>
              <h1>
                Building the future.
                <em>Defending our innovation.</em>
              </h1>
              <p>
                Kaduna&apos;s premier innovation and technology hub—empowering young people
                through practical technology, training and entrepreneurship support.
              </p>
              <div className="kh-hero__actions">
                <Link className="kh-btn kh-btn--amber" to="/kadahive/register">
                  Join our community <span>↗</span>
                </Link>
                <a className="kh-btn kh-btn--ghost" href="#services">
                  Explore services
                </a>
              </div>
              <div className="kh-hero__proof">
                <span>
                  <strong>500+</strong>
                  Community members
                </span>
                <span>
                  <strong>120+</strong>
                  Startups supported
                </span>
                <span>
                  <strong>50+</strong>
                  Events hosted
                </span>
              </div>
            </div>
          </div>
          <a className="kh-scroll-cue" href="#services">
            <span>Scroll to discover</span>
            <i aria-hidden="true">↓</i>
          </a>
        </section>

        <section className="kh-partners" aria-label="Institution background">
          <div className="kh-container kh-partners__inner">
            <p>Established in 2021 through a partnership between</p>
            <div>
              <strong>Bank of Industry</strong>
              <span />
              <strong>Kaduna State Government</strong>
            </div>
          </div>
        </section>

        <section className="kh-services kh-section" id="services">
          <div className="kh-container">
            <SectionIntro
              eyebrow="What we do"
              title="A complete ecosystem for people who build."
              body="From a reliable desk to venture support and career-changing skills, Kadahive gives innovators room to move."
            />
            <div className="kh-service-grid">
              {SERVICES.map((service) => (
                <article className="kh-service-card" key={service.title}>
                  <div className="kh-service-card__top">
                    <span className="kh-service-card__number">{service.number}</span>
                    <span className="kh-service-card__icon" aria-hidden="true">
                      {service.icon}
                    </span>
                  </div>
                  <h3>{service.title}</h3>
                  <p>{service.text}</p>
                  <small>{service.meta}</small>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="kh-programme kh-section" aria-labelledby="kh-programme-title">
          <div className="kh-container kh-programme__layout">
            <div className="kh-programme__visual">
              <img
                src="/assets/kadahive/kadahive-training-lab.png"
                alt="A facilitator guiding Kadahive learners through a technology lesson"
                loading="lazy"
                decoding="async"
              />
              <div className="kh-programme__badge">
                <strong>85%</strong>
                <span>Employment rate after programmes</span>
              </div>
            </div>
            <div className="kh-programme__copy">
              <SectionIntro
                eyebrow="Skills that travel"
                title="Training built around what the world needs next."
              />
              <p>
                Learn by doing. Kadahive programmes combine experienced facilitators,
                collaborative projects and the confidence to apply new skills beyond the
                classroom.
              </p>
              <div className="kh-programme__tracks" id="kh-programme-title">
                {PROGRAMME_TRACKS.map((track) => (
                  <span key={track}>{track}</span>
                ))}
              </div>
              <Link className="kh-text-link" to="/kadahive/register">
                Find your place at Kadahive <span>→</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="kh-portal kh-section" id="portal">
          <div className="kh-container">
            <SectionIntro
              eyebrow="The member portal"
              title="Your Kadahive experience, organised in one place."
              body="Book a workspace, discover resources, register for events and stay connected to Kaduna’s innovation community."
              dark
            />
            <div className="kh-benefit-grid">
              {BENEFITS.map(([title, text], index) => (
                <article key={title}>
                  <span>0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
            <div className="kh-portal__cta">
              <div>
                <span>Already a member?</span>
                <strong>Everything you need is waiting in your workspace.</strong>
              </div>
              <Link className="kh-btn kh-btn--amber" to="/kadahive/login">
                Open member portal <span>↗</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="kh-events kh-section" id="events">
          <div className="kh-container">
            <div className="kh-section-heading-row">
              <SectionIntro
                eyebrow="Programmes & events"
                title="Ideas become momentum when people meet."
                body="Explore Kadahive workshops, community sessions and flagship training programmes. Past programmes remain visible as part of the hub archive."
              />
              <Link className="kh-text-link" to="/kadahive/login">
                View in member portal <span>→</span>
              </Link>
            </div>
            <div className="kh-events-list">
              {featuredEvents.map((event) => (
                <article className="kh-event-row" key={event._id || event.slug || event.title}>
                  <EventDate event={event} />
                  <div className="kh-event-row__copy">
                    <span className="kh-event-row__tag">
                      {event.category || "community"} ·{" "}
                      {event.status === "archived" ? "Programme archive" : "Registration open"}
                    </span>
                    <h3>{event.title}</h3>
                    <p>{event.summary}</p>
                  </div>
                  <Link
                    className="kh-event-row__action"
                    to={
                      event.status === "published" ? "/kadahive/login" : archivedEventLink(event)
                    }
                    aria-label={`${event.status === "published" ? "Register for" : "Ask about"} ${
                      event.title
                    }`}
                  >
                    {event.status === "published" ? "Register" : "Details"} <span>↗</span>
                  </Link>
                </article>
              ))}
            </div>

            <div className="kh-programme-archive">
              <article>
                <span className="kh-programme-archive__label">Kids coding archive</span>
                <h3>Transform screen time into creation time.</h3>
                <p>
                  The four-week Christmas programme introduced children aged 5+ to coding
                  basics, Scratch, HTML, Python and AI through creative projects.
                </p>
                <ul>
                  <li>19 December 2025 – 16 January 2026</li>
                  <li>10:00am – 2:00pm daily</li>
                  <li>Digital certificate and instructor support</li>
                  <li>Historical programme fee: ₦50,000</li>
                </ul>
                <Link to="/kadahive/programmes/kids-code">
                  Explore the complete programme archive <span>↗</span>
                </Link>
              </article>
              <article>
                <span className="kh-programme-archive__label">Cyber Smart archive</span>
                <h3>Secure your digital life. Start a cyber career.</h3>
                <p>
                  The two-day bootcamp helped students, families, businesses and travellers
                  protect finances, private chats, accounts and devices.
                </p>
                <ul>
                  <li>Digital Lockdown and phishing defence</li>
                  <li>Ethical hacking and career pathways</li>
                  <li>Regular and premium access tracks</li>
                  <li>Facilitators: Ugwu Uriel, Imran Hassan and Abdulrasheed Audu</li>
                </ul>
                <Link to="/kadahive/programmes/cyber-smart">
                  Explore the complete programme archive <span>↗</span>
                </Link>
              </article>
            </div>
          </div>
        </section>

        <section className="kh-community kh-section" id="community">
          <div className="kh-community__image">
            <img
              src="/assets/kadahive/kadahive-community-coworking.png"
              alt="Kadahive founders and mentors collaborating in the coworking hub"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="kh-container kh-community__layout">
            <div className="kh-community__card">
              <span className="kh-community__eyebrow">Our community</span>
              <h2>Innovation feels different when nobody builds alone.</h2>
              <blockquote>
                “Kadahive provided the environment my startup needed to grow. The mentorship
                and network helped us move toward our first round of funding.”
              </blockquote>
              <div className="kh-community__person">
                <span>AA</span>
                <div>
                  <strong>Amina Abdullahi</strong>
                  <small>Founder, TechSolutions NG</small>
                </div>
              </div>
              <div className="kh-community__numbers">
                <span>
                  <strong>500+</strong> members
                </span>
                <span>
                  <strong>120+</strong> startups
                </span>
                <span>
                  <strong>50+</strong> events
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="kh-about kh-section" id="about">
          <div className="kh-container kh-about__layout">
            <SectionIntro eyebrow="About Kadahive" title="Built in Kaduna. Connected to possibility." />
            <div className="kh-about__copy">
              <p>
                Established in 2021 through a partnership between the Bank of Industry and
                Kaduna State Government, Kadahive is Kaduna&apos;s premier innovation and
                technology hub.
              </p>
              <p>
                Our work is simple to say and demanding to deliver: give people the skills,
                environment, relationships and confidence to create valuable solutions.
              </p>
              <div className="kh-history-card" aria-label="KADA Hive official opening">
                <time dateTime="2021-08-13">
                  <strong>13</strong>
                  <span>Aug 2021</span>
                </time>
                <div>
                  <span>Official opening</span>
                  <h3>A landmark for Kaduna&apos;s innovation community.</h3>
                  <p>
                    KADA Hive Innovation &amp; Technology Hub was officially declared open by
                    His Excellency Mallam Nasir El-Rufai (CFR), then Executive Governor of
                    Kaduna State.
                  </p>
                </div>
              </div>
              <div className="kh-about__values">
                <span>Practical learning</span>
                <span>Inclusive access</span>
                <span>Local innovation</span>
                <span>Global ambition</span>
              </div>
            </div>
          </div>
        </section>

        <section className="kh-join">
          <div className="kh-container kh-join__inner">
            <div>
              <span>Ready to build what comes next?</span>
              <h2>There&apos;s a place for you in Kaduna&apos;s innovation community.</h2>
            </div>
            <Link className="kh-btn kh-btn--navy" to="/kadahive/register">
              Become a member <span>↗</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="kh-footer" id="contact">
        <div className="kh-container kh-footer__grid">
          <div className="kh-footer__about">
            <KadahiveBrand />
            <p>
              Kaduna&apos;s premier innovation and technology hub, supporting talent,
              entrepreneurship and practical digital skills.
            </p>
            <div className="kh-footer__socials" aria-label="Social media">
              <a href="https://twitter.com" aria-label="X / Twitter">X</a>
              <a href="https://facebook.com" aria-label="Facebook">f</a>
              <a href="https://instagram.com" aria-label="Instagram">◎</a>
              <a href="https://linkedin.com" aria-label="LinkedIn">in</a>
            </div>
          </div>
          <div>
            <h3>Quick links</h3>
            {NAV_ITEMS.map(([label, id]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </div>
          <div>
            <h3>Member access</h3>
            <Link to="/kadahive/login">Member login</Link>
            <Link to="/kadahive/register">Create account</Link>
            <Link to="/kadahive/portal">Member dashboard</Link>
            <Link to="/kadahive/admin">Institution admin</Link>
          </div>
          <div>
            <h3>Contact us</h3>
            <address>
              <span>11B Sambo Road, City Centre, Kaduna</span>
              <a href="tel:+2347066326192">07066326192</a>
              <a href="mailto:sady9043@gmail.com">sady9043@gmail.com</a>
            </address>
          </div>
        </div>
        <div className="kh-container kh-footer__bottom">
          <span>© 2026 KADA Hive Innovation &amp; Tech Hub.</span>
          <span>Institution portal powered by Tengacion.</span>
        </div>
      </footer>
    </div>
  );
}
