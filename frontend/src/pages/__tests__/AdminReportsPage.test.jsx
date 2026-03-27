import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminReportsPage from "../AdminReports";
import {
  fetchModerationCase,
  fetchModerationCases,
  fetchModerationReviewUrl,
  fetchModerationStats,
  fetchModerationUploader,
  scanRecentMedia,
  scanSearchMatches,
  applyModerationCaseAction,
  banUser,
  suspendUser,
  unbanUser,
  unsuspendUser,
  forceLogoutUser,
} from "../../services/adminModerationService";

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

vi.mock("../../services/adminModerationService", () => ({
  fetchModerationStats: vi.fn(),
  fetchModerationCases: vi.fn(),
  fetchModerationCase: vi.fn(),
  fetchModerationUploader: vi.fn(),
  fetchModerationReviewUrl: vi.fn(),
  applyModerationCaseAction: vi.fn(),
  scanRecentMedia: vi.fn(),
  scanSearchMatches: vi.fn(),
  banUser: vi.fn(),
  suspendUser: vi.fn(),
  unbanUser: vi.fn(),
  unsuspendUser: vi.fn(),
  forceLogoutUser: vi.fn(),
}));

const mockAdminUser = {
  id: "admin-1",
  role: "super_admin",
  email: "admin@tengacion.com",
};

const moderationCase = {
  _id: "case-1",
  queue: "explicit_pornography",
  status: "pending",
  workflowState: "OPEN",
  severity: "HIGH",
  priorityScore: 92,
  riskLabels: ["explicit_pornography", "xxx"],
  createdAt: "2026-03-26T09:00:00.000Z",
  updatedAt: "2026-03-26T09:05:00.000Z",
  detectionSource: "automated_upload_scan",
  publicWarningLabel: "Sensitive content under review",
  uploader: {
    userId: "user-1",
    email: "uploader@example.com",
    username: "uploader",
    displayName: "Uploader One",
  },
  subject: {
    targetType: "post",
    targetId: "post-1",
    title: "Queued explicit image",
    description: "Queued explicit image",
    mediaType: "image",
    createdAt: "2026-03-26T08:55:00.000Z",
  },
  media: [
    {
      role: "primary",
      mediaId: "media-1",
      mediaType: "image",
      mimeType: "image/jpeg",
      sourceUrl: "https://cdn.test/media/explicit.jpg",
      previewUrl: "https://cdn.test/media/explicit.jpg",
      restrictedPreviewUrl: "https://cdn.test/media/blurred-explicit.jpg",
      originalFilename: "explicit.jpg",
      fileSizeBytes: 123,
    },
  ],
  quarantine: {
    isQuarantined: true,
    quarantinedAt: "2026-03-26T09:00:00.000Z",
    neverGeneratePreview: false,
  },
  escalation: {
    required: false,
    status: "not_required",
    escalatedAt: null,
  },
  reviewedBy: null,
  reviewedAt: null,
  reviewerNote: "Pending explicit review",
  internalNotes: "Pending explicit review",
  evidence: {
    preservedAt: null,
    notes: "",
  },
  linkedReportsCount: 2,
  latestDecisionSummary: {
    actionType: "pending",
    adminUserId: null,
    adminEmail: "uploader@example.com",
    previousStatus: "pending",
    newStatus: "pending",
    reason: "Pending explicit review",
    decidedAt: null,
  },
  availableActions: [
    "approve",
    "restore_content",
    "hold_for_review",
    "reject",
    "delete_media",
    "restrict_with_warning",
    "blur_preview",
    "preserve_evidence",
    "escalate_case",
    "suspend_user",
    "ban_user",
  ],
};

const uploaderPayload = {
  user: {
    _id: "user-1",
    displayName: "Uploader One",
    username: "uploader",
    email: "uploader@example.com",
    role: "user",
    isActive: true,
    isBanned: false,
    isSuspended: false,
    suspendedAt: null,
    suspendedUntil: null,
    suspensionReason: "",
    bannedAt: null,
    banReason: "",
    createdAt: "2026-03-26T08:00:00.000Z",
    lastLoginAt: null,
    moderationProfile: {},
  },
  strike: {
    count: 2,
    lastActionAt: "2026-03-26T09:00:00.000Z",
    lastActionType: "warning",
    lastSeverity: "medium",
    lastEnforcementAction: "warning",
  },
  moderationCaseCount: 3,
};

const statsPayload = {
  pendingReview: 1,
  blockedExplicit: 4,
  suspectedCsam: 2,
  restrictedGore: 1,
  animalCruelty: 1,
  repeatViolators: 1,
  repeatViolatorThreshold: 5,
};

