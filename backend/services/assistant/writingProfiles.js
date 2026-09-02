const normalizeText = (value = "", max = 200) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const WRITING_TONES = ["formal", "casual", "exciting", "premium", "inspirational", "warm", "professional", "playful"];
const WRITING_AUDIENCES = ["fans", "buyers", "investors", "general public", "students", "followers", "listeners", "readers"];
const WRITING_LENGTHS = ["short", "medium", "long"];
const WRITING_SIMPLICITY = ["basic", "standard", "advanced"];
const WRITING_CONTENT_TYPES = [
  "caption",
  "bio",
  "post",
  "article",
  "promo",
  "release",
  "podcast_summary",
  "podcast_teaser",
  "book_blurb",
  "book_launch",
  "music_launch_post",
  "product_description",
  "event_announcement",
  "fan_engagement",
  "artist_intro",
  "talent_competition",
  "rewrite",
  "summary",
  "creator_checklist",
  "campaign_copy",
  "support_navigation",
  "payout_explanation",
  "renewal_help",
  "incident_summary",
  "referral_guidance",
  "fan_lifecycle_guidance",
  "support_macro_draft",
  "cohort_summary",
  "partner_report_summary",
  "offer_setup_guidance",
  "creator_service_explanation",
  "community_loop_guidance",
  "partner_integration_summary",
  "ecosystem_finance_explanation",
  "market_readiness_guidance",
  "ecosystem_governance_summary",
  "network_program_explanation",
  "advocacy_health_summary",
  "partner_graduation_summary",
  "intelligence_summary",
  "metric_trust_explanation",
  "predictive_warning_summary",
  "automation_registry_summary",
  "automation_fired_explanation",
  "automation_pause_rollback_summary",
  "workflow_state_explanation",
  "workflow_blocker_summary",
  "approval_packet_draft",
  "orchestration_incident_handoff",
  "resilience_objective_explanation",
  "resilience_status_summary",
  "assurance_evidence_summary",
  "audit_findings_summary",
];

const normalizeWritingPreferences = (value = {}) => ({
  tone: WRITING_TONES.includes(String(value?.tone || "").trim().toLowerCase())
    ? String(value.tone).trim().toLowerCase()
    : "warm",
  audience: WRITING_AUDIENCES.includes(String(value?.audience || "").trim().toLowerCase())
    ? String(value.audience).trim().toLowerCase()
    : "general public",
  length: WRITING_LENGTHS.includes(String(value?.length || "").trim().toLowerCase())
    ? String(value.length).trim().toLowerCase()
    : "short",
  simplicity: WRITING_SIMPLICITY.includes(String(value?.simplicity || "").trim().toLowerCase())
    ? String(value.simplicity).trim().toLowerCase()
    : "standard",
  language: normalizeText(value?.language || "English", 40) || "English",
});

const buildWritingBrief = ({
  task = "draft",
  contentType = "caption",
  topic = "",
  sourceText = "",
  preferences = {},
} = {}) => {
  const normalized = normalizeWritingPreferences(preferences);
  const lines = [
    `Task: ${normalizeText(task, 40) || "draft"}`,
    `Content type: ${normalizeText(contentType, 40) || "caption"}`,
    `Tone: ${normalized.tone}`,
    `Audience: ${normalized.audience}`,
    `Length: ${normalized.length}`,
    `Simplicity: ${normalized.simplicity}`,
    `Language: ${normalized.language}`,
  ];

  if (topic) {
    lines.push(`Topic: ${normalizeText(topic, 160)}`);
  }

  if (sourceText) {
    lines.push(`Source text: ${normalizeText(sourceText, 400)}`);
  }

  return lines.join("\n");
};

const buildVariantPrefix = (tone = "warm") => {
  const map = {
    formal: "Official update",
    casual: "Quick drop",
    exciting: "Big moment",
    premium: "Premium release",
    inspirational: "Momentum update",
    warm: "Fresh update",
    professional: "Professional note",
    playful: "Fun update",
  };
  return map[String(tone || "").trim().toLowerCase()] || "Fresh update";
};

