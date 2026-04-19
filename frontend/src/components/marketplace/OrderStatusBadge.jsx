const toneForValue = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["paid", "approved", "completed", "delivered", "published", "new"].includes(normalized)) {
    return "marketplace-status-pill marketplace-status-pill--success";
  }
  if (["failed", "cancelled", "rejected", "suspended", "refunded", "removed"].includes(normalized)) {
    return "marketplace-status-pill marketplace-status-pill--danger";
  }
  if (["pending", "processing", "initiated", "pending_review", "shipped_or_ready", "draft", "used", "hidden"].includes(normalized)) {
    return "marketplace-status-pill marketplace-status-pill--warn";
  }
  return "marketplace-status-pill";
};

const labelForValue = (value = "") =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Unknown";

export default function OrderStatusBadge({ value = "" }) {
  return <span className={toneForValue(value)}>{labelForValue(value)}</span>;
}
