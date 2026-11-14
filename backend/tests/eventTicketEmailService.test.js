// No network, SMTP, or real Paystack calls are made in these unit tests.
process.env.NODE_ENV = 'test';
jest.mock('../models/EventTicket', () => ({
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../utils/sendBrandedEmail', () => ({
  sendBrandedEmail: jest.fn(),
}));
jest.mock('../utils/emailSettings', () => ({
  isEmailConfigured: jest.fn(),
}));

const EventTicket = require('../models/EventTicket');
const { sendBrandedEmail } = require('../utils/sendBrandedEmail');
const { isEmailConfigured } = require('../utils/emailSettings');
const { deliverTicketEmail, buildEmail } = require('../services/eventTicketEmailService');

const ticket = () => ({
  _id: 'ticket-id',
  status: 'paid',
  testMode: false,
  buyerEmail: 'buyer@example.test',
  attendeeName: '<Ada & Co>',
  reference: 'NVB26-123456789012345678901234',
  tier: 'table6',
  amountKobo: 10000000,
  admissions: [
    { number: 1, code: 'a'.repeat(48) },
    { number: 2, code: 'b'.repeat(48) },
  ],
});

beforeEach(() => {
  jest.resetAllMocks();
  isEmailConfigured.mockReturnValue(true);
  sendBrandedEmail.mockResolvedValue(undefined);
  EventTicket.updateOne.mockResolvedValue({ modifiedCount: 1 });
  delete process.env.EVENT_NBV_SEND_TEST_EMAILS;
});

test('receipt has unique guest codes, a login link and escapes untrusted names', () => {
  const email = buildEmail(ticket());
  expect(email.subject).toContain('No Bad Vibes');
  expect(email.html).toContain('a'.repeat(48));
  expect(email.html).toContain('b'.repeat(48));
  expect(email.html).toContain('&lt;Ada &amp; Co&gt;');
  expect(email.html).not.toContain('<Ada & Co>');
  expect(email.html).toContain('/events/no-bad-vibes?view=mine');
});

test('test-mode tickets never cause mail unless explicitly opted in', async () => {
  expect(await deliverTicketEmail({ ...ticket(), testMode: true })).toBe(false);
  expect(EventTicket.findOneAndUpdate).not.toHaveBeenCalled();
  expect(sendBrandedEmail).not.toHaveBeenCalled();
});

test('confirmed payment sends one receipt and stores delivery timestamp', async () => {
  EventTicket.findOneAndUpdate
    .mockResolvedValueOnce(ticket())
    .mockResolvedValueOnce(null);
  expect(await deliverTicketEmail(ticket())).toBe(true);
  expect(await deliverTicketEmail(ticket())).toBe(false);
  expect(sendBrandedEmail).toHaveBeenCalledTimes(1);
  expect(sendBrandedEmail).toHaveBeenCalledWith(expect.objectContaining({
    to: 'buyer@example.test',
  }));
  expect(EventTicket.updateOne).toHaveBeenCalledWith(
    expect.objectContaining({ _id: 'ticket-id' }),
    expect.objectContaining({ $set: expect.objectContaining({ confirmationEmailSentAt: expect.any(Date) }) }),
  );
});

test('failed SMTP send releases delivery claim for retry', async () => {
  EventTicket.findOneAndUpdate.mockResolvedValueOnce(ticket());
  sendBrandedEmail.mockRejectedValueOnce(new Error('SMTP test failure'));
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect(await deliverTicketEmail(ticket())).toBe(false);
    expect(EventTicket.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'ticket-id' }),
      expect.objectContaining({ $unset: { confirmationEmailClaimedAt: 1 } }),
    );
  } finally {
    errorSpy.mockRestore();
  }
});
