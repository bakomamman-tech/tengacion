import { render, screen } from "@testing-library/react";

import AutomationOrchestrationOperatingPanels from "../AutomationOrchestrationOperatingPanels";

describe("AutomationOrchestrationOperatingPanels", () => {
  it("renders governed automation, dependency, and recovery evidence", () => {
    render(<AutomationOrchestrationOperatingPanels payload={{
      summary: { roadmapPackagesComplete: 30, automationPilots: 1, activeAutomations: 0, workflowDefinitions: 1, blockingDependencies: 1, approvedResilienceObjectives: 1, orchestrationDecision: "define_or_continue_pilots" },
      roadmapPackages: [{ key: "AUTOMATION-002", title: "Risk policy", status: "COMPLETE" }, { key: "RESILIENCE-001", title: "Recovery objectives", status: "COMPLETE" }],
      automation: { summary: { registered: 1, runCount: 1, overrideRate: 0, guardrailBreaches: 0 }, entries: [{ id: "automation-1", title: "Catalog reminder", state: "pilot", riskClass: "low_risk_action", rolloutPercent: 5, executionAuthority: "checks_suggestions_or_reviewed_drafts_only" }], truthBoundary: "No causal proof." },
      orchestration: { summary: { configured: 1, defaults: 0, activeRuns: 1, staleWorkflows: 0 }, runs: [{ id: "workflow-1", workflowKey: "creator_launch_readiness", currentState: "preflight", waitingOn: "Catalog review", dependencies: [{ type: "catalog_quality", blocking: true }] }], truthBoundary: "Server-owned state." },
      resilience: { summary: { configured: 1, required: 15, approved: 1, watch: 0, blocked: 0 }, catalog: [{ key: "orchestration_state_transition", defaultRecoveryPriority: 14, defaultOwnerRole: "Workflow operations", objective: { status: "approved", recoveryPriority: 14, ownerRole: "Workflow operations" } }], truthBoundary: "Targets do not imply observed reliability." },
      readiness: { automation: { decision: "hold_or_controlled_pilot", blockers: ["automation_pilot_outcomes_not_observed"] }, orchestration: { decision: "define_or_continue_pilots", blockers: [] }, resilience: { decision: "objectives_incomplete", blockers: ["critical_flow_objectives_incomplete"] }, externalUseBoundary: "Internal only." },
    }} />);

    expect(screen.getByTestId("automation-orchestration-operating-system")).toBeInTheDocument();
    expect(screen.getByText("Automation, Orchestration & Recovery Controls")).toBeInTheDocument();
    expect(screen.getByText("Catalog reminder")).toBeInTheDocument();
    expect(screen.getByText("Creator Launch Readiness")).toBeInTheDocument();
    expect(screen.getByText("Critical-Flow Recovery Objectives")).toBeInTheDocument();
    expect(screen.getByText("Automation Pilot Outcomes Not Observed")).toBeInTheDocument();
  });

  it("keeps empty evidence explicit", () => {
    render(<AutomationOrchestrationOperatingPanels payload={{ summary: {}, automation: { summary: {}, entries: [] }, orchestration: { summary: {}, runs: [] }, resilience: { summary: {}, catalog: [] }, readiness: {} }} />);
    expect(screen.getByText(/No governed automation pilot evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/No workflow run outcome has been observed/i)).toBeInTheDocument();
  });
});
