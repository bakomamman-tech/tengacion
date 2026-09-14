const {outreachGrantBlockers: blockers} = require("../services/commercialOutreach");
const now = new Date("2026-09-14T12:00:00Z");
const future = new Date(+now + 86400000);
const past = new Date(+now - 86400000);
function fixture() {
  return {row: {packageKey: "CAPITAL-012", evidence: [{confidence: "current", observedAt: past, expiresAt: future}],
    commercial: {outreachTargets: [{key: "target-1", recipient: "recipient-1", grant: "grant-1", status: "planned",
      followupOwner: "Capital owner", nextStep: "Review the diligence request", reviewAt: future, evidenceIndexes: [0]}]}},
    dependencies: [{_id: "packet-1", packageKey: "CAPITAL-006", status: "approved", __v: 3}],
    grants: [{_id: "grant-1", record: "packet-1", recipient: "recipient-1", recordVersion: 3, audience: "investor", expiresAt: future}]};
}
const analyze = f => blockers(f.row, f.dependencies, f.grants, now);
test("controlled outreach accepts matching current recipient-bound packet evidence", () => {
  expect(analyze(fixture())).toEqual([]);
});
test.each(["wrong_recipient", "missing_grant", "wrong_packet", "old_version", "expired", "revoked", "wrong_audience"])("%s access cannot support outreach readiness", kind => {
  const f = fixture();
  if (kind === "wrong_recipient") f.grants[0].recipient = "someone-else";
  if (kind === "missing_grant") f.grants = [];
  if (kind === "wrong_packet") f.dependencies[0].packageKey = "CERTIFICATION-004";
  if (kind === "old_version") f.grants[0].recordVersion = 2;
  if (kind === "expired") f.grants[0].expiresAt = past;
  if (kind === "revoked") f.grants[0].revokedAt = past;
  if (kind === "wrong_audience") f.grants[0].audience = "public";
  expect(analyze(f).length).toBeGreaterThan(0);
});
test("a named target cannot substitute assertions for recorded access evidence", () => {
  const f = fixture(); f.row.commercial.outreachTargets[0].evidenceIndexes = [];
  expect(analyze(f)).toContain("outreach_target_evidence_required:target-1");
});
test("risky terms require an evidence-backed advisor review, not an approval label", () => {
  const f = fixture(), target = f.row.commercial.outreachTargets[0];
  target.requestedTerms = "Exclusive partner terms"; target.advisorReviewState = "reviewed";
  expect(analyze(f)).toContain("outreach_advisor_review_required:target-1");
  target.advisorReviewEvidenceIndexes = [0];
  expect(analyze(f)).toEqual([]);
  f.row.evidence[0].expiresAt = past;
  expect(analyze(f)).toContain("outreach_advisor_review_required:target-1");
});
test("duplicate recipients and grants do not count as separate approved targets", () => {
  const f = fixture(); f.row.commercial.outreachTargets.push({...f.row.commercial.outreachTargets[0], key: "target-2"});
  expect(analyze(f)).toContain("outreach_target_duplicate:target-2");
});
test("active follow-ups require an owner, next step and future review date", () => {
  const f = fixture(), target = f.row.commercial.outreachTargets[0];
  target.followupOwner = ""; target.reviewAt = past;
  expect(analyze(f)).toEqual(expect.arrayContaining(["outreach_followup_required:target-1", "outreach_target_review_due:target-1"]));
});