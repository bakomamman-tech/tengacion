import { Link } from "react-router-dom";

import "./paymentTrust.css";

export default function PaymentRecoveryNotice({
  title = "Payment not confirmed",
  message = "If money left your account, retry verification first. If it still fails, keep the reference and contact support so Tengacion can reconcile it.",
  reference = "",
  retryLabel = "Retry verification",
  onRetry,
  supportPath = "/contact",
  className = "",
}) {
  return (
    <aside className={["payment-recovery", className].filter(Boolean).join(" ")} role="status">
      <strong>{title}</strong>
      <p>{message}</p>
      {reference ? <span>Reference: {reference}</span> : null}
      <div className="payment-recovery__actions">
        {typeof onRetry === "function" ? (
          <button type="button" onClick={onRetry}>
            {retryLabel}
          </button>
        ) : null}
        <Link to={supportPath}>Contact support</Link>
      </div>
    </aside>
  );
}
