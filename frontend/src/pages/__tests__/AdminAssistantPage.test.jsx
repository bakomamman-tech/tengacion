import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminAssistantPage from "../AdminAssistant";
import {
  adminGetAssistantEvalCandidates,
  adminGetAssistantMetrics,
  adminGetAssistantReviews,
  adminUpdateAssistantReview,
} from "../../api";

vi.mock("../../components/AdminShell", () => ({
  default: ({ title, subtitle, actions, children }) => (
    <div>
      <header>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </header>
      <div>{actions}</div>
      <main>{children}</main>
    </div>
  ),
}));

vi.mock("../../api", () => ({
  adminGetAssistantEvalCandidates: vi.fn(),
  adminGetAssistantMetrics: vi.fn(),
  adminGetAssistantReviews: vi.fn(),
  adminUpdateAssistantReview: vi.fn(),
}));

const mockAdminUser = {
  id: "admin-1",
  role: "admin",
  permissions: ["view_audit_logs"],
};

const metricsPayload = {
  alerts: [
    {
      key: "akuso_prompt_injection_attempts",
      severity: "medium",
      title: "Akuso prompt injection attempts detected",
      value: 2,
      actionPath: "/admin/assistant/metrics",
    },
  ],
  live: {
    snapshotAt: "2026-04-15T08:00:00.000Z",
    uptimeSec: 8100,
    requests: {
      chat: 12,
      hints: 4,
      feedback: 3,
      templates: 1,
    },
    policy: {
      denials: {
        total: 2,
      },
    },
    responses: {
      total: 10,
      providers: {
        openai: 6,
        local_fallback: 3,
        policy_engine: 1,
      },
    },
  },
  historical: {
    window: {
      range: "30d",
      startDate: "2026-03-16T00:00:00.000Z",
      endDate: "2026-04-15T23:59:59.000Z",
    },
    requests: {
      policyDecisions: 20,
      modelAttempts: 8,
    },
    policy: {
      buckets: {
        SAFE_ANSWER: 12,
        SAFE_WITH_CAUTION: 2,
        APP_GUIDANCE: 3,
        SENSITIVE_ACTION_REQUIRES_AUTH: 1,
        DISALLOWED: 1,
        EMERGENCY_ESCALATION: 0,
        PROMPT_INJECTION_ATTEMPT: 1,
      },
    },
    responses: {
      providers: {
        openai: 6,
        policy_engine: 1,
      },
      localFallbackReasons: {
        model_router_local: 1,
        invalid_model_payload: 1,
        openai_error: 0,
      },
      routeBreakdown: {
        template: 1,
      },
    },
    security: {
      promptInjectionAttempts: 2,
      rateLimitHits: 1,
      openAIFailures: 1,
    },
    feedback: {
      notHelpful: 1,
      report: 0,
      quality: {
        helpfulRate: 0.5,
        negativeRate: 0.25,
      },
    },
    rates: {
      denialRate: 0.1,
      localFallbackRate: 0.3,
      promptInjectionRate: 0.1,
      openAIFailureRate: 0.125,
    },
  },
  operationsReview: {
    summary: {
      purchaseAttempts: 4,
      failedPurchases: 1,
      webhookFailures: 0,
      openAssistantBacklog: 1,
      negativeFeedbackRate: 0.25,
      fallbackRate: 0.3,
    },
    lanes: [
      {
        key: "commerce_failures",
        title: "Commerce failures",
        severity: "medium",
        summary: "Payment or webhook failures need product and operations triage before new commerce expansion.",
        actionLabel: "Review transactions",
        actionPath: "/admin/transactions",
        metrics: [
          { label: "Purchase attempts", value: 4 },
          { label: "Failed purchases", value: 1 },
          { label: "Purchase failure rate", value: 0.25, format: "percent" },
        ],
      },
      {
        key: "onboarding_dropoff",
        title: "Onboarding drop-off",
        severity: "low",
        summary: "Creator onboarding completion is holding inside the selected window.",
        actionLabel: "Open analytics",
        actionPath: "/admin/analytics",
        metrics: [
          { label: "Creators started", value: 3 },
          { label: "Completion rate", value: 0.8, format: "percent" },
        ],
      },
      {
        key: "akuso_quality",
        title: "Akuso quality backlog",
        severity: "low",
        summary: "Assistant fallback, feedback, and review queue signals are under the action threshold.",
        actionLabel: "Open reviews",
        actionPath: "/admin/assistant/reviews",
        metrics: [
          { label: "Open review backlog", value: 1 },
          { label: "Negative feedback rate", value: 0.25, format: "percent" },
        ],
      },
    ],
    actions: [
      {
        type: "product_fix",
        title: "Audit failed checkouts and webhook failures",
        priority: "medium",
        owner: "Product and marketplace",
        actionPath: "/admin/transactions",
      },
      {
        type: "assistant_fix",
        title: "Promote one reviewed Akuso answer into an eval fixture",
        priority: "low",
        owner: "AI and assistant",
        actionPath: "/admin/assistant/metrics",
      },
      {
        type: "instrumentation_fix",
        title: "Confirm weekly review metrics match admin analytics snapshots",
        priority: "low",
        owner: "Infrastructure and backend",
        actionPath: "/admin/analytics",
      },
    ],
  },
  fineTuningReadiness: {
    status: "not_ready",
    recommendationTitle: "Continue prompt, eval, and grounding work",
    recommendation:
      "Fine-tuning is not justified yet. Improve prompts, retrieval, feature registry coverage, eval labels, and safety quality first.",
    summary: {
      criteriaPassed: 1,
      criteriaTotal: 5,
      labeledExamples: 4,
      stableUseCases: 0,
      openAssistantBacklog: 1,
      negativeFeedbackRate: 0.25,
      localFallbackRate: 0.3,
    },
    topUseCases: [
      {
        key: "mode:app_help",
        label: "App Help",
        count: 8,
        share: 0.4,
        source: "Akuso policy mode",
      },
    ],
    criteria: [
      {
        key: "stable_repeated_use_cases",
        title: "Stable repeated use cases",
        passed: false,
        metric: { label: "Repeated use cases", value: 0 },
        threshold: "2+ use cases with 20+ events",
        detail: "App Help is the largest observed use case.",
      },
      {
        key: "labeled_examples",
        title: "Enough labeled examples",
        passed: false,
        metric: { label: "Resolved labeled reviews", value: 4 },
        threshold: "50+ resolved reviews with decision notes",
        detail: "4 review items resolved in this window.",
      },
    ],
    blockers: [
      {
        key: "labeled_examples",
        title: "Enough labeled examples",
        nextStep: "Resolve review items with expected behavior notes and promote strong examples into eval fixtures.",
      },
    ],
  },
};

