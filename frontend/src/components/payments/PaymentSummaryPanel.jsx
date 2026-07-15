import "./paymentTrust.css";

const formatMoney = (value = 0, currency = "NGN") => {
  const amount = Number(value || 0);
  const normalizedCurrency = String(currency || "NGN").trim().toUpperCase() || "NGN";
  return `${normalizedCurrency} ${amount.toLocaleString()}`;
};

const typeLabelMap = {
  album: "Album",
  book: "Book",
  marketplace: "Marketplace order",
  subscription: "Monthly membership",
  track: "Creator content",
  video: "Video",
};

export default function PaymentSummaryPanel({
  amount = 0,
  currency = "NGN",
  itemLabel = "Purchase",
  itemType = "",
  quantity = 1,
  platformFeeAmount = null,
  platformFeeLabel = "",
  processingFeeAmount = null,
  processingFeeLabel = "Payment processing deducted",
  netRevenueAmount = null,
  platformFeeExplanation = "",
  totalLabel = "Total before checkout",
  compact = false,
  className = "",
}) {
  const safeQuantity = Math.max(1, Number(quantity || 1));
  const normalizedAmount = Number(amount || 0);
  const platformFeeNumber =
    platformFeeAmount === null || platformFeeAmount === undefined
      ? null
      : Number(platformFeeAmount || 0);
  const processingFeeNumber =
    processingFeeAmount === null || processingFeeAmount === undefined
      ? null
      : Number(processingFeeAmount || 0);
  const netRevenueNumber =
    netRevenueAmount === null || netRevenueAmount === undefined
      ? null
      : Number(netRevenueAmount || 0);
  const classes = [
    "payment-summary",
    compact ? "payment-summary--compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes} aria-label="Payment summary before checkout">
      <div className="payment-summary__head">
        <span>Payment summary</span>
        <strong>{formatMoney(normalizedAmount, currency)}</strong>
      </div>

      <dl className="payment-summary__rows">
        <div>
          <dt>Item</dt>
          <dd>{itemLabel || "Purchase"}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{typeLabelMap[String(itemType || "").toLowerCase()] || "Creator content"}</dd>
        </div>
        {safeQuantity > 1 ? (
          <div>
            <dt>Quantity</dt>
            <dd>{safeQuantity.toLocaleString()}</dd>
          </div>
        ) : null}
        <div>
          <dt>{totalLabel}</dt>
          <dd>{formatMoney(normalizedAmount, currency)}</dd>
        </div>
        {platformFeeNumber !== null ? (
          <div>
            <dt>{platformFeeLabel || "Platform fee"}</dt>
            <dd>{formatMoney(platformFeeNumber, currency)}</dd>
          </div>
        ) : null}
        {processingFeeNumber !== null ? (
          <div>
            <dt>{processingFeeLabel}</dt>
            <dd>{formatMoney(processingFeeNumber, currency)}</dd>
          </div>
        ) : null}
        {netRevenueNumber !== null ? (
          <div>
            <dt>Net revenue shared</dt>
            <dd>{formatMoney(netRevenueNumber, currency)}</dd>
          </div>
        ) : null}
      </dl>

      <p className="payment-summary__note">
        {platformFeeExplanation ||
          "Tengacion platform fees are included in the displayed price. Paystack charges only the total shown before checkout."}
      </p>
    </section>
  );
}
