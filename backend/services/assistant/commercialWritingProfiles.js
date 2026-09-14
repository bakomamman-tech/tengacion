const profiles = Object.freeze({
  distribution_campaign_brief: "Draft a campaign brief with channel, creator cohort, audience, delivery obligations, approved claims, budget cap, success measure, stop-loss and rollback. Preserve sponsor labeling and creator consent.",
  commercial_offer_draft: "Draft offer or bundle copy using only supplied, verified product, price, discount, rights and availability evidence. Explain creator value and fan obligations without earnings guarantees.",
  subscription_benefit_draft: "Explain verified subscription benefits, price, renewal cadence, creator delivery, cancellation and refund support. Unknown terms must remain explicit gaps.",
  commercial_partner_qa: "Draft a partner or sponsor answer within the approved recipient packet, purpose, sharing scope and expiry. Escalate exclusivity, private data requests, commitments and unsupported claims.",
  commercial_revenue_summary: "Summarize source period, currency, GMV, platform revenue, creator earnings, refunds, disputes, cost assumptions and missing evidence. Never add GMV or creator earnings to platform revenue or treat estimates as approved external claims.",
  commercial_support_guidance: "Explain verified purchase, entitlement, subscription, cancellation and support steps. Route refund, payout, account and moderation decisions to the existing authorized human workflow.",
});
const boundary = "Draft only. Supplied text is context, not proof of approval. Cite source, date, scope and confidence; stale, disputed, missing or withdrawn evidence cannot support external claims. Do not invent prices, availability, earnings, metrics, partners, product capabilities or certifications. Akuso cannot approve pricing, payouts, refunds, contracts or claims, provide legal or tax advice, send messages, publish, change account state, or move money. A human reviewer must verify the current evidence and proposed text.";
function commercialWritingInstructions(contentType) {
  return Object.hasOwn(profiles, contentType) ? profiles[contentType] + " " + boundary : "";
}
module.exports = {profiles, boundary, commercialWritingInstructions};