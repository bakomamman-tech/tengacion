import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import { resolveImage } from "../api";
import SeoHead from "../components/seo/SeoHead";
import {
  buildBreadcrumbJsonLd,
  buildCanonicalUrl,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  resolveSeoImage,
  truncateDescription,
} from "../lib/seo";
import {
  fetchPublicSchoolPage,
  submitSchoolInquiry,
} from "../services/schoolPageService";

import "./school-profile.css";

const FALLBACK_COVER = "/assets/school-profile-hero-fallback.png";
const MAX_GALLERY_IMAGES = 12;

const DEFAULT_DEPARTMENTS = [
  { department: "Nursery", description: "Early learning, language, numeracy, and guided play." },
  { department: "Primary", description: "Strong literacy, numeracy, science, culture, and character foundation." },
  { department: "Junior Secondary", description: "Structured academic growth with practical ICT and arts exposure." },
  { department: "Senior Secondary", description: "Exam readiness, leadership, projects, and career direction." },
  { department: "ICT", description: "Digital confidence, computer literacy, and creative problem solving." },
  { department: "Arts and Music", description: "Creative expression, performance, design, and cultural confidence." },
];

const DEFAULT_FACILITIES = [
  { title: "ICT Lab", description: "Technology-enabled learning for digital skills and research." },
  { title: "Library", description: "Reading culture, quiet study, and supervised academic resources." },
  { title: "Creative Arts Studio", description: "Visual arts, performance, music, and hands-on creativity." },
  { title: "Safe Classrooms", description: "Organized learning spaces built for focus and supervision." },
  { title: "Playground", description: "Structured play, movement, and social development." },
  { title: "Administration", description: "Responsive school support for families and visitors." },
];

const DEFAULT_WHY_CHOOSE_US = [
  {
    label: "Academic discipline",
    description: "A structured learning culture that values preparation, focus, and measurable growth.",
  },
  {
    label: "Creative confidence",
    description: "Students are encouraged to think, make, perform, and communicate with purpose.",
  },
  {
    label: "Parent partnership",
    description: "Clear communication helps families stay connected to progress and school life.",
  },
  {
    label: "Future-ready skills",
    description: "ICT, leadership, and practical learning prepare learners for the world ahead.",
  },
];

const initialInquiryForm = {
  parentName: "",
  phoneNumber: "",
  email: "",
  childClassInterest: "",
  message: "",
};

const normalizeList = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const getInitials = (value = "School") =>
  String(value || "School")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "S";

const getImage = (...values) => {
  for (const value of values) {
    const resolved = resolveImage(value);
    if (resolved) {
      return resolved;
    }
  }
  return "";
};

const formatDate = (value) => {
  if (!value) {
    return "School update";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "School update";
  }
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

const buildPhoneHref = (phone = "") => {
  const normalized = String(phone || "").replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : "";
};

const buildWhatsAppHref = (number = "") => {
  const digits = String(number || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
};

const Section = ({ eyebrow, title, children, id = "", className = "" }) => (
  <section id={id} className={["school-profile-section", className].filter(Boolean).join(" ")}>
    <div className="school-profile-section__head">
      {eyebrow ? <p>{eyebrow}</p> : null}
      <h2>{title}</h2>
    </div>
    {children}
  </section>
);

const ActionLink = ({ href, children, variant = "secondary", onClick }) => {
  if (!href && !onClick) {
    return null;
  }
  const className = `school-profile-btn school-profile-btn--${variant}`;
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {children}
      </button>
    );
  }
  return (
    <a className={className} href={href}>
      {children}
    </a>
  );
};

const SchoolLogo = ({ school }) => {
  const logo = getImage(school?.logoUrl);
  return (
    <div className="school-profile-logo" aria-label={`${school?.schoolName || "School"} logo`}>
      {logo ? <img src={logo} alt="" /> : <span>{getInitials(school?.schoolName)}</span>}
    </div>
  );
};

const LoadingState = () => (
  <main className="school-profile-page school-profile-page--loading">
    <div className="school-profile-loading">
      <span />
      <strong>Loading school page...</strong>
    </div>
  </main>
);

