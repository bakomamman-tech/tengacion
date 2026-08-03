import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPublicCreatorProfile } from "../../../api";
import CreatorFanPageViewPage from "../CreatorFanPageViewPage";

vi.mock("../../../api", () => ({
  createCheckout: vi.fn(),
  getDownloadUrl: vi.fn(),
  getPublicCreatorProfile: vi.fn(),
  initPayment: vi.fn(),
  toggleFollowCreator: vi.fn(),
}));

vi.mock("../../../components/creator/creatorFanPageData", () => ({
  buildCreatorFanPageDataFromPublicPayload: () => ({ creatorId: "creator-id" }),
  resolveCreatorFanPageTabKey: (value) => value,
}));

vi.mock("../../../components/creator/CreatorFanPagePreview", () => ({
  default: () => <main>Resolved creator profile</main>,
}));

vi.mock("../../../components/creator/creatorWorkspaceData", () => ({
  loadCreatorWorkspaceBundle: vi.fn(),
}));

function CanonicalLocation() {
  const location = useLocation();
  return <output>{`${location.pathname}${location.search}${location.hash}`}</output>;
}

describe("CreatorFanPageViewPage canonical routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPublicCreatorProfile).mockResolvedValue({
      creator: {
        id: "creator-id",
        username: "creator.example",
        canonicalPath: "/creator/creator.example",
        tabPaths: {
          home: "/creator/creator.example",
          music: "/creator/creator.example/music",
          albums: "/creator/creator.example/albums",
          podcasts: "/creator/creator.example/podcasts",
          books: "/creator/creator.example/books",
          posts: "/creator/creator.example/posts",
          store: "/creator/creator.example/store",
        },
      },
    });
  });

  it("replaces a creator-ID compatibility URL with the resolved username URL", async () => {
    render(
      <MemoryRouter
        initialEntries={["/creators/creator-id/books?previewItem=book-1#sample"]}
      >
        <Routes>
          <Route path="/creators/:creatorId/books" element={<CreatorFanPageViewPage />} />
          <Route path="/creator/:username/books" element={<CanonicalLocation />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/\/creator\/creator\.example\/books/)).toHaveTextContent(
        "/creator/creator.example/books?previewItem=book-1#sample"
      );
    });
    expect(getPublicCreatorProfile).toHaveBeenCalledWith("creator-id");
  });

  it("maps the legacy songs path directly to canonical music and preserves URL state", async () => {
    render(
      <MemoryRouter
        initialEntries={["/creators/creator-id/songs?source=legacy#playlist"]}
      >
        <Routes>
          <Route path="/creators/:creatorId/songs" element={<CreatorFanPageViewPage />} />
          <Route path="/creator/:username/music" element={<CanonicalLocation />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/\/creator\/creator\.example\/music/)).toHaveTextContent(
        "/creator/creator.example/music?source=legacy#playlist"
      );
    });
    expect(getPublicCreatorProfile).toHaveBeenCalledWith("creator-id");
  });

  it("renders directly when the request already uses the canonical username", async () => {
    render(
      <MemoryRouter initialEntries={["/creator/creator.example"]}>
        <Routes>
          <Route path="/creator/:username" element={<CreatorFanPageViewPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Resolved creator profile")).toBeInTheDocument();
    expect(getPublicCreatorProfile).toHaveBeenCalledWith("creator.example");
  });
});
