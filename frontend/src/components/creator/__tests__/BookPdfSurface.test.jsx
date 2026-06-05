import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pdfjsMock = vi.hoisted(() => ({
  GlobalWorkerOptions: {
    workerSrc: "",
  },
  getDocument: vi.fn(),
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => pdfjsMock);

import BookPdfSurface from "../BookPdfSurface";

describe("BookPdfSurface", () => {
  const originalUrlParse = URL.parse;

  beforeEach(() => {
    vi.clearAllMocks();
    pdfjsMock.GlobalWorkerOptions.workerSrc = "";
    Object.defineProperty(URL, "parse", {
      configurable: true,
      value: undefined,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(URL, "parse", {
      configurable: true,
      value: originalUrlParse,
      writable: true,
    });
  });

  it("loads the legacy PDF reader when URL.parse is unavailable", async () => {
    const pdfDocument = {
      destroy: vi.fn(),
      getPage: vi.fn(),
      numPages: 3,
    };
    pdfjsMock.getDocument.mockReturnValue({
      destroy: vi.fn(),
      promise: Promise.resolve(pdfDocument),
    });

    render(
      <BookPdfSurface
        src="https://cdn.example.com/the-rustle-of-death.pdf"
        title="The Rustle of Death"
      />
    );

    expect(await screen.findByText("Page 1 of 3")).toBeInTheDocument();
    expect(pdfjsMock.getDocument).toHaveBeenCalledWith({
      url: "https://cdn.example.com/the-rustle-of-death.pdf",
      withCredentials: false,
    });
    expect(pdfjsMock.GlobalWorkerOptions.workerSrc).toContain(
      "pdfjs-dist/legacy/build/pdf.worker.mjs"
    );
  });
});