const NotFoundState = ({ slug }) => (
  <main className="school-profile-page">
    <SeoHead
      title="School Page Not Found | Tengacion"
      description="This Tengacion school page could not be found."
      canonical={`/schools/${slug || ""}`}
      robots="noindex,follow"
    />
    <section className="school-profile-not-found">
      <Link className="school-profile-brand" to="/">
        <img src="/tengacion_logo_128.png" alt="" />
        <span>Tengacion</span>
      </Link>
      <h1>School page not found</h1>
      <p>This public school website may still be in draft or the link may have changed.</p>
      <Link className="school-profile-btn school-profile-btn--primary" to="/">
        Back to Tengacion
      </Link>
    </section>
  </main>
);

export default function SchoolProfilePage({ slugOverride = "" }) {
  const params = useParams();
  const slug = slugOverride || params.slug || "kurahtechandartsacademy";
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialInquiryForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

  useEffect(() => {
    let alive = true;

    const loadSchool = async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await fetchPublicSchoolPage(slug);
        if (!alive) {
          return;
        }
        setSchool(payload?.school || null);
      } catch (err) {
        if (!alive) {
          return;
        }
        setError(err?.message || "Could not load this school page.");
        setSchool(null);
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    loadSchool();
    return () => {
      alive = false;
    };
  }, [slug]);

  const theme = {
    "--school-primary": school?.themeColors?.primary || "#050505",
    "--school-accent": school?.themeColors?.accent || "#f2c94c",
    "--school-emphasis": school?.themeColors?.emphasis || "#c9302c",
    "--school-growth": school?.themeColors?.growth || "#1f8f4d",
  };
  const coverImage = getImage(school?.coverImageUrl, FALLBACK_COVER);
  const ogImage = getImage(school?.ogImageUrl, school?.coverImageUrl, FALLBACK_COVER);
  const canonicalPath = `/schools/${school?.slug || slug}`;
  const phoneHref = buildPhoneHref(school?.contactPhone);
  const whatsAppHref = buildWhatsAppHref(school?.whatsappNumber || school?.contactPhone);
  const emailHref = school?.contactEmail ? `mailto:${school.contactEmail}` : "";
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}${canonicalPath}`
    : buildCanonicalUrl(canonicalPath);
  const admission = school?.admissionInfo || {};
  const announcements = normalizeList(school?.announcements);
  const galleryImages = normalizeList(school?.galleryImages).slice(0, MAX_GALLERY_IMAGES);
  const departments = normalizeList(school?.staffDepartments).length
    ? normalizeList(school.staffDepartments)
    : DEFAULT_DEPARTMENTS;
  const facilities = normalizeList(school?.facilities).length
    ? normalizeList(school.facilities)
    : DEFAULT_FACILITIES;
  const whyChooseUs = normalizeList(school?.whyChooseUs).length
    ? normalizeList(school.whyChooseUs)
    : DEFAULT_WHY_CHOOSE_US;
  const testimonials = normalizeList(school?.testimonials);
  const values = normalizeList(school?.values);
  const highlights = normalizeList(school?.highlights);
  const stats = [
    { label: "Students", value: school?.statistics?.students || "" },
    { label: "Teachers", value: school?.statistics?.teachers || "" },
    { label: "Years", value: school?.statistics?.yearsOfExcellence || "" },
    { label: "Departments", value: school?.statistics?.departments || "" },
  ].filter((entry) => entry.value !== "" && Number(entry.value) > 0);
  const seoDescription = truncateDescription(
    school?.about ||
      school?.motto ||
      `${school?.schoolName || "This school"} is a Tengacion-powered school profile with admission, announcements, gallery, and contact details.`,
    180
  );
  const structuredData = useMemo(() => {
    if (!school) {
      return [];
    }
    return [
      buildWebSiteJsonLd(),
      buildOrganizationJsonLd(),
      buildBreadcrumbJsonLd([
        { name: "Tengacion", url: "/" },
        { name: "Schools", url: "/schools" },
        { name: school.schoolName || "School", url: canonicalPath },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "EducationalOrganization",
        name: school.schoolName || "School",
        url: buildCanonicalUrl(canonicalPath),
        description: seoDescription,
        image: resolveSeoImage(ogImage),
        logo: school.logoUrl ? resolveSeoImage(school.logoUrl) : undefined,
        email: school.contactEmail || undefined,
        telephone: school.contactPhone || undefined,
        address: school.address
          ? {
              "@type": "PostalAddress",
              streetAddress: school.address,
              addressCountry: "NG",
            }
          : undefined,
      },
    ];
  }, [canonicalPath, ogImage, school, seoDescription]);

  const scrollToInquiry = () => {
    document.getElementById("school-inquiry")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const shareSchool = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: school?.schoolName || "Tengacion school page",
          text: school?.motto || seoDescription,
          url: shareUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      toast.success("School link copied");
    } catch {
      toast.error("Could not share this page right now.");
    }
  };

  const updateField = (field) => (event) => {
    setForm((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitMessage("");
    try {
      await submitSchoolInquiry(school.slug || slug, {
        ...form,
        sourcePath: typeof window !== "undefined" ? window.location.pathname : canonicalPath,
      });
      setForm(initialInquiryForm);
      setSubmitMessage("Inquiry sent. The school can review it from Tengacion.");
      toast.success("Inquiry sent");
    } catch (err) {
      const message = err?.details?.[0] || err?.message || "Could not submit inquiry.";
      setSubmitMessage(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  if (error || !school) {
    return <NotFoundState slug={slug} />;
  }

  return (
    <main className="school-profile-page" style={theme}>
      <SeoHead
        title={`${school.schoolName} | Tengacion School Profile`}
        description={seoDescription}
        canonical={canonicalPath}
        robots="index,follow"
        ogType="website"
        ogImage={ogImage}
        ogImageAlt={`${school.schoolName} school preview`}
        twitterImage={ogImage}
        structuredData={structuredData}
      />

      <section className="school-profile-hero">
        <img className="school-profile-hero__image" src={coverImage} alt="" loading="eager" />
        <div className="school-profile-hero__shade" />
        <nav className="school-profile-nav" aria-label="School profile navigation">
          <Link className="school-profile-brand" to="/">
            <img src="/tengacion_logo_128.png" alt="" />
            <span>Tengacion</span>
          </Link>
          <div className="school-profile-nav__links">
            <a href="#about-school">About</a>
            <a href="#admission">Admission</a>
            <a href="#announcements">Updates</a>
            <a href="#contact">Contact</a>
          </div>
        </nav>

        <div className="school-profile-hero__content">
          <SchoolLogo school={school} />
          <p className="school-profile-eyebrow">{school.schoolCategory || "School profile"}</p>
          <h1>{school.schoolName}</h1>
          <p className="school-profile-hero__motto">
            {school.motto || "Learning, character, creativity, and future-ready confidence."}
          </p>
          <div className="school-profile-hero__actions">
            <ActionLink href="#admission" variant="primary">Apply for Admission</ActionLink>
            <ActionLink onClick={scrollToInquiry}>Send Inquiry</ActionLink>
            <ActionLink href={phoneHref || emailHref}>Contact School</ActionLink>
            <ActionLink onClick={shareSchool} variant="ghost">Share</ActionLink>
          </div>
          <div className="school-profile-hero__meta">
            {school.foundingYear ? <span>Founded {school.foundingYear}</span> : null}
            {school.address ? <span>{school.address}</span> : null}
            {admission.status ? <span>{admission.status}</span> : null}
          </div>
        </div>
      </section>

      {stats.length ? (
        <section className="school-profile-stats" aria-label="School statistics">
          {stats.map((stat) => (
            <article key={stat.label}>
              <strong>{Number(stat.value).toLocaleString()}</strong>
              <span>{stat.label}</span>
            </article>
          ))}
        </section>
      ) : null}

      <Section id="about-school" eyebrow="About the school" title="A focused place for learning, values, and creativity">
        <div className="school-profile-about-grid">
          <div className="school-profile-copy-block">
            <p>
              {school.about ||
                `${school.schoolName} presents its academic identity, school life, admission information, and contact details through Tengacion.`}
            </p>
            <div className="school-profile-mini-grid">
              <article>
                <span>Mission</span>
                <p>{school.mission || "To help learners build knowledge, character, discipline, and confidence."}</p>
              </article>
              <article>
                <span>Vision</span>
                <p>{school.vision || "To raise prepared, creative, responsible learners ready for the future."}</p>
              </article>
            </div>
          </div>
          <aside className="school-profile-facts">
            <dl>
              <div>
                <dt>Category</dt>
                <dd>{school.schoolCategory || "Nursery, Primary and Secondary"}</dd>
              </div>
              <div>
                <dt>Founded</dt>
                <dd>{school.foundingYear || "Available on request"}</dd>
              </div>
              <div>
                <dt>Office hours</dt>
                <dd>{school.officeHours || "School office hours available by inquiry"}</dd>
              </div>
            </dl>
            {(values.length ? values : ["Discipline", "Creativity", "Excellence", "Growth"]).map((value) => (
              <span key={value}>{value}</span>
            ))}
          </aside>
        </div>

        {highlights.length ? (
          <div className="school-profile-card-grid school-profile-card-grid--four">
            {highlights.map((entry) => (
              <article key={entry.label} className="school-profile-card">
                <strong>{entry.label}</strong>
                <p>{entry.description}</p>
              </article>
            ))}
          </div>
        ) : null}
      </Section>

      <Section eyebrow="Principal message" title="A word from school leadership" className="school-profile-section--dark">
        <div className="school-profile-principal">
          <div className="school-profile-principal__photo">
            {school.principalPhotoUrl ? (
              <img src={resolveImage(school.principalPhotoUrl)} alt="" loading="lazy" />
            ) : (
              <span>{getInitials(school.principalName || school.schoolName)}</span>
            )}
          </div>
          <div>
            <p>
              {school.principalMessage ||
                "We welcome every family into a school community committed to careful learning, moral formation, creativity, and the confidence each child needs to thrive."}
            </p>
            <strong>{school.principalName || "School Principal"}</strong>
            <span>{school.principalTitle || "Principal / Proprietor"}</span>
          </div>
        </div>
      </Section>

      <Section id="admission" eyebrow="Admission information" title="Admission details for interested families">
        <div className="school-profile-admission">
          <article className="school-profile-admission__main">
            <span>{admission.status || "Admission inquiry open"}</span>
            <h3>Start an admission conversation</h3>
            <p>
              {admission.feesNote ||
                "Fees, class availability, and admission timelines are confirmed directly by the school."}
            </p>
            <ActionLink onClick={scrollToInquiry} variant="primary">Start Admission Inquiry</ActionLink>
          </article>
          <div className="school-profile-list-columns">
            <div>
              <h3>Requirements</h3>
              <ul>
                {(normalizeList(admission.requirements).length
                  ? admission.requirements
                  : ["Birth certificate or age record", "Previous school records where applicable", "Parent or guardian contact details"]).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Available classes</h3>
              <ul>
                {(normalizeList(admission.availableClasses).length
                  ? admission.availableClasses
                  : ["Nursery", "Primary", "Junior Secondary", "Senior Secondary"]).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Procedure</h3>
              <ul>
                {(normalizeList(admission.procedure).length
                  ? admission.procedure
                  : ["Send inquiry", "School contacts parent", "Visit or assessment", "Admission decision"]).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      <Section id="announcements" eyebrow="Announcements" title="School updates and important notices">
        {announcements.length ? (
          <div className="school-profile-card-grid school-profile-card-grid--three">
            {announcements.map((announcement) => (
              <article key={`${announcement.title}-${announcement.date}`} className="school-profile-announcement">
                {announcement.imageUrl ? (
                  <img src={resolveImage(announcement.imageUrl)} alt="" loading="lazy" />
                ) : null}
                <div>
                  <span>{formatDate(announcement.date)}</span>
                  <h3>{announcement.title}</h3>
                  <p>{announcement.description}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="school-profile-empty">
            <strong>No public announcements right now</strong>
            <p>Resumption dates, exam notices, PTA meetings, and events will appear here when published.</p>
          </div>
        )}
      </Section>

      <Section eyebrow="Staff and departments" title="People and departments supporting each learner">
        <div className="school-profile-card-grid school-profile-card-grid--three">
          {departments.map((member) => (
            <article key={`${member.name || member.department}-${member.role || member.description}`} className="school-profile-staff-card">
              <div className="school-profile-staff-card__photo">
                {member.photoUrl ? (
                  <img src={resolveImage(member.photoUrl)} alt="" loading="lazy" />
                ) : (
                  <span>{getInitials(member.name || member.department)}</span>
                )}
              </div>
              <div>
                <span>{member.department || "Department"}</span>
                <h3>{member.name || member.department}</h3>
                {member.role ? <strong>{member.role}</strong> : null}
                <p>{member.description}</p>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section eyebrow="Facilities" title="Spaces that support practical learning">
        <div className="school-profile-card-grid school-profile-card-grid--three">
          {facilities.map((facility) => (
            <article key={facility.title} className="school-profile-facility-card">
              {facility.imageUrl ? <img src={resolveImage(facility.imageUrl)} alt="" loading="lazy" /> : null}
              <div>
                <h3>{facility.title}</h3>
                <p>{facility.description}</p>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section eyebrow="Why choose us?" title="A school experience built around trust and growth">
        <div className="school-profile-card-grid school-profile-card-grid--four">
          {whyChooseUs.map((entry) => (
            <article key={entry.label} className="school-profile-card">
              <strong>{entry.label}</strong>
              <p>{entry.description}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section eyebrow="Gallery" title="Campus, activities, and school life">
        <div className="school-profile-gallery">
          {(galleryImages.length ? galleryImages : [{ url: FALLBACK_COVER, caption: school.schoolName }]).map((image, index) => (
            <figure key={`${image.url}-${index}`}>
              <img
                src={resolveImage(image.url)}
                alt={image.alt || image.caption || `${school.schoolName} gallery image`}
                loading="lazy"
              />
              {image.caption ? <figcaption>{image.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      </Section>

      {testimonials.length ? (
        <Section eyebrow="Testimonials" title="What families say">
          <div className="school-profile-card-grid school-profile-card-grid--three">
            {testimonials.map((testimonial) => (
              <article key={`${testimonial.name}-${testimonial.quote}`} className="school-profile-testimonial">
                <p>{testimonial.quote}</p>
                <strong>{testimonial.name}</strong>
                <span>{testimonial.role}</span>
              </article>
            ))}
          </div>
        </Section>
      ) : null}

      <Section id="contact" eyebrow="Contact details" title="Reach the school directly">
        <div className="school-profile-contact-grid">
          <div className="school-profile-contact-panel">
            <h3>{school.schoolName}</h3>
            <address>{school.address || "School address available by inquiry."}</address>
            <div className="school-profile-contact-actions">
              <ActionLink href={phoneHref} variant="primary">Call</ActionLink>
              <ActionLink href={emailHref}>Email</ActionLink>
              <ActionLink href={whatsAppHref}>WhatsApp</ActionLink>
            </div>
            <dl>
              <div>
                <dt>Phone</dt>
                <dd>{school.contactPhone || "Available by inquiry"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{school.contactEmail || "Available by inquiry"}</dd>
              </div>
              <div>
                <dt>Office hours</dt>
                <dd>{school.officeHours || "Available by inquiry"}</dd>
              </div>
            </dl>
            <div className="school-profile-map">
              <strong>Location</strong>
              <p>{school.address || "Map details will appear when the school publishes an address."}</p>
              <ActionLink href={school.directionsUrl || school.mapUrl} variant="ghost">Get Directions</ActionLink>
            </div>
          </div>

          <form id="school-inquiry" className="school-profile-inquiry" onSubmit={handleSubmit}>
            <h3>Send Inquiry</h3>
            <label>
              <span>Parent/guardian name</span>
              <input value={form.parentName} onChange={updateField("parentName")} required />
            </label>
            <label>
              <span>Phone number</span>
              <input value={form.phoneNumber} onChange={updateField("phoneNumber")} required />
            </label>
            <label>
              <span>Email</span>
              <input type="email" value={form.email} onChange={updateField("email")} required />
            </label>
            <label>
              <span>Child class of interest</span>
              <input value={form.childClassInterest} onChange={updateField("childClassInterest")} required />
            </label>
            <label className="school-profile-inquiry__full">
              <span>Message</span>
              <textarea rows={5} value={form.message} onChange={updateField("message")} required />
            </label>
            <button className="school-profile-btn school-profile-btn--primary" type="submit" disabled={submitting}>
              {submitting ? "Sending..." : "Send Inquiry"}
            </button>
            {submitMessage ? <p className="school-profile-form-note">{submitMessage}</p> : null}
          </form>
        </div>
      </Section>

      <div className="school-profile-floating-actions" aria-label="Quick school contact">
        {whatsAppHref ? <a href={whatsAppHref}>WhatsApp</a> : null}
        {phoneHref ? <a href={phoneHref}>Call</a> : null}
      </div>
    </main>
  );
}
