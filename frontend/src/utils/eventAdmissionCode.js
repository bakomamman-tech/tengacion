// A venue scanner may type either the raw 48-hex admission credential or
// the exact URL encoded by the No Bad Vibes ticket QR.
const CODE_PATTERN = /^[a-f0-9]{48}$/;
const QR_PATH_PATTERN = /^\/api\/event-tickets\/status\/([a-f0-9]{48})\/?$/;

export function parseEventAdmissionCode(raw) {
  const value = String(raw ?? '').trim();
  if (CODE_PATTERN.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return url.pathname.match(QR_PATH_PATTERN)?.[1] || '';
  } catch {
    return '';
  }
}
