import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateBookWithUploadProgress } from "../../../api";
import { useCreatorWorkspace } from "../../../components/creator/useCreatorWorkspace";
import CreatorBooksPage from "../CreatorBooksPage";

vi.mock("../../../api", () => ({
  updateBookWithUploadProgress: vi.fn(),
}));

vi.mock("../../../components/creator/useCreatorWorkspace", () => ({
  useCreatorWorkspace: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const dashboard = {
  categories: {
    bookPublishing: {
      earnings: 0,
    },
  },
  content: {
    books: {
      analytics: {
        activeBooks: 1,
        totalDownloads: 3,
      },
      items: [
        {
          _id: "book-1",
          title: "The Rustle of Death",
          description: "A reader-facing book.",
          genre: "African Prose Fiction",
          language: "English",
          price: 2000,
          chapterCount: 12,
          fileFormat: "pdf",
          publishedStatus: "published",
          copyrightScanStatus: "passed",
          updatedAt: "2026-05-20T12:00:00.000Z",
        },
      ],
    },
  },
};

describe("CreatorBooksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCreatorWorkspace.mockReturnValue({
      dashboard,
      refreshWorkspace: vi.fn(),
    });
    updateBookWithUploadProgress.mockResolvedValue({});
  });

  it("lets authors edit published books and save chapter count", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CreatorBooksPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("button", { name: /edit published book/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/12 chapters/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /edit published book/i }));

    const chapterCountInput = screen.getByLabelText(/number of chapters/i);
    expect(chapterCountInput).toHaveValue(12);

    await user.clear(chapterCountInput);
    await user.type(chapterCountInput, "14");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateBookWithUploadProgress).toHaveBeenCalledWith(
        "book-1",
        expect.any(FormData),
        expect.objectContaining({ onProgress: expect.any(Function) })
      );
    });

    const submittedForm = updateBookWithUploadProgress.mock.calls[0][1];
    expect(submittedForm.get("chapterCount")).toBe("14");
  }, 15000);
});
