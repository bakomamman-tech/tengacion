import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import CodeSwitchPage from "../CodeSwitchPage";

vi.mock("../../components/seo/SeoHead", () => ({
  default: () => null,
}));

describe("CodeSwitchPage", () => {
  it("renders the complete Phase 1 VoiceBridge workspace", () => {
    render(
      <MemoryRouter>
        <CodeSwitchPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: "Tengacion VoiceBridge" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Code-Switching Voice Intelligence for African Digital Commerce")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /record audio/i })).toBeDisabled();
    expect(screen.getByLabelText("Language pair")).toHaveValue("Hausa ↔ English");

    for (const model of ["Sahara v2.5", "Gemini", "OpenAI"]) {
      expect(screen.getByRole("heading", { name: model })).toBeInTheDocument();
    }
    expect(screen.getAllByText("Awaiting Phase 2/3")).toHaveLength(3);
    expect(screen.getByText("Detected intent")).toBeInTheDocument();
    expect(screen.getByText("Overall normalized WER")).toBeInTheDocument();
    expect(screen.getByText(/exact same source audio/i)).toBeInTheDocument();
    expect(screen.getByText(/same deterministic normalization function/i)).toBeInTheDocument();
  });

  it("stages audio locally and switches the language pair", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CodeSwitchPage />
      </MemoryRouter>
    );

    await user.selectOptions(
      screen.getByLabelText("Language pair"),
      "Nigerian Pidgin ↔ English"
    );
    expect(screen.getByLabelText("Language pair")).toHaveValue(
      "Nigerian Pidgin ↔ English"
    );

    const file = new File(["voice"], "support-sample.wav", { type: "audio/wav" });
    await user.upload(screen.getByLabelText("Upload audio"), file);

    expect(screen.getByText("support-sample.wav")).toBeInTheDocument();
    expect(screen.getByText(/staged locally—no upload or transcription occurs/i)).toBeInTheDocument();
  });
});
