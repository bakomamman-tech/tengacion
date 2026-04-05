import { Link } from "react-router-dom";

const developerDetails = [
  {
    label: "Developer",
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
];

export default function DeveloperContactPage() {
  return (
    <div className="login-container developer-contact-page">
      <div className="developer-contact-shell">
        <div className="developer-contact-hero">
          <span className="developer-contact-badge">Tengacion Support</span>
          <h1>Developer contact details</h1>
          <p>
            Reach the developer directly using the details below. This page is designed to be
            quick to read and easy to access from the welcome screen.
          </p>
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
