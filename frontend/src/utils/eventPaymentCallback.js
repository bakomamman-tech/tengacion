// Paystack sometimes returns trxref rather than the reference callback parameter.
// Both values are treated only as untrusted lookup keys; the backend independently
// verifies payment, ownership, amount, currency, and status with Paystack.
const EVENT_PAYMENT_REFERENCE = /^NVB26-[a-f0-9]{24}$/;

export function getEventPaymentReference(params) {
  const standard = String(params.get('reference') || '').trim();
  const trxref = String(params.get('trxref') || '').trim();
  if (standard && trxref && standard !== trxref) return '';
  const reference = standard || trxref;
  return EVENT_PAYMENT_REFERENCE.test(reference) ? reference : '';
}

export function clearEventPaymentReference(params) {
  const cleaned = new URLSearchParams(params);
  cleaned.delete('reference');
  cleaned.delete('trxref');
  return cleaned;
}
