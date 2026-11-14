import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { apiRequest, API_BASE } from '../api';
import { getSessionAccessToken } from '../authSession';
import { clearEventPaymentReference, getEventPaymentReference } from '../utils/eventPaymentCallback';
import { useAuth } from '../context/AuthContext';
import '../styles/noBadVibes.css';

const CATEGORIES = [
  { id: 'regular', label: 'Regular', kicker: 'DRINK & VIBE', price: 3000, detail: 'General entry · 1,000 Regular tickets allocated', seats: '1 admission', tone: 'turquoise' },
  { id: 'vip', label: 'VIP', kicker: 'ELEVATED ACCESS', price: 10000, detail: 'Individual VIP ticket', seats: '1 admission', tone: 'blue' },
  { id: 'table6', label: 'Table for 6', kicker: 'YOUR INNER CIRCLE', price: 100000, detail: 'Bring six people together', seats: '6 guests', tone: 'violet' },
  { id: 'table8', label: 'Table for 8', kicker: 'THE BIGGER CREW', price: 200000, detail: 'Share the night with eight people', seats: '8 guests', tone: 'coral' },
  { id: 'exclusive', label: 'No Bad Vibes Table', kicker: 'THE SIGNATURE EXPERIENCE', price: 500000, detail: 'Premium table with ten individual admissions', seats: '10 guests', tone: 'gold' },
];
const fmt = (value) => `₦${Number(value).toLocaleString('en-NG')}`;
const messageFor = (err) => String(err?.message || 'Something went wrong. Please try again.');
const RETURN_TO = '/events/no-bad-vibes';

