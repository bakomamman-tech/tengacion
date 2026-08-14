import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SeoHead from "../../components/seo/SeoHead";
import { createTengaHarvestBooking, getTengaHarvestServices, joinTengaHarvestPilot } from "./tengaHarvestApi";
import "./tengaharvest.css";

export default function TengaHarvestFarmerPage() {
  const [params] = useSearchParams();
  const [services, setServices] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", lga: "", community: "", farmSizeHectares: "", crops: "", serviceInterests: ["solar_irrigation"] });
  const [booking, setBooking] = useState({ serviceId: params.get("service") || "", customerName: "", phone: "", email: "", units: 1, startDate: "", notes: "" });

  useEffect(() => { getTengaHarvestServices({ state: "Kaduna" }).then((data) => setServices(data.services || [])).catch(() => {}); }, []);
  const update = (setter) => (event) => setter((current) => ({ ...current, [event.target.name]: event.target.value }));

  const join = async (event) => {
    event.preventDefault(); setMessage("Submitting…");
    try {
      await joinTengaHarvestPilot({ ...form, role: "farmer", state: "Kaduna", farmSizeHectares: Number(form.farmSizeHectares || 0), crops: form.crops.split(",").map((v) => v.trim()).filter(Boolean) });
      setMessage("Your farm has been added to the Kaduna pilot demand list. Our team can now match your needs with verified providers.");
    } catch (error) { setMessage(error.message); }
  };

  const requestBooking = async (event) => {
    event.preventDefault(); setMessage("Submitting booking request…");
    try {
      const result = await createTengaHarvestBooking({ ...booking, units: Number(booking.units) });
      setMessage(`${result.message} Reference: ${result.booking.reference}`);
    } catch (error) { setMessage(error.message); }
  };

  return <div className="th-page th-portal">
    <SeoHead title="Farmer Pilot | TengaHarvest" description="Register farm demand and request verified climate-smart agriculture services in the TengaHarvest Kaduna pilot." />
    <header className="th-nav"><Link className="th-brand" to="/tengaharvest"><span>TH</span><div><strong>TengaHarvest</strong><small>Farmer pilot</small></div></Link><Link to="/tengaharvest">Back to overview</Link></header>
    <main className="th-portal-main">
      <section className="th-portal-intro"><span className="th-kicker">Kaduna farmer pilot</span><h1>Tell us what your farm needs.</h1><p>Register demand first. TengaHarvest will only match you with services that have passed provider verification.</p>{message ? <div className="th-notice">{message}</div> : null}</section>
      <div className="th-form-grid">
        <form className="th-form-card" onSubmit={join}><h2>Register your farm</h2>
          <label>Full name<input name="fullName" value={form.fullName} onChange={update(setForm)} required /></label><label>Phone<input name="phone" value={form.phone} onChange={update(setForm)} required /></label><label>Email<input type="email" name="email" value={form.email} onChange={update(setForm)} /></label><label>LGA<input name="lga" value={form.lga} onChange={update(setForm)} required /></label><label>Community<input name="community" value={form.community} onChange={update(setForm)} /></label><label>Farm size (hectares)<input type="number" min="0" step="0.1" name="farmSizeHectares" value={form.farmSizeHectares} onChange={update(setForm)} /></label><label className="th-full">Crops, separated by commas<input name="crops" value={form.crops} onChange={update(setForm)} placeholder="Tomato, maize, pepper" /></label><button className="th-btn th-full" type="submit">Join farmer pilot</button>
        </form>
        <form className="th-form-card" onSubmit={requestBooking}><h2>Request available infrastructure</h2>
          {services.length ? <><label className="th-full">Verified service<select name="serviceId" value={booking.serviceId} onChange={update(setBooking)} required><option value="">Choose a service</option>{services.map((s) => <option key={s._id} value={s._id}>{s.title} — {s.lga || s.state}</option>)}</select></label><label>Name<input name="customerName" value={booking.customerName} onChange={update(setBooking)} required /></label><label>Phone<input name="phone" value={booking.phone} onChange={update(setBooking)} required /></label><label>Units / capacity needed<input type="number" min="0.1" step="0.1" name="units" value={booking.units} onChange={update(setBooking)} required /></label><label>Preferred date<input type="date" name="startDate" value={booking.startDate} onChange={update(setBooking)} required /></label><label className="th-full">Notes<textarea name="notes" value={booking.notes} onChange={update(setBooking)} /></label><button className="th-btn th-full" type="submit">Request booking</button></> : <div className="th-empty th-full"><strong>No verified services are public yet.</strong><p>Register your demand above. We will use farmer demand to recruit the right providers for the pilot.</p></div>}
        </form>
      </div>
    </main>
  </div>;
}