const audienceHintMap = {
  buyers: "for buyers who want a clear reason to act",
  fans: "for fans who enjoy feeling part of the journey",
  followers: "for followers who want an easy update",
  investors: "for an investor-facing audience",
  listeners: "for listeners who want a strong hook",
  readers: "for readers who care about the story and value",
  students: "in a simple, learning-friendly style",
  "general public": "for a broad public audience",
};

const lengthHintMap = {
  short: "Keep it tight and direct.",
  medium: "Give it a clear opening, a value point, and a light call to action.",
  long: "Add more scene-setting, credibility, and a stronger close.",
};

const buildAudienceTail = (audience = "general public") => audienceHintMap[audience] || audienceHintMap["general public"];

const buildLengthHint = (length = "short") => lengthHintMap[length] || lengthHintMap.short;

const buildVariants = (lines = []) =>
  lines
    .map((line) => normalizeText(line, 500))
    .filter(Boolean)
    .slice(0, 3);

const buildWritingFallbackDraft = ({
  task = "draft",
  contentType = "caption",
  topic = "",
  sourceText = "",
  preferences = {},
} = {}) => {
  const normalized = normalizeWritingPreferences(preferences);
  const cleanTopic = normalizeText(topic, 140) || "your topic";
  const cleanSource = normalizeText(sourceText, 320);
  const prefix = buildVariantPrefix(normalized.tone);
  const audienceTail = buildAudienceTail(normalized.audience);
  const lengthHint = buildLengthHint(normalized.length);

  if (task === "rewrite" && cleanSource) {
    return buildVariants([
      `${prefix}: ${cleanSource}`,
      `Cleaner version: ${cleanSource}. ${lengthHint}`,
      `Polished version: ${cleanSource}. Written ${audienceTail}.`,
    ]);
  }

  if (contentType === "creator_checklist") {
    return buildVariants([
      `Launch checklist for ${cleanTopic}: [ ] confirm profile and rights [ ] verify payout readiness [ ] review preview and price [ ] schedule announcement [ ] confirm support path.`,
      `Preflight for ${cleanTopic}: [ ] owner named [ ] audience defined [ ] success metric set [ ] rollback ready [ ] final human review complete.`,
      `Fan-readiness checklist: [ ] offer is clear [ ] entitlement is clear [ ] renewal or refund terms are visible [ ] reminder consent is respected.`,
    ]);
  }

  if (contentType === "campaign_copy") {
    return buildVariants([
      `${prefix}: ${cleanTopic}. See the preview, understand the offer, and choose whether it is right for you.`,
      `Campaign draft: ${cleanTopic} is ready ${audienceTail}. Review the details and use the official Tengacion action when you are ready.`,
      `Reminder draft: ${cleanTopic} is coming up. Save it for later or opt out of reminders at any time.`,
    ]);
  }

  if (contentType === "support_navigation") {
    return buildVariants([
      `For ${cleanTopic}, open Tengacion Help & Support, choose the closest issue type, and include the affected screen and time. Do not share passwords, OTPs, or full payment details.`,
      `Support path: review the on-screen status first, then use the built-in support form if it remains unresolved. Keep the ticket reference for follow-up.`,
      `Escalation note: describe the user-visible impact, when it started, and the safe action already tried. Leave private credentials out of the report.`,
    ]);
  }

  if (contentType === "payout_explanation") {
    return buildVariants([
      `Payout explanation for ${cleanTopic}: readiness means identity, account, balance, and review checks are complete. Akuso cannot approve or move money.`,
      `Creator-facing note: check the secure payout page for status and any required action. Never send bank credentials, passwords, or OTPs in chat.`,
      `Operations draft: explain the current payout state, the next reviewed step, and the expected update path without promising a transfer time that is not verified.`,
    ]);
  }

  if (contentType === "renewal_help") {
    return buildVariants([
      `Renewal help for ${cleanTopic}: review the membership status, renewal date, benefits, and cancellation controls on the official subscription page.`,
      `If renewal failed, use the secure payment-update flow and confirm access status afterward. Akuso will not collect payment details.`,
      `If you no longer want renewal, use the visible cancellation control; access rules and end date should remain clear before confirmation.`,
    ]);
  }

  if (contentType === "incident_summary") {
    return buildVariants([
      `Incident draft — ${cleanTopic}. Status: investigating. User impact: confirm scope. Mitigation: record the safe action in progress. Next update: add a verified time.`,
      `Operations summary — ${cleanTopic}. Include start time, affected surface, owner, current state, rollback, and ticket. Exclude private user and payment data.`,
      `Resolved-summary draft — ${cleanTopic}. State what users experienced, what restored service, remaining follow-up, and the next evidence review without assigning unverified blame.`,
    ]);
  }

  if (contentType === "referral_guidance") {
    return buildVariants([
      `Referral guidance for ${cleanTopic}: create a Tengacion share link, use the intended creator, content, campaign, partner, fan, or live source, and review only aggregate activation results.`,
      `Privacy note: creators and partners may see aggregate opens and milestones, never private fan-level behavior or identity rows.`,
      `Trust reminder: avoid aggressive incentives, hidden tracking claims, or repeated prompts; consent, complaints, and frequency limits remain active.`,
    ]);
  }

  if (contentType === "fan_lifecycle_guidance") {
    return buildVariants([
      `Fan lifecycle guidance for ${cleanTopic}: use the current relationship stage, freshness, consent, complaint, and frequency state before suggesting a return path.`,
      `Support note: an at-risk fan should receive recovery or support guidance, not a promotional prompt.`,
      `Privacy note: explain aggregate relationship movement without revealing an individual fan's private actions.`,
    ]);
  }

  if (contentType === "support_macro_draft") {
    return buildVariants([
      `Support draft for ${cleanTopic}: confirm the visible status, state the safe next step, preserve the ticket reference, and escalate to the accountable queue when evidence is incomplete.`,
      `Review boundary: this is a draft from approved support guidance; a support operator owns the final reply and escalation decision.`,
      `Privacy boundary: exclude passwords, OTPs, full payment data, private content, and unnecessary identity details.`,
    ]);
  }

  if (contentType === "cohort_summary") {
    return buildVariants([
      `Cohort summary for ${cleanTopic}: state the thesis, launch gates, acquisition source, creator and fan activation, retention, commerce, support, moderation, reliability, and stop-condition evidence.`,
      `Decision draft: choose expand, repeat with changes, hold, or exit, and identify missing attribution before recommending growth.`,
      `Evidence note: separate zero activity from missing instrumentation and cite the operating metrics used.`,
    ]);
  }

  if (contentType === "partner_report_summary") {
    return buildVariants([
      `Partner-safe summary for ${cleanTopic}: use aggregate campaign, creator, commerce, support, moderation, and reliability measures from the approved report contract.`,
      `Exclude user identifiers, payment details, private content, safety-case details, and Akuso memory from the report.`,
      `Renewal draft: state goals, outcomes, incidents, risks, and the next bounded offer without unsupported audience or impact claims.`,
    ]);
  }

  if (contentType === "offer_setup_guidance") {
    return buildVariants([
      `Offer setup for ${cleanTopic}: choose a paid drop, bundle, subscription package, live event pass, or marketplace spotlight from the creator launch planner.`,
      `Readiness checklist: confirm metadata, cover and preview, price, payout readiness, fan update plan, success metric, stop condition, and required review.`,
      `Authority note: Akuso may explain or draft but cannot approve finance, campaign, live, marketplace, moderation, or public publication decisions.`,
    ]);
  }

  if (contentType === "creator_service_explanation") {
    return buildVariants([
      `Creator service explanation for ${cleanTopic}: confirm eligibility, creator commitment, owner, required evidence, expected outcome, metric, graduation condition, review date, and escalation path.`,
      `Claims boundary: describe only the defined service and stored outcome evidence; do not promise reach, earnings, approval, or a result that has not been observed.`,
      `Commercial boundary: basic support and premium service terms remain explicit, and enrollment requires the creator's recorded consent.`,
    ]);
  }

  if (contentType === "community_loop_guidance") {
    return buildVariants([
      `Community loop guidance for ${cleanTopic}: state the qualifying action, primary metric, notification cap, complaint and opt-out guardrails, ignored-prompt limit, abuse checks, stop condition, and review date.`,
      `Privacy boundary: use aggregate relationship movement and never reveal private fan rows, identity, messages, or behavior.`,
      `Trust boundary: consent, suppression, complaint, report, refund, creator-trust, and frequency controls can pause the loop at any time.`,
    ]);
  }

  if (contentType === "partner_integration_summary") {
    return buildVariants([
      `Partner integration summary for ${cleanTopic}: state the requested access level, allowlisted aggregate data, prohibited data, approval owner, creator-consent state, expiry, revocation path, audit event, and renewal review.`,
      `Privacy boundary: exclude payment identifiers, private user behavior, identity verification data, moderation-sensitive detail, and Akuso memory.`,
      `Authority note: API-candidate status is a proposal only; Akuso cannot grant access, generate an export, approve a sponsor, or publish an external report.`,
    ]);
  }

  if (contentType === "ecosystem_finance_explanation") {
    return buildVariants([
      `Ecosystem finance explanation for ${cleanTopic}: separate creator commerce, service-program cost, campaign, partner, sponsor, market, acquisition, payment-fee, refund, dispute, payout, support, infrastructure, and model-cost evidence.`,
      `Evidence boundary: label missing share rates and cost proxies as instrumentation gaps and never replace them with invented assumptions.`,
      `Authority note: operating views require ledger reconciliation before finance, partner, investor, or public use; Akuso cannot approve, refund, pay, or move money.`,
    ]);
  }

  if (contentType === "market_readiness_guidance") {
    return buildVariants([
      `Market readiness guidance for ${cleanTopic}: review payment, payout, creator supply, fan demand, support, moderation, rights, partner, low-bandwidth, and data/privacy gates with evidence, owners, a cost cap, stop condition, and review date.`,
      `Decision boundary: research, seed, hold, and exit are valid states; controlled launch or growth requires every gate and recorded human approval.`,
      `Akuso may summarize missing evidence but cannot approve a market, partner, payment path, rights process, or expansion decision.`,
    ]);
  }

  if (contentType === "ecosystem_governance_summary") {
    return buildVariants([
      `Governance summary for ${cleanTopic}: identify the owner, decision, reviewed evidence, independent approvers, change history, expiry, follow-up, stop condition, and rollback path.`,
      `Automation boundary: checks may flag stale approvals, privacy gaps, risk spikes, or eval regressions, but a human owns every high-risk disposition.`,
      `External-output boundary: partner, finance, investor, public, moderation-impacting, and market-launch text remains a draft until an authorized reviewer approves it.`,
    ]);
  }

  if (contentType === "network_program_explanation") {
    return buildVariants([
      `Network program explanation for ${cleanTopic}: state the creator benefit, commitment, consent state, owner, collaborator or provider scope, baseline, success metric, stop condition, review date, and withdrawal path.`,
      `Outcome boundary: separate creator, collaborator, provider, partner, campaign, and community effects; report only stored evidence and never promise incremental earnings.`,
      `Finance boundary: purchases, creator earnings, fees, refunds, payouts, and settlements remain attributable to the ledger; Akuso cannot enroll a creator or move money.`,
    ]);
  }

  if (contentType === "advocacy_health_summary") {
    return buildVariants([
      `Advocacy health summary for ${cleanTopic}: report aggregate opt-in participation, movement, referral totals, campaign performance, frequency, ignored prompts, complaints, abuse, refund or dispute, and suppression state.`,
      `Privacy boundary: never reveal fan identities, messages, payment details, private behavior, or sensitive-category inference.`,
      `Control boundary: a creator or operator can pause by creator, cohort, surface, or loop type; Akuso may explain a hold but cannot send a message or activate a loop.`,
    ]);
  }

  if (contentType === "partner_graduation_summary") {
    return buildVariants([
      `Partner graduation summary for ${cleanTopic}: show the current and proposed access level plus reviewed data-contract, consent, privacy, security, audit, revocation, retention, finance, reliability, rate-limit, rollback, and renewal gates.`,
      `Approval boundary: commercial enthusiasm and API-candidate status grant no export, dashboard, sponsor, campaign, credential, or API access.`,
      `Data boundary: exclude private fan behavior, payment identifiers, identity verification, moderation-sensitive detail, and unsupported or unreconciled claims.`,
    ]);
  }

  if (contentType === "intelligence_summary") {
    return buildVariants([
      `Intelligence summary for ${cleanTopic}: cite the source, observation timeframe, confidence, limitations, metric trust state, intended audience, and optional reversible action.`,
      `Trust boundary: stale, disputed, blocked, or withdrawn metrics remain visible warnings and cannot silently drive a recommendation.`,
      `Privacy and authority boundary: do not infer private fan behavior or approve pricing, payout, moderation, partner, API, publication, or automation decisions.`,
    ]);
  }

  if (contentType === "metric_trust_explanation") {
    return buildVariants([
      `Metric trust explanation for ${cleanTopic}: name the owner, source authority, calculation, freshness window, limitations, privacy class, permitted decisions, export policy, and current trust reason.`,
      `A trusted label requires current observed evidence; watch, stale, disputed, blocked, or withdrawn contracts cannot drive a governed decision.`,
      `Akuso may explain the recorded state but cannot repair, reconcile, reclassify, or approve the metric contract.`,
    ]);
  }

  if (contentType === "predictive_warning_summary") {
    return buildVariants([
      `Predictive warning for ${cleanTopic}: state the source metrics, observation time, confidence, possible impact, accountable owner, runbook, review path, rollback path, and next human check.`,
      `Evidence boundary: this is a hypothesis, not a confirmed incident, and false-positive or missed-incident review remains required.`,
      `Authority note: Akuso cannot restrict an account, change payout or entitlement state, remove content, contact users, or execute the runbook.`,
    ]);
  }

  if (contentType === "automation_registry_summary") {
    return buildVariants([
      `Automation registry summary for ${cleanTopic}: state the owner, affected actor, trigger, input signals, proposed action, risk, approval requirement, audit event, visible status, pause control, rollback, success metric, guardrails, review cadence, and registry state.`,
      `AUTOMATION-001 is a registry only: proposed, designed, or review-required records grant no pilot or active execution authority.`,
      `Akuso may describe the candidate but cannot approve it, activate it, conceal that it is suggested or manual, or perform the action.`,
    ]);
  }

  if (contentType === "automation_fired_explanation") {
    return buildVariants([
      `Automation explanation for ${cleanTopic}: identify the recorded trigger, authoritative source signals, observation time, confidence, owner, bounded action or suggestion, visible status, next review, and available user controls.`,
      `Review boundary: checks may validate or route repeated work, but payouts, refunds, account restrictions, takedowns, partner or API access, settlements, sponsored launches, and public copy remain human-approved.`,
      `Evidence boundary: report stored outcomes, overrides, complaints, support impact, cost, and guardrails without claiming the automation caused a result.`,
    ]);
  }

  if (contentType === "automation_pause_rollback_summary") {
    return buildVariants([
      `Automation pause or rollback summary for ${cleanTopic}: state the detection signal, owner, pause trigger, rollback path, affected users, support copy, incident link, and next human review.`,
      `Keep paused, rolled-back, and retired state visible; do not imply the workflow is active or corrected until the authoritative registry and incident review say so.`,
      `Akuso may summarize the record but cannot pause, reactivate, roll back, contact users, or change a metric contract.`,
    ]);
  }

  if (contentType === "workflow_state_explanation") {
    return buildVariants([
      `Workflow state explanation for ${cleanTopic}: cite the server-owned state, start trigger, current owner, participant teams, passed and blocking dependencies, approval status, waiting party, next safe step, support path, and safe timing.`,
      `Progression boundary: pending, failed, stale, or expired dependencies stop the workflow visibly; sensitive transitions require recorded human approval.`,
      `External-status boundary: omit private risk details, private fan behavior, restricted partner data, and internal security evidence.`,
    ]);
  }

  if (contentType === "workflow_blocker_summary") {
    return buildVariants([
      `Workflow blocker summary for ${cleanTopic}: list each dependency type, source system, owner, evidence state, stale condition, escalation path, user-visible copy, and the next review time.`,
      `Override boundary: an override is exceptional and requires a named requester, approver, reason, audit event, decision time, and expiration; an expired override blocks progression again.`,
      `Akuso can explain a blocker or draft an escalation note but cannot pass, override, or bypass the dependency.`,
    ]);
  }

  if (contentType === "approval_packet_draft") {
    return buildVariants([
      `Approval packet draft for ${cleanTopic}: summarize required evidence, dependency health, automation checks, human review gates, owner recommendation, privacy and consent posture, finance and trust caveats, rollback readiness, and expiry.`,
      `Decision boundary: label this as a draft and leave approval, rejection, access, money movement, moderation, rights, publication, and launch transitions to the authorized reviewer.`,
      `Audit boundary: cite stored records and missing evidence; never invent an approval, reviewer, reconciliation result, or completed check.`,
    ]);
  }

  if (contentType === "orchestration_incident_handoff") {
    return buildVariants([
      `Incident handoff for ${cleanTopic}: state current workflow state, detection signal, affected dependencies, owner, severity if recorded, pause status, rollback status, user impact, support path, and next review.`,
      `Recovery boundary: preserve the last valid server-owned state and make missing, stale, disputed, or replayed evidence explicit.`,
      `Akuso may draft the handoff and correction summary but cannot declare recovery, modify workflow state, execute rollback, or publish an external incident update.`,
    ]);
  }

  if (contentType === "resilience_objective_explanation") {
    return buildVariants([
      `Resilience objective for ${cleanTopic}: state the critical flow, owner, measurement source, availability or latency target, error budget, maximum downtime, maximum data delay, special entitlement, payout, or partner delay where relevant, recovery priority, pause trigger, rollback trigger, and review date.`,
      `Measurement boundary: a configured SLO or recovery objective is a target, not proof of current reliability; cite observed telemetry separately.`,
      `Akuso may explain recovery order and draft incident communication but cannot change an SLO, spend an error budget, declare recovery, or override the incident commander.`,
    ]);
  }

  if (contentType === "resilience_status_summary") {
    return buildVariants([
      `Resilience status for ${cleanTopic}: cite the incident source, severity, affected surface, user impact, degraded mode, current mitigation, accountable owner, rollback option, support path, and next verified update.`,
      `Recovery boundary: a planned drill, configured objective, or mitigation in progress is not proof of recovery; use stored completion evidence and human review before changing status.`,
      `Privacy and authority boundary: keep internal risk and restricted evidence private; Akuso cannot command the incident, pause or restore a workflow, execute rollback, or publish an external update.`,
    ]);
  }

  if (contentType === "assurance_evidence_summary") {
    return buildVariants([
      `Assurance evidence summary for ${cleanTopic}: state the control owner and reviewer, source systems, evidence freshness, current exceptions, reconciliation state, incidents, impact, readiness, approval shelf life, and next review.`,
      `Sharing boundary: stale, delayed, disputed, blocked, withdrawn, restricted, or unreviewed evidence cannot support an external assurance claim.`,
      `Decision boundary: Akuso may draft the packet and highlight missing evidence but cannot approve a gate, accept an exception, grant access, move money, or make a legal, rights, privacy, or moderation decision.`,
    ]);
  }

  if (contentType === "audit_findings_summary") {
    return buildVariants([
      `Audit summary for ${cleanTopic}: report domains tested, sample method and size, pass, observation, fail, and not-testable counts, high-risk findings, evidence quality, owners, due dates, retest state, and external-readiness limits.`,
      `Closure boundary: an owner statement is not closure; a failed control requires remediation evidence and an independent retest, while accepted risk requires approval, expiry, a compensating control, and a review trigger.`,
      `Disclosure boundary: keep restricted findings and sample evidence internal; Akuso cannot change a result, close a finding, accept risk, certify a control, or publish an external audit opinion.`,
    ]);
  }

  if (contentType === "summary") {
    return buildVariants([
      `${prefix}: ${cleanTopic} explained in a clear, simple way.`,
      `${cleanTopic} matters because it is practical, easy to follow, and relevant ${audienceTail}.`,
      `Short summary: ${cleanTopic}, with the main idea, the key takeaway, and what comes next.`,
    ]);
  }

  if (contentType === "bio") {
    return buildVariants([
      `I create around ${cleanTopic} and share work that feels thoughtful, clear, and consistent ${audienceTail}.`,
      `Building a strong voice around ${cleanTopic}, with content, stories, and updates people can connect with.`,
      `${cleanTopic} creator focused on clarity, consistency, and real audience connection.`,
    ]);
  }

  if (contentType === "article") {
    return buildVariants([
      `${prefix}: ${cleanTopic} explained with context, practical insight, and a clear next step. ${lengthHint}`,
      `Article angle: what ${cleanTopic} is, why it matters now, and what your audience should understand first.`,
      `${cleanTopic} deserves an article that feels grounded, easy to follow, and useful after the first read.`,
    ]);
  }

  if (contentType === "book_blurb" || contentType === "book_launch") {
    return buildVariants([
      `${prefix}: ${cleanTopic} opens with a strong promise and gives readers a reason to stay to the final page.`,
      `Book launch copy: ${cleanTopic} is here with a clear hook, emotional pull, and a voice readers can remember.`,
      `Reader-facing line: if you want a book that feels thoughtful, vivid, and engaging, ${cleanTopic} is ready for you.`,
    ]);
  }

  if (contentType === "podcast_summary" || contentType === "podcast_teaser") {
    return buildVariants([
      `${prefix}: This episode dives into ${cleanTopic} with a clear angle, strong takeaway, and easy listening flow.`,
      `Podcast teaser: tune in for a practical, honest conversation about ${cleanTopic}.`,
      `Listener-facing line: if ${cleanTopic} matters to you, this episode is worth your time.`,
    ]);
  }

  if (contentType === "release" || contentType === "music_launch_post") {
    return buildVariants([
      `${prefix}: ${cleanTopic} is out now. Press play, share it, and step into the moment with me.`,
      `Launch post: ${cleanTopic} is finally live, carrying the energy, story, and sound I wanted to share with you.`,
      `Fan line: ${cleanTopic} is for everyone who has been waiting for something fresh, honest, and memorable.`,
    ]);
  }

  if (contentType === "promo" || contentType === "product_description") {
    return buildVariants([
      `${prefix}: ${cleanTopic} is ready ${audienceTail}, with a clear value and an easy reason to act.`,
      `Promo copy: ${cleanTopic} is built to catch attention quickly and convert that attention into action.`,
      `Product line: ${cleanTopic} brings a polished offer, strong clarity, and a confident call to action.`,
    ]);
  }

  if (contentType === "event_announcement" || contentType === "talent_competition") {
    return buildVariants([
      `${prefix}: ${cleanTopic} is happening soon, and this is your moment to show up early and be part of it.`,
      `Event announcement: ${cleanTopic} is open, active, and designed to bring the right people into one strong moment.`,
      `Public invite: if you care about ${cleanTopic}, save the date, spread the word, and come ready.`,
    ]);
  }

  if (contentType === "fan_engagement") {
    return buildVariants([
      `${prefix}: I want to hear from you. What has ${cleanTopic} meant to you lately?`,
      `Fan prompt: drop your thoughts on ${cleanTopic}, tag someone who should see this, and let us build the conversation together.`,
      `Community line: your voice matters here, so tell me what you think about ${cleanTopic}.`,
    ]);
  }

  if (contentType === "artist_intro") {
    return buildVariants([
      `${prefix}: Meet a creator shaping space around ${cleanTopic} with intention, originality, and a clear voice.`,
      `Artist intro: ${cleanTopic} is part of a wider creative journey built on craft, consistency, and connection.`,
      `Introduction line: this creator brings ${cleanTopic} to the audience with confidence and personality.`,
    ]);
  }

  if (contentType === "post") {
    return buildVariants([
      `${prefix}: ${cleanTopic}. ${lengthHint}`,
      `Post idea: ${cleanTopic}, told with a clear point, simple value, and a reason people will engage.`,
      `Community post: ${cleanTopic} is worth sharing, discussing, and bringing into the timeline today.`,
    ]);
  }

  return buildVariants([
    `${prefix}: ${cleanTopic}.`,
    `Version 2: ${cleanTopic}, written ${audienceTail}.`,
    `Version 3: ${cleanTopic}, in a ${normalized.tone} tone with ${normalized.length} pacing.`,
  ]);
};

module.exports = {
  WRITING_AUDIENCES,
  WRITING_CONTENT_TYPES,
  WRITING_LENGTHS,
  WRITING_SIMPLICITY,
  WRITING_TONES,
  buildWritingBrief,
  buildWritingFallbackDraft,
  normalizeWritingPreferences,
};