export default function NoBadVibesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [eventConfig, setEventConfig] = useState(null);
  const [selected, setSelected] = useState('vip');
  const [view, setView] = useState(() => searchParams.get('view') === 'mine' ? 'mine' : 'explore');
  const [tickets, setTickets] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [qrCodes, setQrCodes] = useState({});
  const [photos, setPhotos] = useState({});
  const [photoConsent, setPhotoConsent] = useState({});
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    apiRequest(`${API_BASE}/event-tickets/config`, { suppressAuthFailure: true })
      .then(setEventConfig).catch(() => setMessage('Ticket availability could not be loaded.'));
  }, []);

  const loadTickets = useCallback(async () => {
    if (!user) { setTickets([]); return; }
    try {
      const data = await apiRequest(`${API_BASE}/event-tickets/mine`);
      setTickets(data.tickets || []);
    } catch (err) { setMessage(messageFor(err)); }
  }, [user]);

  useEffect(() => { if (!authLoading && user) loadTickets(); }, [authLoading, user, loadTickets]);

  useEffect(() => {
    const reference = getEventPaymentReference(searchParams);
    if (!user || !reference) return;
    let active = true;
    setView('mine');
    document.getElementById('nbv-tickets')?.scrollIntoView({ behavior: 'smooth' });
    setMessage('Confirming your payment with Paystack…');
    apiRequest(`${API_BASE}/event-tickets/verify/${encodeURIComponent(reference)}`)
      .then(async (data) => {
        if (!active) return;
        setMessage(data.verified ? 'Payment verified. Each guest has their own QR admission code.' : (data.message || 'Payment is not confirmed. You can return to this page to check again.'));
        if (data.verified) {
          await loadTickets();
          // Clear only confirmed references; retain unconfirmed/failed callbacks
          // so a reload can retry verification without another payment.
          setSearchParams(clearEventPaymentReference(searchParams), { replace: true });
        }
      })
      .catch(err => { if (active) setMessage(messageFor(err)); });
    return () => { active = false; };
  }, [user, searchParams, setSearchParams, loadTickets]);

  useEffect(() => {
    let mounted = true;
    const makeCodes = async () => {
      const next = {};
      for (const ticket of tickets) {
        for (const admission of ticket.admissions || []) {
          if (!admission.code) continue;
          try {
            const url = `${window.location.origin}/api/event-tickets/status/${admission.code}`;
            next[`${ticket.id}:${admission.number}`] = await QRCode.toDataURL(url, { width: 180, margin: 1 });
          } catch { /* A guest code can still be displayed without a QR image. */ }
        }
      }
      if (mounted) setQrCodes(next);
    };
    makeCodes();
    return () => { mounted = false; };
  }, [tickets]);

  const checkout = async () => {
    if (!user) { navigate(`/login?returnTo=${encodeURIComponent(RETURN_TO)}`); return; }
    if (!acknowledged) { setMessage('Please acknowledge the account and payment notice.'); return; }
    if (!eventConfig?.enabled) { setMessage('Official online sales are not open yet.'); return; }
    if (!eventConfig?.tiers?.find(t => t.id === selected)?.inventoryConfirmed) { setMessage('This category has no confirmed stock and is not available for checkout.'); return; }
    const remaining = eventConfig.tiers?.find(t => t.id === selected)?.available;
    if (!Number.isInteger(remaining) || remaining < 1) {
      setMessage('This category is sold out or unavailable.'); return;
    }
    setBusy(true); setMessage('');
    try {
      const data = await apiRequest(`${API_BASE}/event-tickets/checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: selected }),
      });
      if (!String(data.authorizationUrl).startsWith('https://checkout.paystack.com/')) throw new Error('Invalid checkout address.');
      window.location.assign(data.authorizationUrl);
    } catch (err) { setMessage(messageFor(err)); setBusy(false); }
  };

  const uploadPhoto = async (ticketId) => {
    if (!photoConsent[ticketId]) { setMessage('Please consent to storing the attendee photo first.'); return; }
    const photo = photos[ticketId];
    if (!photo || !['image/png', 'image/jpeg'].includes(photo.type) || photo.size > 3 * 1024 * 1024) {
      setMessage('Select a JPG/PNG photo under 3 MB.'); return;
    }
    setBusy(true); setMessage('');
    try {
      const form = new FormData(); form.set('photo', photo); form.set('photoConsent', 'true');
      const response = await fetch(`${API_BASE}/event-tickets/${ticketId}/photo`, {
        method: 'POST', headers: { Authorization: `Bearer ${getSessionAccessToken()}` }, body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed.');
      setMessage('Your photo has been attached to your ticket.');
      await loadTickets();
    } catch (err) { setMessage(messageFor(err)); } finally { setBusy(false); }
  };

  const selectedCategory = CATEGORIES.find(c => c.id === selected) || CATEGORIES[1];
  const selectedAvailability = eventConfig?.tiers?.find(t => t.id === selected)?.available;
  return <main className="nbv-root">
    <div className="nbv-banner">✦ JAGA HOUSE OF MUSIC PRESENTS <span>✦ FRIDAY 18 DECEMBER 2026</span></div>
    <header className="nbv-header"><Link to={RETURN_TO} className="nbv-logo">✦ <span>JAGA<small>HOUSE OF MUSIC</small></span></Link>
      <nav><a href="#nbv-tickets">Get tickets</a><a href="#nbv-about">Event details</a>
        <button onClick={() => { setView('mine'); document.getElementById('nbv-tickets')?.scrollIntoView({ behavior: 'smooth' }); }}>My tickets ↗</button></nav></header>
    <section className="nbv-hero"><div className="nbv-hero-copy"><p className="nbv-kicker">THE DECEMBER EXPERIENCE · KADUNA, NIGERIA</p>
      <h1>NO BAD<br /><em>VIBES.</em><small>ONLY GOOD MEMORIES.</small></h1>
      <p>One city. One stage. Nothing but unforgettable energy. Join MCJagz and friends for a night you won't forget.</p>
      <div className="nbv-actions"><a href="#nbv-tickets" className="nbv-primary">Choose your experience ↗</a><a href="#nbv-about" className="nbv-outline">Event details ↓</a></div>
      <div className="nbv-hero-meta"><div>▦ <b>18 DEC 2026</b><span>Friday</span></div><div>⌖ <b>7eleven</b><span>Kaduna, Nigeria</span></div></div>
      </div><div className="nbv-poster"><div className="nbv-glow"></div><img src="/events/no-bad-vibes/Jagz.jpg" alt="Official Jaga House of Music No Bad Vibes with MCJagz event flyer" /></div></section>
    <div className="nbv-ticker">GOOD MUSIC ✦ GREAT PEOPLE ✦ NO BAD VIBES ✦ KADUNA DECEMBER ✦ GOOD MUSIC ✦ GREAT PEOPLE ✦ NO BAD VIBES ✦</div>
    <section id="nbv-tickets" className="nbv-section"><div className="nbv-section-header"><div><p className="nbv-kicker">02 / SELECT YOUR EXPERIENCE</p><h2>YOUR NIGHT.<br /><em>YOUR WAY.</em></h2></div>
      <div className="nbv-tabs"><button className={view==='explore'?'active':''} onClick={()=>setView('explore')}>Get tickets</button><button className={view==='mine'?'active':''} onClick={()=>setView('mine')}>My tickets{tickets.length ? ` (${tickets.length})` : ''}</button></div></div>
      {message && <div className="nbv-alert" role="status">{message} <button onClick={()=>setMessage('')} aria-label="Dismiss message">×</button></div>}
      {view==='explore' ? <>
        <div className="nbv-cards">{CATEGORIES.map((t,i)=><article key={t.id} className={`nbv-card nbv-${t.tone} ${selected===t.id?'selected':''}`}>
          <div className="nbv-card-head"><span>✦</span><small>0{i+1}</small></div><div className="nbv-card-kicker">{t.kicker}</div><h3>{t.label}</h3><div className="nbv-card-price">{t.price?fmt(t.price):'Price pending'}</div><p>{t.detail}</p><div className="nbv-capacity">{t.seats || 'Capacity unconfirmed'}{eventConfig?.tiers?.find(tier => tier.id === t.id)?.inventoryConfirmed === false ? ' · Stock not confirmed — sales unavailable' : ''}{t.price && eventConfig?.tiers?.find(tier => tier.id === t.id) ? ` · ${eventConfig.tiers.find(tier => tier.id === t.id).available} purchases remaining` : ''}</div><button disabled={!t.price || !eventConfig?.tiers?.find(tier => tier.id === t.id)?.inventoryConfirmed || !Number.isInteger(eventConfig?.tiers?.find(tier => tier.id === t.id)?.available) || eventConfig.tiers.find(tier => tier.id === t.id).available < 1} className="nbv-card-button" onClick={()=>setSelected(t.id)}>{!eventConfig?.tiers?.find(tier => tier.id === t.id)?.inventoryConfirmed ? 'Awaiting stock confirmation' : selected===t.id?'Selected ✓':'Select ticket ↗'}</button></article>)}</div>
        <div className="nbv-checkout"><div><p className="nbv-kicker">YOUR SELECTION</p><h3>{selectedCategory.label} — {fmt(selectedCategory.price)}</h3>
          <p>Each order reserves one purchase slot for 30 minutes. When Paystack verifies payment, one unique QR admission is issued per guest (1, 6, 8, or 10). Tickets are available in your Tengacion account for viewing and printing.</p>
          <label className="nbv-consent"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)} /><span>I understand that buying tickets requires a Tengacion account and that my account details are used to issue and retrieve my ticket. Attendee photos are optional and require separate consent.</span></label></div>
          <div className="nbv-checkout-action">{user?<span>Signed in as {user.email}</span>:<><span>Already have an account? <Link to={`/login?returnTo=${encodeURIComponent(RETURN_TO)}`}>Sign in</Link></span><Link to={`/register?returnTo=${encodeURIComponent(RETURN_TO)}`}>Register & upload a profile photo</Link></>}
            <button className="nbv-primary" type="button" disabled={busy||authLoading||!eventConfig?.enabled||!eventConfig?.tiers?.find(t => t.id === selected)?.inventoryConfirmed||!Number.isInteger(selectedAvailability)||selectedAvailability<1} onClick={checkout}>{busy?'Connecting…':eventConfig?.enabled?'Continue to secure payment ↗':'Sales opening soon'}</button>
            <small>Paystack secure checkout · NGN · Ticket only issued after verification</small></div>
        </div></> : <div className="nbv-my-tickets">{!user?<div className="nbv-empty"><h3>Welcome back to the vibe.</h3><p>Sign in with your Tengacion email and password to access purchased tickets.</p><Link className="nbv-primary" to={`/login?returnTo=${encodeURIComponent(RETURN_TO)}`}>Sign in to view tickets ↗</Link></div>:
          tickets.length===0?<div className="nbv-empty"><h3>No confirmed tickets yet.</h3><p>After a successful, verified payment, your tickets will appear here.</p><button onClick={()=>setView('explore')}>Explore tickets ↗</button></div>:<div className="nbv-owned-grid">{tickets.map(t=><article key={t.id} className="nbv-owned"><div className="nbv-owned-upper"><span>JAGA HOUSE OF MUSIC</span><b>{t.testMode?'TEST · NOT VALID':'OFFICIAL DIGITAL TICKET'}</b></div>
            <h3>NO BAD VIBES<br /><em>{t.label}</em></h3><p>18 DEC 2026 · 7ELEVEN KADUNA</p><p>Attendee: <strong>{t.attendeeName}</strong></p>
            {t.attendeePhoto&&<img className="nbv-attendee-photo" src={t.attendeePhoto} alt="Attendee-provided portrait" />}
            <p>Guest admissions: {t.admissions?.length || 0} / {t.seats || 1}. Share each guest's unique code privately; each QR can be used once.</p>
            <div className="nbv-guest-codes">{(t.admissions || []).map(a=><div className="nbv-qr" key={a.number}>
              {qrCodes[`${t.id}:${a.number}`]&&<img src={qrCodes[`${t.id}:${a.number}`]} alt={`Guest ${a.number} admission QR`} />}
              <small>Guest {a.number}{a.redeemedAt?' · CHECKED IN':' · NOT USED'}</small>
              <code>{a.code}</code>
            </div>)}</div>
            <small className="nbv-ticket-id">TICKET ID: {t.id}</small>{t.admissions?.every(a=>a.redeemedAt)&&<p>All guests have checked in.</p>}
            <div className="nbv-print"><button onClick={()=>window.print()}>Print / save as PDF ↗</button></div>
            {!t.attendeePhoto&&<div className="nbv-photo-input"><label>Optional ticket photo (JPG/PNG · max 3 MB)<input type="file" accept="image/jpeg,image/png" onChange={e=>setPhotos(curr=>({...curr,[t.id]:e.target.files?.[0]}))} /></label><label><input type="checkbox" checked={Boolean(photoConsent[t.id])} onChange={e=>setPhotoConsent(curr=>({...curr,[t.id]:e.target.checked}))} /> I consent to my photo being stored for this ticket.</label><button disabled={busy} onClick={()=>uploadPhoto(t.id)}>Attach photo</button></div>}
          </article>)}</div>}</div>}
    </section>
    <section id="nbv-about" className="nbv-details"><div><p className="nbv-kicker">03 / THE DETAILS</p><h2>DECEMBER<br /><em>IS CALLING.</em></h2></div><dl><div><dt>EVENT</dt><dd>No Bad Vibes with MCJagz</dd></div><div><dt>WHEN</dt><dd>Friday, 18 December 2026</dd></div><div><dt>WHERE</dt><dd>7eleven, Sabo, Unguwan Boro, Kaduna, Nigeria</dd></div><div><dt>CONTACT</dt><dd>08107838864 · 09115130069</dd></div></dl></section>
    <footer className="nbv-footer"><span>JAGA HOUSE OF MUSIC ✦</span><span>Ticketing powered by Tengacion Technologies Limited</span></footer>
  </main>;
}
