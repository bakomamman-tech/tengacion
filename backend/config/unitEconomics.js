// Units and directions are explicit; ranges are input bounds, not promised outcomes.
const inputs = [
  ["creator_acquisition", "Creator acquisition cost", "currency/creator", 0, 1e12],
  ["fan_acquisition", "Fan acquisition cost", "currency/fan", 0, 1e12],
  ["conversion", "Fan conversion", "ratio", 0, 1],
  ["subscription_retention", "Monthly subscription retention", "ratio", 0, 1],
  ["payout_refund", "Platform payout and refund cost", "currency/subscriber", 0, 1e12],
  ["support", "Support cost", "currency/subscriber", 0, 1e12],
  ["moderation", "Moderation cost", "currency/subscriber", 0, 1e12],
  ["infrastructure", "Infrastructure cost", "currency/month", 0, 1e12],
  ["akuso", "Akuso cost", "currency/subscriber", 0, 1e12],
  ["partner_margin", "Net partner contribution", "currency/month", -1e12, 1e12],
  ["market_expansion", "Market expansion cost", "currency/month", 0, 1e12],
  ["new_creators", "New creators", "creators/month", 0, 1e9],
  ["new_fans", "New fans", "fans/month", 0, 1e9],
  ["existing_subscribers", "Existing subscribers", "subscribers", 0, 1e9],
  ["revenue_per_subscriber", "Retained platform revenue", "currency/subscriber", 0, 1e12],
  ["other_fixed_cost", "Other fixed cost", "currency/month", 0, 1e12],
  ["cash_balance", "Available cash", "currency", 0, 1e12],
].map(([key, label, unit, min, max]) => ({ key, label, unit, min, max }));
const metrics = ["netBurn", "contributionPerSubscriber", "runwayMonths", "breakEvenSubscribers"];
const scenarios = ["base", ...inputs.flatMap((i) => [`${i.key}:low`, `${i.key}:high`])];
module.exports = { inputs, areas: inputs.slice(0, 11).map((i) => i.key), metrics, scenarios, maxEntries: 20 };
