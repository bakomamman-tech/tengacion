import { resolveImage } from "../../api";
import CopyrightStatusBadge from "./CopyrightStatusBadge";
import { formatCurrency } from "./creatorConfig";

export default function CreatorProfileSummaryCard({ creatorProfile, summary }) {
  const avatarSrc =
    resolveImage(creatorProfile?.user?.avatar || "") ||
    resolveImage(creatorProfile?.coverImageUrl || "") ||
    "";

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
            {creatorProfile?.creatorTypes?.length
              ? creatorProfile.creatorTypes
                  .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1))
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
