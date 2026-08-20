import { Link } from "react-router-dom";

export default function KadahiveBrand({ compact = false, to = "/kadahive" }) {
  return (
    <Link className={`kh-brand ${compact ? "kh-brand--compact" : ""}`} to={to}>
      <img
        className="kh-brand__logo"
        src="/assets/kadahive/kadahive-logo-polished.png"
        alt="KADA Hive Innovation & Tech Hub"
      />
    </Link>
  );
}
