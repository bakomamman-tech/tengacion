import { Link } from "react-router-dom";
import developerPortrait from "../assets/developer-contact-photo.jpg";
import SeoHead from "../components/seo/SeoHead";
import { CONTACT_EMAIL, buildMailto } from "../config/businessContact";

const developerDetails = [
  {
    label: "Support lead",
    value: "Stephen Daniel Kurah",
  },
  {
    label: "Office Address",
    value: "No. 36 Patrick Yakowa Street Narayi, Kaduna State Nigeria West Africa.",
  },
  {
    label: "Phone Number",
    value: "+2348061201090",
    href: "tel:+2348061201090",
  },
  {
    label: "Email",
    value: CONTACT_EMAIL,
    href: buildMailto(CONTACT_EMAIL, "Tengacion support request"),
  },
];

export default function DeveloperContactPage() {
  return (
    <div className="login-container developer-contact-page">
      <SeoHead
        title="Tengacion Support Contact | Tengacion"
        description="Find Tengacion support contact information and assistance details."
        canonical="/developer-contact"
        ogImage={developerPortrait}
        ogImageAlt="Stephen Daniel Kurah portrait"
      />
      <div className="developer-contact-shell">
        <div className="developer-contact-hero">
          <div className="developer-contact-portrait-shell">
            <div className="developer-contact-portrait-card">
              <div className="developer-contact-portrait-veil" aria-hidden="true" />
              <div className="developer-contact-portrait-frame">
                <img
                  src={developerPortrait}
                alt="Stephen Daniel Kurah portrait"
                className="developer-contact-portrait"
                />
              </div>
              <div className="developer-contact-portrait-copy">
                <span className="developer-contact-portrait-label">Tengacion support</span>
                <strong>Stephen Daniel Kurah</strong>
                <p>Support contact for Tengacion.</p>
              </div>
            </div>
          </div>

          <div className="developer-contact-hero-copy">
            <span className="developer-contact-badge">Tengacion Support</span>
            <h1>Contact Tengacion Support</h1>
            <p>
              Use the details below for Tengacion support, account help, public reports, and
              platform questions.
            </p>
          </div>
        </div>

        <div className="developer-contact-card">
          {developerDetails.map((item) => (
            <div key={item.label} className="developer-contact-item">
              <span className="developer-contact-label">{item.label}</span>
              {item.href ? (
                <a href={item.href} className="developer-contact-value developer-contact-link">
                  {item.value}
                </a>
              ) : (
                <p className="developer-contact-value">{item.value}</p>
              )}
            </div>
          ))}

          <div className="developer-contact-actions">
            <Link to="/login" className="developer-contact-back">
              Back to welcome page
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
