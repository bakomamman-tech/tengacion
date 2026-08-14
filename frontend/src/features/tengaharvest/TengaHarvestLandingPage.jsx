import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SeoHead from "../../components/seo/SeoHead";
import { getTengaHarvestImpact, getTengaHarvestServices } from "./tengaHarvestApi";
import "./tengaharvest.css";

const serviceLabel = (type) =>
  type === "cold_storage" ? "Solar cold storage" : "Solar irrigation";

export default function TengaHarvestLandingPage() {
  const [services, setServices] = useState([]);
  const [impact, setImpact] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.allSettled([getTengaHarvestServices({ state: "Kaduna" }), getTengaHarvestImpact()])
      .then(([serviceResult, impactResult]) => {
        if (!active) return;
        if (serviceResult.status === "fulfilled") setServices(serviceResult.value.services || []);
        if (impactResult.status === "fulfilled") setImpact(impactResult.value);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const metrics = useMemo(
    () => [
      [impact?.farmers || 0, "Farmers registered"],
      [impact?.providers || 0, "Service providers"],
      [impact?.registeredHectares || 0, "Hectares represented"],
      [impact?.completedBookings || 0, "Completed services"],
    ],
    [impact]
  );

  return (
    <div className="th-page">
      <SeoHead
        title="TengaHarvest | Climate-smart farm infrastructure by Tengacion"
        description="TengaHarvest connects smallholder farmers with shared solar irrigation and renewable-energy cold storage, starting with a Kaduna pilot."
      />
      <header className="th-nav">
        <Link className="th-brand" to="/tengaharvest"><span>TH</span><div><strong>TengaHarvest</strong><small>by Tengacion</small></div></Link>
        <nav><a href="#how">How it works</a><a href="#services">Services</a><a href="#impact">Impact</a></nav>
        <Link className="th-btn th-btn-small" to="/tengaharvest/farmer">Join the Kaduna pilot</Link>
      </header>

      <main>
        <section className="th-hero">
          <div className="th-hero-copy">
            <span className="th-kicker">Climate-smart agriculture infrastructure</span>
            <h1>Clean energy for the farms that feed us.</h1>
            <p>TengaHarvest helps smallholder farmers access solar irrigation and solar-powered cold storage without needing to buy expensive infrastructure outright.</p>
            <div className="th-actions">
              <Link className="th-btn" to="/tengaharvest/farmer">I am a farmer</Link>
              <Link className="th-btn th-btn-ghost" to="/tengaharvest/provider">I provide farm infrastructure</Link>
            </div>
            <div className="th-proof"><strong>Kaduna pilot first.</strong> We are onboarding real farmers and verified service providers before expanding across Nigeria.</div>
          </div>
          <div className="th-hero-card">
            <span className="th-card-tag">What farmers can access</span>
            <article><div className="th-icon">☀</div><div><strong>Solar irrigation</strong><p>Book shared solar pumping capacity by farm need and location.</p></div></article>
            <article><div className="th-icon">❄</div><div><strong>Solar cold storage</strong><p>Reserve cold-room capacity to reduce post-harvest losses.</p></div></article>
            <article><div className="th-icon">◎</div><div><strong>Farmer clusters</strong><p>Coordinate demand so neighbouring farms can share infrastructure costs.</p></div></article>
          </div>
        </section>

        <section className="th-metrics" id="impact">
          {metrics.map(([value, label]) => <div key={label}><strong>{Number(value).toLocaleString()}</strong><span>{label}</span></div>)}
        </section>

        <section className="th-section" id="how">
          <div className="th-section-heading"><span>Simple access</span><h2>From infrastructure need to verified service.</h2></div>
          <div className="th-steps">
            <article><b>01</b><h3>Register your farm</h3><p>Tell us where you farm, your crops, farm size and the services you need.</p></article>
            <article><b>02</b><h3>Match with providers</h3><p>We surface verified solar irrigation and cold-chain capacity in your area.</p></article>
            <article><b>03</b><h3>Request a booking</h3><p>Choose the capacity and service date. TengaHarvest confirms it with the provider.</p></article>
            <article><b>04</b><h3>Build impact evidence</h3><p>Completed service records create measurable operational and climate impact data.</p></article>
          </div>
        </section>

        <section className="th-section th-services" id="services">
          <div className="th-section-heading"><span>Kaduna marketplace</span><h2>Verified infrastructure, not invented listings.</h2><p>Only services approved by the pilot team appear here.</p></div>
          {loading ? <div className="th-empty">Checking available pilot services…</div> : services.length ? (
            <div className="th-service-grid">
              {services.map((service) => (
                <article className="th-service" key={service._id}>
                  <span>{serviceLabel(service.type)}</span>
                  <h3>{service.title}</h3>
                  <p>{service.description || "Verified pilot infrastructure service."}</p>
                  <dl><div><dt>Provider</dt><dd>{service.providerName}</dd></div><div><dt>Location</dt><dd>{[service.community, service.lga, service.state].filter(Boolean).join(", ")}</dd></div><div><dt>Capacity</dt><dd>{service.capacity || "On request"} {service.capacity ? service.capacityUnit.replaceAll("_", " ") : ""}</dd></div></dl>
                  <Link to={`/tengaharvest/farmer?service=${service._id}`}>Request this service →</Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="th-empty"><strong>Provider onboarding is open.</strong><p>The Kaduna marketplace will show services only after provider verification. Farmers can register demand now.</p><div className="th-actions"><Link className="th-btn" to="/tengaharvest/farmer">Register farm demand</Link><Link className="th-btn th-btn-ghost" to="/tengaharvest/provider">List infrastructure</Link></div></div>
          )}
        </section>

        <section className="th-section th-business">
          <div><span className="th-kicker">Built to become sustainable</span><h2>A climate business, not a grant-only project.</h2><p>TengaHarvest is designed to earn through verified service commissions, provider tools, cooperative plans and later enterprise impact dashboards while preserving clear records for funders and partners.</p></div>
          <div className="th-business-card"><strong>Initial focus</strong><ul><li>Solar irrigation as a service</li><li>Solar cold storage as a service</li><li>Kaduna farmer clusters</li><li>Verified bookings and impact records</li></ul></div>
        </section>
      </main>

      <footer className="th-footer"><div><strong>TengaHarvest</strong><span>A climate-smart agriculture product of Tengacion Technologies Limited.</span></div><a href="mailto:stephen@tengacion.com">Partner with the pilot</a></footer>
    </div>
  );
}
