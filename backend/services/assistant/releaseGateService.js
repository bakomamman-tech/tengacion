const crypto = require("crypto");

const AssistantReviewItem = require("../../models/AssistantReviewItem");
const { EVAL_SCENARIOS, runAkusoEvals } = require("../akusoEvalRunner");
const { FEATURE_REGISTRY } = require("./featureRegistry");

const buildCheck = ({ key, label, passed, detail, blocking = true } = {}) => ({
  key,
  label,
  passed: Boolean(passed),
  blocking: Boolean(blocking),
  detail: String(detail || ""),
});

const buildStaticAkusoReleaseGate = ({ includeChecks = false } = {}) => {
  const results = runAkusoEvals({ includeChecks });
  const summary = results.summary || {};
  const registeredFeatures = new Set(FEATURE_REGISTRY.map((feature) => feature.id));
  const expectedFeatureKeys = Array.from(
    new Set(EVAL_SCENARIOS.map((scenario) => scenario.expected?.featureKey).filter(Boolean))
  );
  const missingRegistryEntries = expectedFeatureKeys.filter((key) => !registeredFeatures.has(key));
  const groundingFailures = results.filter(
    (result) => result.tags?.includes("feature_grounding") && !result.passed
  );
  const commerceFailures = results.filter(
    (result) => result.suite === "commerce" && !result.passed
  );
  const fallbackScenarioIds = new Set(
    EVAL_SCENARIOS.filter((scenario) => scenario.expected?.modelTask === "local_fallback")
      .map((scenario) => scenario.id)
  );
  const fallbackFailures = results.filter(
    (result) => fallbackScenarioIds.has(result.id) && !result.passed
  );
  const reportSeed = JSON.stringify({
    total: summary.total,
    passed: summary.passed,
    failed: summary.failed,
    failedCritical: summary.failedCritical,
    failedRouteTargets: summary.failedRouteTargets,
    scenarios: results.map((result) => ({
      id: result.id,
      passed: result.passed,
      failures: result.failures || [],
    })),
    registry: Array.from(registeredFeatures).sort(),
  });

  return {
    reportId: `akuso-gate-${crypto.createHash("sha256").update(reportSeed).digest("hex").slice(0, 16)}`,
    generatedAt: new Date().toISOString(),
    eval: {
      total: Number(summary.total || 0),
      passed: Number(summary.passed || 0),
      failed: Number(summary.failed || 0),
      passRate: Number(summary.passRate || 0),
      failedCritical: Number(summary.failedCritical || 0),
      routeTargets: summary.routeTargets || [],
      failedRouteTargets: summary.failedRouteTargets || [],
      failedScenarios: summary.failedScenarios || [],
    },
    coverage: {
      registryEntries: registeredFeatures.size,
      evalReferencedFeatures: expectedFeatureKeys.length,
      missingRegistryEntries,
      groundingFailures: groundingFailures.map((result) => result.id),
      commerceFailures: commerceFailures.map((result) => result.id),
      fallbackFailures: fallbackFailures.map((result) => result.id),
    },
    checks: [
      buildCheck({
        key: "eval_report_generated",
        label: "Eval report generated",
        passed: true,
        detail: `${Number(summary.passed || 0)} of ${Number(summary.total || 0)} scenarios passed.`,
      }),
      buildCheck({
        key: "critical_safety",
        label: "No critical safety failures",
        passed: Number(summary.failedCritical || 0) === 0,
        detail: `${Number(summary.failedCritical || 0)} critical failures.`,
      }),
      buildCheck({
        key: "route_targets",
        label: "Route targets meet release thresholds",
        passed: !summary.failedRouteTargets?.length,
        detail: `${Number(summary.failedRouteTargets?.length || 0)} route targets failed.`,
      }),
      buildCheck({
        key: "feature_grounding",
        label: "Feature claims stay grounded",
        passed: groundingFailures.length === 0 && missingRegistryEntries.length === 0,
        detail: `${groundingFailures.length} grounding failures and ${missingRegistryEntries.length} missing registry entries.`,
      }),
      buildCheck({
        key: "commerce_guidance",
        label: "Payment and payout guidance is supported",
        passed: commerceFailures.length === 0,
        detail: `${commerceFailures.length} commerce scenarios failed.`,
      }),
      buildCheck({
        key: "fallback_quality",
        label: "Policy fallback behavior is verified",
        passed: fallbackFailures.length === 0,
        detail: `${fallbackFailures.length} fallback scenarios failed.`,
      }),
    ],
  };
};

const buildAkusoReleaseGate = async ({ includeChecks = false } = {}) => {
  const report = buildStaticAkusoReleaseGate({ includeChecks });
  const [unresolvedReviews, unresolvedHighSeverity, unresolvedHighRisk] = await Promise.all([
    AssistantReviewItem.countDocuments({ status: { $in: ["open", "under_review"] } }),
    AssistantReviewItem.countDocuments({
      status: { $in: ["open", "under_review"] },
      severity: "high",
    }),
    AssistantReviewItem.countDocuments({
      status: { $in: ["open", "under_review"] },
      severity: "high",
      category: { $in: ["safety", "abuse"] },
    }),
  ]);
  report.reviewBacklog = {
    checked: true,
    unresolved: Number(unresolvedReviews || 0),
    highSeverity: Number(unresolvedHighSeverity || 0),
    highRisk: Number(unresolvedHighRisk || 0),
  };
  report.checks.push(
    buildCheck({
      key: "review_backlog",
      label: "Critical review backlog checked",
      passed: Number(unresolvedHighRisk || 0) === 0,
      detail: `${Number(unresolvedHighRisk || 0)} unresolved high-risk reviews; ${Number(unresolvedReviews || 0)} unresolved overall.`,
    })
  );
  const blockingFailures = report.checks.filter((check) => check.blocking && !check.passed);
  report.decision = blockingFailures.length ? "blocked" : unresolvedReviews > 0 ? "review" : "ready";
  report.releaseReady = blockingFailures.length === 0;
  report.blockers = blockingFailures.map((check) => check.label);
  report.command = "npm run gate:akuso-release --prefix backend";
  report.attachmentGuidance = "Attach the generated JSON report to the deployment or pull-request evidence before shipping an Akuso change.";
  return report;
};

module.exports = {
  buildAkusoReleaseGate,
  buildStaticAkusoReleaseGate,
};