const openReview = {
  _id: "review-1",
  status: "open",
  severity: "medium",
  category: "feedback",
  mode: "app_help",
  surface: "creator_dashboard",
  reason: "The answer skipped the actual creator upload flow.",
  requestSummary: "How do I upload a song from my creator dashboard?",
  responseSummary: "Open your dashboard and use the upload tools.",
  responseId: "response-1",
  createdAt: "2026-04-15T07:45:00.000Z",
  resolutionNote: "",
  trust: {
    provider: "openai",
    mode: "app_aware",
    grounded: true,
    usedModel: true,
    confidenceLabel: "medium",
  },
  triage: {
    title: "Review the assistant answer and decide whether an eval is needed",
    nextStep: "Compare the request, response, trust signals, and user feedback before changing prompts or docs.",
    owner: "AI and assistant",
    actionType: "assistant_fix",
    priority: "medium",
  },
};

const resolvedReview = {
  ...openReview,
  status: "resolved",
  resolutionNote: "Triaged and queued for prompt tuning.",
};

const evalCandidatesPayload = {
  summary: {
    total: 1,
    highPriority: 1,
    safety: 0,
    grounding: 1,
    byCategory: { quality: 1 },
    recommendation: "Prioritize route and grounding evals before prompt tuning.",
  },
  candidates: [
    {
      reviewId: "review-1",
      status: "open",
      category: "quality",
      severity: "high",
      qualityBucket: "wrong_navigation_guidance",
      source: {
        createdAt: "2026-04-15T07:45:00.000Z",
      },
      fixtureDraft: {
        id: "feedback.feedback_app_guidance.creator_dashboard.review_1",
        name: "How do I upload a song from my creator dashboard?",
        suite: "feedback_app_guidance",
        severity: "high",
        tags: ["feedback_derived", "wrong_navigation_guidance", "surface_creator_dashboard"],
        input: {
          message: "How do I upload a song from my creator dashboard?",
          mode: "app_help",
        },
        expected: {
          needsHumanLabel: true,
          qualityBucket: "wrong_navigation_guidance",
          shouldUseCorrectRoute: true,
        },
      },
      context: {
        reason: "The answer skipped the actual creator upload flow.",
      },
    },
  ],
  fixtureDrafts: [
    {
      id: "feedback.feedback_app_guidance.creator_dashboard.review_1",
      suite: "feedback_app_guidance",
      severity: "high",
      tags: ["feedback_derived", "wrong_navigation_guidance"],
      input: {
        message: "How do I upload a song from my creator dashboard?",
        mode: "app_help",
      },
      expected: {
        needsHumanLabel: true,
        qualityBucket: "wrong_navigation_guidance",
      },
    },
  ],
};

