
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Record = require("../models/ExternalReadinessRecord");
const User = require("../models/User");
const config = require("../config/capitalPaths");
const service = require("../services/externalReadinessService");
const { analyzeCapitalPath: analyze } = require("../services/capitalPathAnalysis");
const future = () => new Date(Date.now() + 86400000 * 7);
const structure = () => ({ path: "no_external_capital_yet", rationale: "Prove milestones first",
  timeline: "Review in thirty days", evidenceRequirements: ["Current packet"],
  packetSections: config.packetSectionKeys.map(key => ({ key, evidenceIndexes: [0] })) });
const base = () => {
  const owner = new mongoose.Types.ObjectId();
  return { packageKey: "CAPITAL-011", title: "Human capital choice", owner, createdBy: owner, lastChangedBy: owner,
    domain: "external_reporting", scope: "Internal review", dueAt: future(), expiresAt: future(), status: "draft",
    evidence: [{ source: "Controlled packet", summary: "Current evidence", observedAt: new Date(Date.now()-60000), expiresAt: future(), confidence: "current" }],
    decision: "Remain without external capital", alternatives: "Delay and prove milestones", reversalCondition: "Review new milestone evidence",
    capitalPathDecision: structure(), dependencies: [], findingIds: [], relatedControlKeys: [], responses: [], audience: "internal" };
};
const authority = result => {
  for (const key of ["capitalPathChosenBySoftware", "outreachAuthorized", "fundraisingAuthorized", "partnerTermsAccepted", "spendingAuthorized", "moneyMovementAuthorized"]) expect(result[key]).toBe(false);
  expect(result.noGoIsValidStrategicDecision).toBe(true);
  expect(result.externalUse).toBe("requires_current_evidence_and_independent_human_review");
};
test("catalog and configuration preserve the authoritative contract", () => {
  expect(service.catalog).toHaveLength(48);
  expect(new Set(service.catalog.map(x => x.key)).size).toBe(48);
  expect(service.catalog.filter(x => x.cycle === "capital").map(x => x.key)).toEqual(Array.from({length:11}, (_,i) => "CAPITAL-"+String(i+1).padStart(3,"0")));
  expect(service.catalog.find(x => x.key === "CAPITAL-011")).toMatchObject({kind:"decision", title:"Make The Capital Path Decision"});
  expect(config.paths).toHaveLength(9); expect(config.packetSections).toHaveLength(8);
  expect(service.analyzeCapitalPath).toBe(analyze);
});
test("incomplete drafts remain valid with deterministic blockers", async () => {
  const row = {...base(), capitalPathDecision:{}};
  await expect(new Record(row).validate()).resolves.toBeUndefined();
  expect(analyze(row)).toEqual(analyze(row));
  expect(analyze(row).state).toBe("incomplete_or_on_hold");
  expect(service.localBlockers(row)).toEqual(expect.arrayContaining(analyze(row).blockers));
  authority(analyze(row));
});
test.each(config.pathKeys)("human choice %s remains legitimate", path => {
  const row=base(); row.capitalPathDecision.path=path;
  expect(analyze(row).state).toBe("candidate_for_independent_review");
  expect(analyze(row).blockers).toEqual([]); authority(analyze(row));
});
test.each(["rationale","timeline","evidenceRequirements","path"])("missing %s blocks readiness", field => {
  const row=base(); delete row.capitalPathDecision[field];
  expect(analyze(row).state).toBe("incomplete_or_on_hold");
});
test("missing owner blocks readiness", () => {
  const row=base(); delete row.owner; expect(analyze(row).blockers).toContain("capital_path_owner_missing");
});
test.each(config.packetSectionKeys)("requires packet section %s", key => {
  const row=base(); row.capitalPathDecision.packetSections=row.capitalPathDecision.packetSections.filter(x=>x.key!==key);
  expect(analyze(row).blockers).toContain("capital_path_packet_missing:"+key);
});
test.each([[[-1]],[[1]],[[0,0]],[[0.5]]])("rejects invalid indexes %j", async indexes => {
  const row=base(); row.capitalPathDecision.packetSections[0].evidenceIndexes=indexes;
  await expect(new Record(row).validate()).rejects.toThrow();
  expect(analyze(row).blockers).toContain("capital_path_packet_evidence_invalid:readiness_scorecard");
});
test("empty evidence linkage blocks readiness", () => {
  const row=base(); row.capitalPathDecision.packetSections[0].evidenceIndexes=[];
  expect(analyze(row).blockers).toContain("capital_path_packet_evidence_required:readiness_scorecard");
});
test("duplicate packet sections rejected", async () => {
  const row=base(); row.capitalPathDecision.packetSections.push(row.capitalPathDecision.packetSections[0]);
  await expect(new Record(row).validate()).rejects.toThrow("Capital path packet section keys must be unique");
  expect(analyze(row).blockers).toContain("capital_path_packet_sections_duplicate");
});
test("duplicate requirements rejected", async () => {
  const row=base(); row.capitalPathDecision.evidenceRequirements=["Proof","Proof"];
  await expect(new Record(row).validate()).rejects.toThrow("unique");
});
test.each(["stale","expired","future"])("%s evidence blocks readiness", state => {
  const row=base();
  if(state==="stale") row.evidence[0].confidence="stale";
  if(state==="expired") row.evidence[0].expiresAt=new Date(Date.now()-1000);
  if(state==="future") row.evidence[0].observedAt=future();
  expect(analyze(row).blockers).toContain("capital_path_packet_evidence_not_current:readiness_scorecard");
});
test.each(["CAPITAL-010","CERTIFICATION-004"])("rejects structure on %s", async packageKey => {
  await expect(new Record({...base(),packageKey}).validate()).rejects.toThrow("Capital path decisions belong to CAPITAL-011");
});
test("rejects approved incomplete record", async () => {
  await expect(new Record({...base(),status:"approved",capitalPathDecision:{}}).validate()).rejects.toThrow("Incomplete capital path decision cannot be approved");
});
test.each(["decision","alternatives","reversalCondition"])("generic %s remains required", field => {
  const row=base(); delete row[field];
  expect(service.localBlockers(row)).toContain(field==="alternatives"?"alternatives_missing":"decision_and_reversal_required");
});
describe("persisted human governance", () => {
  let server,owner,reviewer;
  beforeAll(async () => {
    server=await MongoMemoryServer.create(); await mongoose.connect(server.getUri());
    [owner,reviewer]=await User.create(["owner","reviewer"].map(name=>({name,username:"capital011_"+name,email:name+"@capital011.test",password:"Password123!",role:"admin"})));
  });
  afterAll(async () => {await mongoose.disconnect(); if(server) await server.stop();});
  test("saves, independently approves, reports, and returns revisions through draft", async () => {
    const {createdBy,lastChangedBy,status,...body}=base();
    const spec=service.catalog.find(x=>x.key==="CAPITAL-011");
    let row=await service.saveDraft({actor:owner._id,body:{...body,owner:owner._id,reason:"Prepare human review",
      responses:spec.requirements.flatMap((text,index)=>text.endsWith(":")?[]:[{index,response:"Reviewed current source",evidenceIndexes:[0]}])}});
    const transition=(action,actor=owner._id)=>service.transition({recordId:row._id,actor,body:{action,reason:"Governance review",notes:"Independent current evidence review",version:row.__v,outcome:"pass"}});
    row=await transition("attest"); row=await transition("submit");
    await expect(transition("approve")).rejects.toThrow();
    row=await transition("approve",reviewer._id);
    const report=await service.report();
    expect(report.capitalPathConfig).toEqual(config);
    const saved=report.records.find(x=>x.id===String(row._id));
    expect(saved.capitalPathAnalysis.state).toBe("reviewed_record_available");
    expect(saved.capitalPathAnalysis.humanDecisionRecorded).toBe(true); authority(saved.capitalPathAnalysis);
    const doc=await Record.findById(row._id); doc.capitalPathDecision.rationale="Changed after review";
    await expect(doc.validate()).rejects.toThrow("Revise changed capital path decision");
    row=await service.saveDraft({recordId:row._id,actor:owner._id,body:{version:row.__v,reason:"Revise rationale",capitalPathDecision:{...structure(),rationale:"New evidence"}}});
    expect(row.status).toBe("draft"); expect(analyze(row).humanDecisionRecorded).toBe(false);
  });
  test("other packages do not receive capital path analysis", async () => {
    await Record.create({...base(),packageKey:"CERTIFICATION-004",capitalPathDecision:undefined});
    const report=await service.report();
    expect(report.records.filter(x=>x.packageKey!=="CAPITAL-011").every(x=>x.capitalPathAnalysis===undefined)).toBe(true);
  });
});
