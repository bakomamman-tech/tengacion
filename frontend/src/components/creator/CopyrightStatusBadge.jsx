import { getStatusTone } from "./creatorConfig";

const LABELS = {
  pending_scan: "Pending scan",
  passed: "Passed",
  flagged: "Needs review",
  blocked: "Blocked",
  draft: "Draft",
  published: "Published",
  under_review: "Under review",
  active: "Active",
  pending_review: "Pending review",
  restricted: "Restricted",
};

export default function CopyrightStatusBadge({ status = "", className = "" }) {
  const normalized = String(status || "").trim().toLowerCase();
  const tone = getStatusTone(normalized);
  return (
    <span className={`creator-status-badge ${tone} ${className}`.trim()}>
      {LABELS[normalized] || status || "Unknown"}
    </span>
  );
}
