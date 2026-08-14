import { useState } from "react";
import { Link } from "react-router-dom";
import SeoHead from "../../components/seo/SeoHead";
import { joinTengaHarvestPilot, submitTengaHarvestService } from "./tengaHarvestApi";
import "./tengaharvest.css";

export default function TengaHarvestProviderPage() {
  const [participantId, setParticipantId] = useState("");
  const [message, setMessage] = useState("");
  const [provider, setProvider] = useState({ fullName: "", phone: "", email: "", organizationName: "", lga: "", community: "" });
  const [service, setService] = useState({ providerName: "", type: "solar_irrigation", title: "", description: "", lga: "", community: "", capacity: "", capacityUnit: "hectares_per_day", pricePerUnitNgn: "", priceUnitLabel: "per hectare/day", renewableEnergy: true });
  const update = (setter) => (event) => setter((current) => ({ ...current, [event.target.name]: event.target.value }));

  const registerProvider = async (event) => {
    event.preventDefault(); setMessage("Registering provider…");
    try {
      const result = await joinTengaHarvestPilot({ ...provider, role: "provider", state: "Kaduna", serviceInterests: ["solar_irrigation", "cold_storage"] });
      setParticipantId(result.participant.id);
      setService((current) => ({ ...current, providerName: provider.organizationName || provider.fullName, lga: provider.lga, community: provider.community }));
      setMessage("Provider profile received. You can now submit infrastructure for verification.");
    } catch (error) { setMessage(error.message); }
  };

  const submitService = async (event) => {
    event.preventDefault(); setMessage("Submitting service…");
    try {
      const result = await submitTengaHarvestService({ ...service, participantId, state: "Kaduna", capacity: Number(service.capacity || 0), pricePerUnitNgn: Number(service.pricePerUnitNgn || 0) });
      setMessage(result.message);
    } catch (error) { setMessage(error.message); }
  };

  return <div className="th-page th-portal">
    <SeoHead title="Provider Pilot | TengaHarvest" description="Join TengaHarvest as a verified solar irrigation or renewable cold-chain provider in Kaduna." />
    <header className="th-nav"><Link className="th-brand" to="/tengaharvest"><span>TH</span><div><strong>TengaHarvest</strong><small>Provider pilot</small></div></Link><Link to="/tengaharvest">Back to overview</Link></header>
    <main className="th-portal-main">
      <section className="th-portal-intro"><span className="th-kicker">Infrastructure partner onboarding</span><h1>Put clean farm infrastructure to work.</h1><p>List solar pumps or renewable cold-storage capacity. Listings stay private until the TengaHarvest pilot team verifies them.</p>{message ? <div className="th-notice">{message}</div> : null}</section>
      <div className="th-form-grid">
        <form className="th-form-card" onSubmit={registerProvider}><h2>1. Register provider</h2><label>Contact name<input name="fullName" value={provider.fullName} onChange={update(setProvider)} required /></label><label>Phone<input name="phone" value={provider.phone} onChange={update(setProvider)} required /></label><label>Email<input type="email" name="email" value={provider.email} onChange={update(setProvider)} /></label><label>Business / organization<input name="organizationName" value={provider.organizationName} onChange={update(setProvider)} /></label><label>LGA<input name="lga" value={provider.lga} onChange={update(setProvider)} required /></label><label>Community<input name="community" value={provider.community} onChange={update(setProvider)} /></label><button className="th-btn th-full" type="submit">Register provider</button></form>
        <form className="th-form-card" onSubmit={submitService}><h2>2. Submit infrastructure</h2>{!participantId ? <div className="th-empty th-full"><strong>Register the provider first.</strong><p>This links every service to a real pilot participant.</p></div> : <><label>Service type<select name="type" value={service.type} onChange={(event) => { const type = event.target.value; setService((current) => ({ ...current, type, capacityUnit: type === "cold_storage" ? "crates" : "hectares_per_day", priceUnitLabel: type === "cold_storage" ? "per crate/day" : "per hectare/day" })); }}><option value="solar_irrigation">Solar irrigation</option><option value="cold_storage">Solar cold storage</option></select></label><label>Listing title<input name="title" value={service.title} onChange={update(setService)} required placeholder="e.g. 3HP solar irrigation service" /></label><label>LGA<input name="lga" value={service.lga} onChange={update(setService)} required /></label><label>Community<input name="community" value={service.community} onChange={update(setService)} /></label><label>Capacity<input type="number" min="0" step="0.1" name="capacity" value={service.capacity} onChange={update(setService)} /></label><label>Price (NGN)<input type="number" min="0" name="pricePerUnitNgn" value={service.pricePerUnitNgn} onChange={update(setService)} /></label><label className="th-full">Description<textarea name="description" value={service.description} onChange={update(setService)} placeholder="Equipment, operating hours, water/cooling capacity and service area" /></label><button className="th-btn th-full" type="submit">Submit for verification</button></>}</form>
      </div>
    </main>
  </div>;
}
