import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, API_BASE } from '../api';
import { parseEventAdmissionCode } from '../utils/eventAdmissionCode';
import '../styles/noBadVibesCheckIn.css';

// This screen is restricted in App.jsx to admin/super_admin.
// The API enforces the same role before any admission is redeemed.
export default function NoBadVibesCheckInPage() {
  const [input, setInput] = useState('');
  const [checked, setChecked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState({ type: 'idle', message: '' });
  const [admitted, setAdmitted] = useState(0);
  const fieldRef = useRef(null);

  const reset = () => {
    setInput('');
    setChecked(null);
    setFeedback({ type: 'idle', message: '' });
    fieldRef.current?.focus();
  };

  const check = async (event) => {
    event.preventDefault();
    const code = parseEventAdmissionCode(input);
    setChecked(null);
    if (!code) {
      setFeedback({ type: 'invalid', message: 'Invalid QR or admission code format. Scan the guest QR or enter its full code.' });
      return;
    }
    setBusy(true);
    try {
      const result = await apiRequest(`${API_BASE}/event-tickets/status/${code}`);
      if (result.valid && !result.used) {
        setChecked({ code, tier: result.tier || 'Event ticket' });
        setFeedback({ type: 'ready', message: 'LIVE TICKET VERIFIED. Confirm admission to check this guest in.' });
      } else {
        setFeedback({ type: 'invalid', message: result.used
          ? 'ALREADY USED — this guest was previously checked in. Do not admit again.'
          : 'INVALID FOR ADMISSION — test, unknown, or inactive ticket. Do not admit.' });
      }
    } catch (error) {
      setFeedback({ type: 'error', message: error?.message || 'Verification failed. Do not admit until the connection is restored.' });
    } finally {
      setBusy(false);
    }
  };

  const redeem = async () => {
    if (!checked || busy) return;
    setBusy(true);
    const code = checked.code;
    setChecked(null); // Never permit a second accidental click.
    try {
      const result = await apiRequest(`${API_BASE}/event-tickets/redeem/${code}`, { method: 'POST' });
      if (result.admitted) {
        setAdmitted(count => count + 1);
        setFeedback({ type: 'admitted',
          message: `ADMITTED — ${result.tier || 'Guest'} (${result.admittedCount}/${result.capacity} guest admissions on this ticket).` });
      } else {
        setFeedback({ type: 'invalid', message: 'Admission not permitted. Do not admit.' });
      }
    } catch (error) {
      // If two gate devices submit simultaneously, the server allows only one.
      setFeedback({ type: 'invalid', message: error?.message || 'Code rejected or already used. Do not admit.' });
    } finally {
      setBusy(false);
    }
  };

  return <main className="nbv-gate">
    <header className="nbv-gate-header">
      <div><span className="nbv-gate-kicker">JAGA HOUSE OF MUSIC · AUTHORIZED STAFF</span>
        <h1>No Bad Vibes — Gate Check-in</h1>
        <p>18 December 2026 · 7eleven, Kaduna</p></div>
      <Link to="/events/no-bad-vibes">Event page</Link>
    </header>
    <section className="nbv-gate-panel" aria-label="Check guest admission">
      <div className="nbv-gate-count">Guests admitted on this device: <strong>{admitted}</strong></div>
      <p>Use a handheld QR scanner that types into this field, or paste the QR URL or guest code. Each table guest has a separate one-time code.</p>
      <form onSubmit={check}>
        <label htmlFor="nbv-gate-code">Guest QR or admission code</label>
        <input id="nbv-gate-code" ref={fieldRef} value={input} autoComplete="off" spellCheck="false"
          placeholder="Paste scanned QR URL or 48-character code" autoFocus
          onChange={event => { setInput(event.target.value); setChecked(null); setFeedback({ type: 'idle', message: '' }); }} />
        <button type="submit" disabled={busy || !input.trim()}>{busy ? 'Checking…' : 'Verify admission code'}</button>
      </form>
      {feedback.message && <div className={`nbv-gate-feedback nbv-gate-${feedback.type}`} role="status" aria-live="polite">
        <strong>{feedback.message}</strong>
        {checked && <p>Category: {checked.tier}</p>}
      </div>}
      {checked && <button type="button" className="nbv-gate-admit" disabled={busy} onClick={redeem}>
        Confirm and admit this guest
      </button>}
      <button type="button" className="nbv-gate-next" disabled={busy} onClick={reset}>Clear for next guest</button>
    </section>
    <p className="nbv-gate-warning">Test-mode tickets are never valid for admission. Do not admit guests during network errors, and never use a screenshot alone as proof of payment. This tool requires an online connection.</p>
  </main>;
}
