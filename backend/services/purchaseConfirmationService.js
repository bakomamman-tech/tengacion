const User = require("../models/User");
const { resolvePurchasableItem } = require("./catalogService");
const { config } = require("../config/env");
const sendSecurityEmail = require("../utils/sendSecurityEmail");
const { isEmailConfigured } = require("../utils/emailSettings");

const toIdString = (value) => {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (value._id) {
    return value._id.toString();
  }
  return value.toString();
};

const escapeHtml = (value = "") =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatMoney = (amount = 0, currency = "NGN") =>
  `${String(currency || "NGN").toUpperCase()} ${Number(amount || 0).toLocaleString()}`;

const resolveAppUrl = () =>
  String(config.APP_URL || config.appUrl || process.env.APP_URL || "https://tengacion.com").replace(/\/+$/, "");

const sendPurchaseConfirmationEmail = async ({ purchase } = {}) => {
  if (!purchase?._id || String(purchase.status || "").toLowerCase() !== "paid") {
    return { sent: false, skipped: true, reason: "missing_paid_purchase" };
  }

  if (!isEmailConfigured()) {
    return { sent: false, skipped: true, reason: "email_not_configured" };
  }

  const buyer = await User.findById(purchase.userId).select("email name username").lean();
  const email = String(buyer?.email || "").trim().toLowerCase();
  if (!email) {
    return { sent: false, skipped: true, reason: "missing_buyer_email" };
  }

  const item = await resolvePurchasableItem(purchase.itemType, purchase.itemId).catch(() => null);
  const title = item?.title || (purchase.itemType === "subscription" ? "Creator membership" : "Creator content");
  const receiptUrl = `${resolveAppUrl()}/purchases/${toIdString(purchase._id)}`;
  const reference = purchase.providerRef || "";
  const paidAt = purchase.paidAt ? new Date(purchase.paidAt).toUTCString() : new Date().toUTCString();
  const taxAmount = Math.max(0, Number(purchase.taxAmount || 0));
  const listedPriceAmount =
    purchase.listedPriceAmount == null
      ? Number(purchase.amount || 0)
      : Number(purchase.listedPriceAmount || 0);
  const taxLabel = purchase.taxPriceMode === "exclusive" ? "Tax" : "Tax included";

  await sendSecurityEmail({
    to: email,
    subject: "Your Tengacion purchase confirmation",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;padding:16px;">
        <h2 style="margin:0 0 12px;">Payment confirmed</h2>
        <p>Hello ${escapeHtml(buyer.name || buyer.username || "there")},</p>
        <p>Your Tengacion payment for <strong>${escapeHtml(title)}</strong> has been verified.</p>
        <table style="border-collapse:collapse;margin:16px 0;width:100%;max-width:520px;">
          ${taxAmount > 0 ? `<tr><td style="padding:8px;border:1px solid #e5e7eb;">Listed price</td><td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(formatMoney(listedPriceAmount, purchase.currency))}</td></tr>` : ""}
          ${taxAmount > 0 ? `<tr><td style="padding:8px;border:1px solid #e5e7eb;">${taxLabel}</td><td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(formatMoney(taxAmount, purchase.currency))}</td></tr>` : ""}
          <tr><td style="padding:8px;border:1px solid #e5e7eb;">Total paid</td><td style="padding:8px;border:1px solid #e5e7eb;"><strong>${escapeHtml(formatMoney(purchase.amount, purchase.currency))}</strong></td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;">Reference</td><td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(reference)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;">Verified at</td><td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(paidAt)}</td></tr>
        </table>
        <p>Tengacion platform fees are included in the displayed price. Your payment provider charged only the verified total shown above.</p>
        <p><a href="${escapeHtml(receiptUrl)}" style="display:inline-block;padding:10px 14px;background:#1f4b34;color:#fff;text-decoration:none;border-radius:8px;">View receipt</a></p>
      </div>
    `,
  });

  return {
    sent: true,
    skipped: false,
    to: email,
  };
};

module.exports = {
  sendPurchaseConfirmationEmail,
};
