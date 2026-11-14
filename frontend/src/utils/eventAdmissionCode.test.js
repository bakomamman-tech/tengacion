import { describe, expect, it } from 'vitest';
import { parseEventAdmissionCode } from './eventAdmissionCode';

const code = 'a'.repeat(48);

describe('No Bad Vibes gate QR parsing', () => {
  it('accepts a valid raw per-guest admission code', () => {
    expect(parseEventAdmissionCode(code)).toBe(code);
  });
  it('accepts the exact QR URL emitted by a ticket', () => {
    expect(parseEventAdmissionCode(`https://www.tengacion.com/api/event-tickets/status/${code}`)).toBe(code);
    expect(parseEventAdmissionCode(`http://127.0.0.1:5000/api/event-tickets/status/${code}`)).toBe(code);
  });
  it('rejects a payment reference, ticket id, or truncated code', () => {
    expect(parseEventAdmissionCode('NVB26-' + 'a'.repeat(24))).toBe('');
    expect(parseEventAdmissionCode('a'.repeat(24))).toBe('');
    expect(parseEventAdmissionCode('a'.repeat(47))).toBe('');
  });
  it('rejects unrelated links and extra path segments', () => {
    expect(parseEventAdmissionCode(`https://example.com/other/${code}`)).toBe('');
    expect(parseEventAdmissionCode(`https://example.com/api/event-tickets/status/${code}/redeem`)).toBe('');
  });
  it('rejects non-http links, bogus content and uppercase lookalikes', () => {
    expect(parseEventAdmissionCode('javascript:alert(1)')).toBe('');
    expect(parseEventAdmissionCode('')).toBe('');
    expect(parseEventAdmissionCode('B'.repeat(48))).toBe('');
  });
});