describe("AdminAssistantPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads assistant metrics, switches to reviews, and saves a triage update", async () => {
    vi.mocked(adminGetAssistantMetrics).mockResolvedValue(metricsPayload);
    vi.mocked(adminGetAssistantEvalCandidates).mockResolvedValue(evalCandidatesPayload);
    vi.mocked(adminGetAssistantReviews)
      .mockResolvedValueOnce({
        items: [openReview],
        total: 1,
        page: 1,
        limit: 25,
        hasMore: false,
        triageSummary: {
          unresolved: 1,
          recommendation: "Work the oldest open review and capture the decision note.",
          bySeverity: { high: 0, medium: 1 },
          byCategory: { feedback: 1, quality: 0, safety: 0 },
        },
      })
      .mockResolvedValueOnce({
        items: [resolvedReview],
        total: 1,
        page: 1,
        limit: 25,
        hasMore: false,
        triageSummary: {
          unresolved: 0,
          recommendation: "No unresolved Akuso review backlog is currently blocking expansion.",
          bySeverity: {},
          byCategory: {},
        },
      });
    vi.mocked(adminUpdateAssistantReview).mockResolvedValue({
      ok: true,
      item: resolvedReview,
    });

    render(
      <MemoryRouter initialEntries={["/admin/assistant/metrics"]}>
        <Routes>
          <Route path="*" element={<AdminAssistantPage user={mockAdminUser} />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Akuso prompt injection attempts detected")).toBeInTheDocument();
    expect(screen.getByText("Live Responses")).toBeInTheDocument();
    expect(screen.getAllByText("Eval Candidates").length).toBeGreaterThan(0);
    expect(screen.getByText("Weekly Quality Loop")).toBeInTheDocument();
    expect(screen.getByText("Commerce failures")).toBeInTheDocument();
    expect(screen.getByText("Audit failed checkouts and webhook failures")).toBeInTheDocument();
    expect(screen.getByText("Fine-tuning Readiness")).toBeInTheDocument();
    expect(screen.getAllByText("Continue prompt, eval, and grounding work").length).toBeGreaterThan(0);
    expect(screen.getByText("Enough labeled examples")).toBeInTheDocument();
    expect(screen.getByText("App Help")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Reviews" }));

    expect(await screen.findByText("Review Queue")).toBeInTheDocument();
    expect(screen.getByText("Triage Focus")).toBeInTheDocument();
    expect(screen.getByText("Work the oldest open review and capture the decision note.")).toBeInTheDocument();
    expect(screen.getByText("Review the assistant answer and decide whether an eval is needed")).toBeInTheDocument();
    expect(await screen.findAllByText(openReview.requestSummary)).toHaveLength(2);

    fireEvent.change(screen.getByLabelText("Review status"), {
      target: { value: "resolved" },
    });
    fireEvent.change(screen.getByLabelText("Review category"), {
      target: { value: "quality" },
    });
    fireEvent.change(screen.getByLabelText("Review severity"), {
      target: { value: "high" },
    });
    fireEvent.change(screen.getByLabelText("Resolution note"), {
      target: { value: "Triaged and queued for prompt tuning." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Review State" }));

    await waitFor(() => {
      expect(adminUpdateAssistantReview).toHaveBeenCalledWith("review-1", {
        status: "resolved",
        category: "quality",
        severity: "high",
        resolutionNote: "Triaged and queued for prompt tuning.",
      });
    });

    expect(await screen.findByText("Assistant review updated.")).toBeInTheDocument();

    expect(adminGetAssistantReviews).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("tab", { name: "Eval Candidates" }));

    expect(await screen.findByText("Eval Candidate Bridge")).toBeInTheDocument();
    expect(screen.getByText("Prioritize route and grounding evals before prompt tuning.")).toBeInTheDocument();
    expect(screen.getByText("Candidate Reviews")).toBeInTheDocument();
    expect(screen.getByText("Fixture Drafts")).toBeInTheDocument();
    expect(screen.getAllByText("How do I upload a song from my creator dashboard?").length).toBeGreaterThan(0);
  });
});
