import { Link } from "react-router-dom";

export default function KadahiveBrand({ compact = false, to = "/kadahive" }) {
  return (
    <Link className={`kh-brand ${compact ? "kh-brand--compact" : ""}`} to={to}>
      <span className="kh-brand__mark" aria-hidden="true">
        <span>K</span>
      </span>
      <span className="kh-brand__copy">
        <strong>KADA HIVE</strong>
        <small>Innovation &amp; Tech Hub</small>
      </span>
    </Link>
  );
}
