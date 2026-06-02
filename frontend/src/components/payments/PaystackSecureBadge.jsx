import "./paymentTrust.css";

export default function PaystackSecureBadge({ className = "", compact = false }) {
  const classes = [
    "paystack-secure-badge",
    compact ? "paystack-secure-badge--compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes}>
      <span aria-hidden="true" />
      Secured by Paystack
    </span>
  );
}
