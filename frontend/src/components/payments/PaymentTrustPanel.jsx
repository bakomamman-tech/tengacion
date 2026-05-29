import { Link } from "react-router-dom";

import "./paymentTrust.css";

const DEFAULT_POINTS = [
  "Secure payment powered by Paystack",
  "Access unlocks only after backend verification",
  "Refund and dispute review is available",
];

const CONTEXT_POINTS = {
  digital: DEFAULT_POINTS,
  marketplace: [
    "Secure payment powered by Paystack",
    "Seller fulfillment and buyer issues can be reviewed",
    "Order status stays visible after checkout",
  ],
  subscription: [
    "Secure monthly payment powered by Paystack",
    "Creator access unlocks after backend verification",
    "Renewal, cancellation, and refund review paths stay visible",
  ],
};

export default function PaymentTrustPanel({
  context = "digital",
  className = "",
  compact = false,
  showSellerTerms = false,
  orderPath = "",
  purchasesPath = "/purchases",
}) {
  const points = CONTEXT_POINTS[context] || DEFAULT_POINTS;
  const classes = [
    "payment-trust",
    compact ? "payment-trust--compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={classes} aria-label="Payment trust and buyer protection">
      <div className="payment-trust__head">
        <span>Payment trust</span>
        <strong>Paystack-secured checkout</strong>
      </div>

      <ul className="payment-trust__list">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>

      <div className="payment-trust__links">
        <Link to="/refund-policy">Refund policy</Link>
        <Link to="/contact">Report payment issue</Link>
        {orderPath ? <Link to={orderPath}>Order status</Link> : null}
        {!orderPath && purchasesPath ? <Link to={purchasesPath}>Access page</Link> : null}
        {showSellerTerms ? <Link to="/marketplace-seller-terms">Seller policy</Link> : null}
      </div>
    </aside>
  );
}
