import { resolveImage } from "../../api";
import CopyrightStatusBadge from "./CopyrightStatusBadge";
import { formatCreatorLaneLabel, formatCurrency, normalizeCreatorLaneKeys } from "./creatorConfig";

export default function CreatorProfileSummaryCard({ creatorProfile, summary }) {
  const avatarSrc =
    resolveImage(creatorProfile?.user?.avatar || "") ||
    resolveImage(creatorProfile?.coverImageUrl || "") ||
    "";
  const creatorLanes = normalizeCreatorLaneKeys(creatorProfile?.creatorTypes);

  return (
    <section className="creator-profile-summary card">
      <div className="creator-profile-summary-head">
        <div className="creator-avatar-mark">
          {avatarSrc ? (
            <img src={avatarSrc} alt={creatorProfile?.displayName || creatorProfile?.fullName || "Creator"} />
          ) : (
            (creatorProfile?.displayName || creatorProfile?.fullName || "C").slice(0, 1).toUpperCase()
          )}
        </div>
        <div>
          <div className="creator-inline-row">
            <h2>{creatorProfile?.displayName || creatorProfile?.fullName || "Creator"}</h2>
            <CopyrightStatusBadge status={creatorProfile?.status || "active"} />
          </div>
          <p>
            {creatorLanes.length
              ? creatorLanes
                  .map((entry) => formatCreatorLaneLabel(entry))
                  .join(" | ")
              : "Creator workspace"}
          </p>
        </div>
      </div>

      <div className="creator-profile-summary-grid">
        <div>
          <span>Profile completion</span>
          <strong>{Number(creatorProfile?.profileCompletionScore || 0)}%</strong>
        </div>
        <div>
          <span>Total earnings</span>
          <strong>{formatCurrency(summary?.totalEarnings || 0)}</strong>
        </div>
        <div>
          <span>Available balance</span>
          <strong>{formatCurrency(summary?.availableBalance || 0)}</strong>
        </div>
        <div>
          <span>Pending balance</span>
          <strong>{formatCurrency(summary?.pendingBalance || 0)}</strong>
        </div>
      </div>
    </section>
  );
}
