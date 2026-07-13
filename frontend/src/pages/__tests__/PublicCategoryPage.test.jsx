import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PublicCategoryPage from "../PublicCategoryPage";
import { getCreatorSummaryFeed } from "../../api";

const { openPreviewMock } = vi.hoisted(() => ({
  openPreviewMock: vi.fn(),
}));

vi.mock("../../api", () => ({
  getCreatorSummaryFeed: vi.fn(),
  resolveImage: (value) => value,
}));

vi.mock("../../context/CreatorPlayerContext", () => ({
  useCreatorPlayer: () => ({ openPreview: openPreviewMock }),
}));

vi.mock("../../components/creatorDiscovery/CreatorSummaryFeed", () => ({
  default: () => <div data-testid="creator-summary-feed">Summary feed</div>,
}));

vi.mock("../../components/seo/SeoHead", () => ({
  default: () => null,
}));

vi.mock("../../lib/seo", () => ({
  buildBreadcrumbJsonLd: vi.fn(() => ({})),
  buildOrganizationJsonLd: vi.fn(() => ({})),
  buildWebSiteJsonLd: vi.fn(() => ({})),
}));

const releaseForMode = (mode) => ({
  id: `release-${mode}`,
  contentId: `release-${mode}`,
  title: mode === "latest" ? "Morning Drop" : mode === "classic" ? "Golden Verse" : "Firelight",
  summary: "A public release with a working preview.",
  creatorName: "Pyrexx_Singz",
  creatorUsername: "pyrexx",
  creatorId: "creator-1",
  creatorRoute: "/creator/pyrexx",
  route: `/tracks/release-${mode}`,
  coverImage: `/covers/${mode}.jpg`,
  summaryLabel: "Music",
  canPreview: true,
  previewUrl: `/audio/${mode}.mp3`,
  price: mode === "classic" ? 1200 : 0,
  timestampLabel: "2h ago",
});

describe("PublicCategoryPage", () => {
  beforeEach(() => {
    openPreviewMock.mockReset();
    vi.mocked(getCreatorSummaryFeed).mockImplementation(({ mode }) =>
      Promise.resolve({
        total: 1,
        items: [releaseForMode(mode)],
      })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders live music shelves and opens playable previews", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <PublicCategoryPage category="music" />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: /stream the songs people are finding first/i })
    ).toBeInTheDocument();

    expect(await screen.findByRole("heading", { name: /trending songs/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /new releases/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /editor's picks/i })).toBeInTheDocument();
    expect(screen.getAllByText("Firelight")).toHaveLength(2);
    expect(screen.getByText("Morning Drop")).toBeInTheDocument();
    expect(screen.getByText("Golden Verse")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /open creator page/i })[0]).toHaveAttribute(
      "href",
      "/creator/pyrexx"
    );

    await waitFor(() => {
      expect(getCreatorSummaryFeed).toHaveBeenCalledWith({
        category: "music",
        mode: "mixed",
        page: 1,
        limit: 4,
      });
      expect(getCreatorSummaryFeed).toHaveBeenCalledWith({
        category: "music",
        mode: "latest",
        page: 1,
        limit: 4,
      });
      expect(getCreatorSummaryFeed).toHaveBeenCalledWith({
        category: "music",
        mode: "classic",
        page: 1,
        limit: 4,
      });
    });

    await user.click(screen.getAllByRole("button", { name: /play preview/i })[0]);

    expect(openPreviewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Firelight",
        initialSourceMode: "preview",
      })
    );
  });
});
