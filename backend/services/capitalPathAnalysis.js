const {
  pathKeys,
  packetSectionKeys,
} = require("../config/capitalPaths");

const finiteDate = (value) =>
  Number.isFinite(
    new Date(value).getTime()
  );

const currentEvidence = (
  entry,
  now
) =>
  entry &&
  entry.confidence ===
    "current" &&
  finiteDate(entry.observedAt) &&
  new Date(entry.observedAt) <=
    now &&
  finiteDate(entry.expiresAt) &&
  new Date(entry.expiresAt) >
    now;

const validIndexes = (
  indexes,
  evidence
) =>
  Array.isArray(indexes) &&
  new Set(indexes).size ===
    indexes.length &&
  indexes.every(
    (index) =>
      Number.isInteger(index) &&
      index >= 0 &&
      index <
        (evidence || []).length
  );

const nonBlankStrings = (
  values
) =>
  Array.isArray(values) &&
  values.length > 0 &&
  values.every(
    (value) =>
      typeof value === "string" &&
      value.trim()
  );

function analyzeCapitalPath(
  row,
  now = new Date()
) {
  const decision =
    row?.capitalPathDecision ||
    {};

  const evidence =
    row?.evidence || [];

  const blockers = [];

  if (
    !pathKeys.includes(
      decision.path
    )
  ) {
    blockers.push(
      "capital_path_missing"
    );
  }

  if (
    !decision.rationale?.trim()
  ) {
    blockers.push(
      "capital_path_rationale_missing"
    );
  }

  /*
   * CAPITAL-011 exit criteria
   * require the chosen path to
   * have an accountable owner.
   *
   * Reuse the canonical record
   * owner instead of creating a
   * second ownership authority.
   */
  if (!row?.owner) {
    blockers.push(
      "capital_path_owner_missing"
    );
  }

  if (
    !decision.timeline?.trim()
  ) {
    blockers.push(
      "capital_path_timeline_missing"
    );
  }

  if (
    !nonBlankStrings(
      decision.evidenceRequirements
    )
  ) {
    blockers.push(
      "capital_path_evidence_requirements_missing"
    );
  }

  const sections =
    Array.isArray(
      decision.packetSections
    )
      ? decision.packetSections
      : [];

  const sectionKeys =
    sections
      .map(
        (section) =>
          section?.key
      )
      .filter(Boolean);

  if (
    new Set(sectionKeys).size !==
    sectionKeys.length
  ) {
    blockers.push(
      "capital_path_packet_sections_duplicate"
    );
  }

  for (
    const requiredKey of
    packetSectionKeys
  ) {
    const section =
      sections.find(
        (entry) =>
          entry?.key ===
          requiredKey
      );

    if (!section) {
      blockers.push(
        `capital_path_packet_missing:${requiredKey}`
      );

      continue;
    }

    if (
      !validIndexes(
        section.evidenceIndexes,
        evidence
      )
    ) {
      blockers.push(
        `capital_path_packet_evidence_invalid:${requiredKey}`
      );

      continue;
    }

    if (
      !section.evidenceIndexes
        .length
    ) {
      blockers.push(
        `capital_path_packet_evidence_required:${requiredKey}`
      );

      continue;
    }

    const linkedEvidence =
      section.evidenceIndexes.map(
        (index) =>
          evidence[index]
      );

    if (
      linkedEvidence.some(
        (entry) =>
          !currentEvidence(
            entry,
            now
          )
      )
    ) {
      blockers.push(
        `capital_path_packet_evidence_not_current:${requiredKey}`
      );
    }
  }

  return {
    path:
      decision.path || null,

    state:
      blockers.length
        ? "incomplete_or_on_hold"
        : row?.status ===
            "approved"
          ? "reviewed_record_available"
          : "candidate_for_independent_review",

    blockers: [
      ...new Set(blockers),
    ],

    humanDecisionRecorded:
      row?.status ===
        "approved" &&
      blockers.length === 0,

    /*
     * Hard authority boundaries.
     *
     * A successful analysis means
     * only that the record is
     * structurally ready for human
     * governance.
     */
    capitalPathChosenBySoftware:
      false,

    outreachAuthorized: false,

    fundraisingAuthorized: false,

    partnerTermsAccepted: false,

    spendingAuthorized: false,

    moneyMovementAuthorized: false,

    noGoIsValidStrategicDecision:
      true,

    externalUse:
      "requires_current_evidence_and_independent_human_review",
  };
}

module.exports = {
  analyzeCapitalPath,
};