const queuePayload = {
  page: 1,
  limit: 12,
  total: 1,
  cases: [moderationCase],
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/admin/reports"]}>
      <Routes>
        <Route path="/admin/reports" element={<AdminReportsPage user={mockAdminUser} />} />
      </Routes>
    </MemoryRouter>
  );

describe("AdminReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(fetchModerationStats).mockResolvedValue(statsPayload);
    vi.mocked(fetchModerationCases).mockResolvedValue(queuePayload);
    vi.mocked(fetchModerationCase).mockResolvedValue(moderationCase);
    vi.mocked(fetchModerationUploader).mockResolvedValue(uploaderPayload);
    vi.mocked(fetchModerationReviewUrl).mockResolvedValue({ url: "https://review.test/case-1" });
    vi.mocked(applyModerationCaseAction).mockResolvedValue({ success: true });
    vi.mocked(scanRecentMedia).mockResolvedValue({
      scannedCount: 2,
      approvedCount: 1,
      blockedCount: 1,
      reviewCount: 0,
      restrictedCount: 0,
      flaggedCount: 1,
      cases: [moderationCase],
    });
    vi.mocked(scanSearchMatches).mockResolvedValue({
      scannedCount: 2,
      approvedCount: 1,
      blockedCount: 1,
      reviewCount: 0,
      restrictedCount: 0,
      flaggedCount: 1,
      cases: [moderationCase],
    });
    vi.mocked(banUser).mockResolvedValue({ success: true });
    vi.mocked(suspendUser).mockResolvedValue({ success: true });
    vi.mocked(unbanUser).mockResolvedValue({ success: true });
    vi.mocked(unsuspendUser).mockResolvedValue({ success: true });
    vi.mocked(forceLogoutUser).mockResolvedValue({ success: true });
  });

  it("filters and refreshes the existing moderation queue", async () => {
    renderPage();

    await screen.findByText("Queued explicit image");
    expect(fetchModerationStats).toHaveBeenCalledTimes(1);
    expect(fetchModerationCases).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 12,
        queue: "",
        status: "",
        search: "",
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Explicit Porn" }));
    await waitFor(() =>
      expect(fetchModerationCases).toHaveBeenLastCalledWith(
        expect.objectContaining({
          queue: "explicit_pornography",
          status: "",
          search: "",
        })
      )
    );

    const searchInput = screen.getByPlaceholderText("Search uploads, uploader, filename, or moderation reason");
    fireEvent.change(searchInput, { target: { value: "Pending explicit" } });

    await waitFor(() =>
      expect(fetchModerationCases).toHaveBeenLastCalledWith(
        expect.objectContaining({
          queue: "explicit_pornography",
          status: "",
          search: "Pending explicit",
        })
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset Filters" }));

    await waitFor(() =>
      expect(fetchModerationCases).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 12,
          queue: "",
          status: "",
          search: "",
        })
      )
    );

    vi.mocked(fetchModerationStats).mockClear();
    vi.mocked(fetchModerationCases).mockClear();
    vi.mocked(fetchModerationCase).mockClear();
    vi.mocked(fetchModerationUploader).mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(fetchModerationStats).toHaveBeenCalledTimes(1));
    expect(fetchModerationCases).toHaveBeenCalledWith(
      expect.objectContaining({
        queue: "",
        status: "",
        search: "",
      })
    );
    expect(fetchModerationCase).toHaveBeenCalledWith("case-1");
    expect(fetchModerationUploader).toHaveBeenCalledWith("case-1");
  }, 15000);

  it("enables the scan buttons and sends the search term to the backend", async () => {
    renderPage();

    await screen.findByText("Queued explicit image");

    const scanRecentButton = screen.getByRole("button", { name: "Scan Recent Media" });
    const scanSearchButton = screen.getByRole("button", { name: "Scan Search Matches" });
    const searchInput = screen.getByPlaceholderText("Search uploads, uploader, filename, or moderation reason");

    expect(scanSearchButton).toBeDisabled();
    expect(scanRecentMedia).not.toHaveBeenCalled();
    expect(scanSearchMatches).not.toHaveBeenCalled();

    fireEvent.change(searchInput, { target: { value: "Search Match Person" } });
    await waitFor(() =>
      expect(fetchModerationCases).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: "Search Match Person",
        })
      )
    );
    await waitFor(() => expect(scanSearchButton).toBeEnabled());

    fireEvent.click(scanSearchButton);
    await waitFor(() =>
      expect(scanSearchMatches).toHaveBeenCalledWith({
        search: "Search Match Person",
        limit: 12,
      })
    );

    fireEvent.click(scanRecentButton);
    await waitFor(() =>
      expect(scanRecentMedia).toHaveBeenCalledWith({
        limit: 12,
      })
    );
  }, 15000);
});
