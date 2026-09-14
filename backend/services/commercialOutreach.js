const id = value => String(value?._id || value || "");
function outreachGrantBlockers(row, dependencies = [], grants = [], now = new Date()) {
  if (row.packageKey !== "CAPITAL-012") return [];
  const blockers = [];
  const targets = row.commercial?.outreachTargets || [];
  if (!targets.length) blockers.push("outreach_targets_required");
  const pairs = new Set();
  for (const target of targets) {
    const suffix = ":" + target.key;
    if (!target.evidenceIndexes?.length || !target.evidenceIndexes.every(index => {
      const entry = row.evidence?.[index];
      return Number.isInteger(index) && index >= 0 && entry?.confidence === 'current' && new Date(entry.observedAt) <= now && new Date(entry.expiresAt) > now;
    })) blockers.push('outreach_target_evidence_required' + suffix);
    if (target.requestedTerms?.trim() || target.riskyAsks?.trim()) {
      const indexes = target.advisorReviewEvidenceIndexes || [];
      if (target.advisorReviewState !== 'reviewed' || !indexes.length || new Set(indexes).size !== indexes.length || !indexes.every(index => {
        const entry = row.evidence?.[index];
        return Number.isInteger(index) && index >= 0 && entry?.confidence === 'current' && new Date(entry.observedAt) <= now && new Date(entry.expiresAt) > now;
      })) blockers.push('outreach_advisor_review_required' + suffix);
    }
    const pair = id(target.recipient) + ":" + id(target.grant);
    if (pairs.has(pair)) blockers.push("outreach_target_duplicate" + suffix);
    pairs.add(pair);
    const grant = grants.find(item => id(item) === id(target.grant));
    if (!grant || id(grant.recipient) !== id(target.recipient)) {
      blockers.push("outreach_recipient_grant_missing" + suffix);
      continue;
    }
    const packet = dependencies.find(item => id(item) === id(grant.record) && item.packageKey === "CAPITAL-006");
    if (!packet || packet.status !== "approved" || packet.__v !== grant.recordVersion) blockers.push("outreach_packet_version_blocked" + suffix);
    if (target.status !== "closed" && (grant.revokedAt || !(new Date(grant.expiresAt) > now))) blockers.push("outreach_grant_expired_or_revoked" + suffix);
    if (!["investor", "partner", "advisor"].includes(grant.audience)) blockers.push("outreach_grant_audience_invalid" + suffix);
    if (!target.followupOwner?.trim() || !target.nextStep?.trim()) blockers.push("outreach_followup_required" + suffix);
    if (target.status !== "closed" && !(new Date(target.reviewAt) > now)) blockers.push("outreach_target_review_due" + suffix);
  }
  return [...new Set(blockers)];
}
module.exports = {outreachGrantBlockers};