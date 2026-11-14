// Organizer-confirmed No Bad Vibes inventory and pricing, in NGN kobo.
// Inventory is organizer-confirmed for Regular (1,000 tickets) and VIP/table tiers (500 each).
const EVENT_SLUG = 'no-bad-vibes-2026';
const HOLD_MINUTES = 30;
const CATEGORIES = Object.freeze({
  regular: Object.freeze({
    label: 'Regular — Drink & Vibe', amountKobo: 300_000, seats: 1, capacity: 1000,
  }),
  vip: Object.freeze({
    label: 'VIP', amountKobo: 1_000_000, seats: 1, capacity: 500,
  }),
  table6: Object.freeze({
    label: 'Table for 6', amountKobo: 10_000_000, seats: 6, capacity: 500,
  }),
  table8: Object.freeze({
    label: 'Table for 8', amountKobo: 20_000_000, seats: 8, capacity: 500,
  }),
  exclusive: Object.freeze({
    label: 'No Bad Vibes Table', amountKobo: 50_000_000, seats: 10, capacity: 500,
  }),
});

const hasConfirmedInventory = (tierId) => {
  const tier = CATEGORIES[tierId];
  return Boolean(tier && Number.isSafeInteger(tier.capacity) && tier.capacity > 0);
};

module.exports = { EVENT_SLUG, HOLD_MINUTES, CATEGORIES, hasConfirmedInventory };
