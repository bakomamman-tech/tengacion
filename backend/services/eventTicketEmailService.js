// No Bad Vibes ticket delivery after verified Paystack settlement.
// Buyer authentication remains required to view QR images in the application.
// Each buyer email includes their unique per-guest admission codes and a secure login link.
const EventTicket = require('../models/EventTicket');
const { sendBrandedEmail } = require('../utils/sendBrandedEmail');
const { isEmailConfigured } = require('../utils/emailSettings');
const { CATEGORIES } = require('./noBadVibesPolicy');

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const getTicketUrl = () => {
  const configured = String(process.env.PUBLIC_BASE_URL || '').trim();
  // Only permit HTTPS for remote ticket links. Local HTTP is supported in a test preview.
  const origin = /^https:\/\//i.test(configured) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured)
    ? configured.replace(/\/+$/, '')
    : 'https://www.tengacion.com';
  return `${origin}/events/no-bad-vibes?view=mine`;
};

const buildEmail = (ticket) => {
  const guestCodes = Array.isArray(ticket.admissions) ? ticket.admissions : [];
  const label = CATEGORIES[ticket.tier]?.label || 'Event ticket';
  const testBanner = ticket.testMode
    ? '<p style="color:#9f1239;font-weight:bold;">PAYSTACK TEST TICKET — NOT VALID FOR ADMISSION</p>'
    : '';
  const codesHtml = guestCodes.map(({ number, code }) =>
    `<li style="margin-bottom:12px;">Guest ${Number(number)}: <code style="font-family:monospace;overflow-wrap:anywhere;">${escapeHtml(code)}</code></li>`
  ).join('');
  const url = getTicketUrl();
  return {
    subject: `${ticket.testMode ? '[TEST] ' : ''}No Bad Vibes — Your ${label} ticket is confirmed`,
    html: `
      <h2>No Bad Vibes with MCJagz — ticket confirmed</h2>
      ${testBanner}
      <p>Hello ${escapeHtml(ticket.attendeeName)},</p>
      <p>Paystack has confirmed payment for your <strong>${escapeHtml(label)}</strong> ticket.</p>
      <p><strong>When:</strong> Friday, 18 December 2026<br>
      <strong>Venue:</strong> 7eleven, Sabo, Unguwan Boro, Kaduna, Nigeria<br>
      <strong>Paid:</strong> ₦${Number(ticket.amountKobo / 100).toLocaleString('en-NG')}<br>
      <strong>Guest admissions:</strong> ${guestCodes.length}</p>
      <p>Each guest has an individual one-time admission code. Keep these codes private:</p>
      <ol>${codesHtml}</ol>
      <p><a href="${escapeHtml(url)}">Sign in to Tengacion to view, download, or print your individual QR codes</a>.</p>
      <p>Only paid live-mode tickets are valid for admission. Please do not share these codes publicly.</p>
      <p>Order reference: <code>${escapeHtml(ticket.reference)}</code></p>
    `,
  };
};

// A short database lease prevents duplicate email sends from concurrent callbacks/webhooks.
// A failed send releases the lease so a later verification or My Tickets request can retry.
async function deliverTicketEmail(ticket) {
  if (!ticket || ticket.status !== 'paid' || !ticket.admissions?.length) return false;
  if (ticket.testMode && process.env.EVENT_NBV_SEND_TEST_EMAILS !== 'true') return false;
  if (!isEmailConfigured()) return false;

  const now = new Date();
  const stale = new Date(now.getTime() - 2 * 60_000);
  const claimed = await EventTicket.findOneAndUpdate(
    { _id: ticket._id, status: 'paid', confirmationEmailSentAt: null,
      $or: [{ confirmationEmailClaimedAt: null }, { confirmationEmailClaimedAt: { $lt: stale } }] },
    { $set: { confirmationEmailClaimedAt: now }, $inc: { confirmationEmailAttempts: 1 } },
    { returnDocument: 'after' },
  );
  if (!claimed) return false;
  try {
    const { subject, html } = buildEmail(claimed);
    await sendBrandedEmail({ to: claimed.buyerEmail, subject, html });
    await EventTicket.updateOne(
      { _id: claimed._id, confirmationEmailClaimedAt: now },
      { $set: { confirmationEmailSentAt: new Date() }, $unset: { confirmationEmailClaimedAt: 1 } },
    );
    return true;
  } catch (error) {
    await EventTicket.updateOne(
      { _id: claimed._id, confirmationEmailClaimedAt: now },
      { $unset: { confirmationEmailClaimedAt: 1 } },
    ).catch(() => null);
    console.error('[eventTickets.email] Ticket email could not be delivered:', error.message);
    return false;
  }
}

module.exports = { deliverTicketEmail, buildEmail, getTicketUrl };
