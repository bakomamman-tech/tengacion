const {
  categoryKeys,
  decisions,
} = require("../config/capitalBlockers");

const finiteDate = (value) =>
  Number.isFinite(new Date(value).getTime());

const currentEvidence = (entry, now) =>
  entry &&
  entry.confidence === "current" &&
  finiteDate(entry.observedAt) &&
  new Date(entry.observedAt) <= now &&
  finiteDate(entry.expiresAt) &&
  new Date(entry.expiresAt) > now;

const validIndexes = (indexes, evidence) =>
  Array.isArray(indexes) &&
  new Set(indexes).size === indexes.length &&
  indexes.every(
    (index) =>
      Number.isInteger(index) &&
      index >= 0 &&
      index < (evidence || []).length
  );

function analyzeCapitalBlocker(row, now = new Date()) {
  const blocker = row?.capitalBlocker || {};
  const blockers = [];
  const evidence = row?.evidence || [];

  if (!categoryKeys.includes(blocker.category)) {
    blockers.push(
      "capital_blocker_category_missing"
    );
  }

  if (!decisions.includes(blocker.resolution)) {
    blockers.push(
      "capital_blocker_decision_missing"
    );
  }

  if (!blocker.rationale?.trim()) {
    blockers.push(
      "capital_blocker_rationale_missing"
    );
  }

  const linkedIndexes =
    blocker.evidenceIndexes || [];

  if (
    !validIndexes(
      linkedIndexes,
      evidence
    )
  ) {
    blockers.push(
      "capital_blocker_evidence_links_invalid"
    );
  }

  const linkedEvidence =
    validIndexes(
      linkedIndexes,
      evidence
    )
      ? linkedIndexes.map(
          (index) => evidence[index]
        )
      : [];

  if (
    [
      "close_with_evidence",
      "narrow_claim",
    ].includes(
      blocker.resolution
    ) &&
    (
      !linkedEvidence.length ||
      linkedEvidence.some(
        (entry) =>
          !currentEvidence(
            entry,
            now
          )
      )
    )
  ) {
    blockers.push(
      "capital_blocker_current_evidence_required"
    );
  }

  if (
    blocker.resolution ===
      "narrow_claim" &&
    (
      !blocker.originalClaim?.trim() ||
      !blocker.revisedClaim?.trim() ||
      blocker.originalClaim.trim() ===
        blocker.revisedClaim.trim()
    )
  ) {
    blockers.push(
      "capital_blocker_claim_narrowing_required"
    );
  }

  if (
    blocker.resolution ===
      "delay_outreach" &&
    !blocker
      .outreachConstraint
      ?.trim()
  ) {
    blockers.push(
      "capital_blocker_outreach_constraint_required"
    );
  }

  if (
    blocker.resolution ===
      "change_financing_path" &&
    !blocker
      .financingPath
      ?.trim()
  ) {
    blockers.push(
      "capital_blocker_financing_path_required"
    );
  }

  if (
    blocker.resolution ===
    "accept_risk_with_advisor_review"
  ) {
    if (
      row?.risk?.severity ===
      "critical"
    ) {
      blockers.push(
        "capital_blocker_critical_risk_cannot_be_accepted"
      );
    }

    if (
      !row?.risk?.acceptedUntil ||
      !finiteDate(
        row.risk.acceptedUntil
      ) ||
      new Date(
        row.risk.acceptedUntil
      ) <= now
    ) {
      blockers.push(
        "capital_blocker_risk_expiration_required"
      );
    }

    if (
      !row?.risk?.mitigation?.trim() ||
      !row?.risk
        ?.compensatingControl
        ?.trim() ||
      !row?.risk
        ?.reviewTrigger
        ?.trim()
    ) {
      blockers.push(
        "capital_blocker_risk_controls_required"
      );
    }

    const advisorIndexes =
      blocker
        .advisorReviewEvidenceIndexes ||
      [];

    if (
      !validIndexes(
        advisorIndexes,
        evidence
      ) ||
      !advisorIndexes.length ||
      advisorIndexes
        .map(
          (index) =>
            evidence[index]
        )
        .some(
          (entry) =>
            !currentEvidence(
              entry,
              now
            )
        )
    ) {
      blockers.push(
        "capital_blocker_advisor_review_evidence_required"
      );
    }
  }

  return {
    category:
      blocker.category || null,

    resolution:
      blocker.resolution || null,

    state:
      blockers.length
        ? "incomplete_or_on_hold"
        : row?.status === "approved"
          ? "reviewed_record_available"
          : "candidate_for_independent_review",

    blockers: [
      ...new Set(blockers),
    ],

    humanDecisionRecorded:
      row?.status === "approved" &&
      blockers.length === 0,

    realWorldClosureEstablished:
      false,

    outreachAuthorized:
      false,

    financingChangeAuthorized:
      false,

    riskAcceptedBySoftware:
      false,

    moneyMovementAuthorized:
      false,

    externalUse:
      "requires_current_evidence_and_independent_human_review",
  };
}

module.exports = {
  analyzeCapitalBlocker,
};