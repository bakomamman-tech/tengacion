import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CodeSwitchPage from "../CodeSwitchPage";
import {
  calculateCodeswitchWer,
  transcribeWithSahara,
} from "../../services/codeswitchApi";

vi.mock("../../components/seo/SeoHead", () => ({
  default: () => null,
}));

vi.mock("../../services/codeswitchApi", () => ({
  calculateCodeswitchWer: vi.fn(),
  transcribeWithSahara: vi.fn(),
}));

const SAHARA_RESULT = {
  ok: true,
  provider: "sahara",
  model: "sahara-v2.5",
  languagePair: "ha-en",
  languageCode: "ha",
  transcript: "Please check my order!",
  normalizedTranscript: "please check my order",
  normalizationVersion: "voicebridge-nwer-v1",
  latencyMs: 1234,
  processedAudioDurationSeconds: 8.2,
  providerFileId: "file-123",
  processingStatus: "FILE_TRANSCRIBED",
  benchmarkMode: true,
};

const WER_RESULT = {
  wer: 0,
  substitutions: 0,
  deletions: 0,
  insertions: 0,
  referenceWordCount: 4,
  normalizedReference: "please check my order",
  normalizedHypothesis: "please check my order",
  normalizationVersion: "voicebridge-nwer-v1",
};

const renderPage = () => render(
  <MemoryRouter>
    <CodeSwitchPage />
  </MemoryRouter>
);

const uploadAudio = async (user, name = "support-sample.wav") => {
  const file = new File(["voice"], name, { type: "audio/wav" });
  await user.upload(screen.getByLabelText("Upload audio"), file);
  return file;
};

describe("CodeSwitchPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transcribeWithSahara.mockResolvedValue(SAHARA_RESULT);
    calculateCodeswitchWer.mockResolvedValue(WER_RESULT);
  });

  it("supports explicit language selection and local upload state", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByLabelText("Language pair")).toHaveValue("ha-en");
    await user.selectOptions(screen.getByLabelText("Language pair"), "pcm-en");
    expect(screen.getByLabelText("Language pair")).toHaveValue("pcm-en");

    const file = await uploadAudio(user);
    expect(screen.getByText("support-sample.wav")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /transcribe with sahara/i })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /transcribe with sahara/i }));
    expect(transcribeWithSahara).toHaveBeenCalledWith(
      expect.objectContaining({ audio: file, languagePair: "pcm-en" })
    );
  });

  it("shows a loading state while Sahara is processing", async () => {
    const user = userEvent.setup();
    let resolveTranscription;
    transcribeWithSahara.mockReturnValue(
      new Promise((resolve) => {
        resolveTranscription = resolve;
      })
    );
    renderPage();
    await uploadAudio(user);

    await user.click(screen.getByRole("button", { name: /transcribe with sahara/i }));
    expect(screen.getByRole("button", { name: /transcribing with sahara/i })).toHaveAttribute(
      "aria-busy",
      "true"
    );
    expect(screen.getByText("Transcribing", { selector: ".voicebridge-status" })).toBeInTheDocument();

    await act(async () => {
      resolveTranscription(SAHARA_RESULT);
    });
    expect(await screen.findByText("FILE_TRANSCRIBED")).toBeInTheDocument();
  });

  it("displays a real Sahara result without inventing WER", async () => {
    const user = userEvent.setup();
    renderPage();
    await uploadAudio(user);
    await user.click(screen.getByRole("button", { name: /transcribe with sahara/i }));

    const card = await screen.findByTestId("sahara-model-card");
    expect(within(card).getByText("Please check my order!")).toBeInTheDocument();
    expect(within(card).getByText("please check my order")).toBeInTheDocument();
    expect(within(card).getByText("voicebridge-nwer-v1")).toBeInTheDocument();
    expect(within(card).getByText("1,234 ms")).toBeInTheDocument();
    expect(within(card).getByText("8.2 s")).toBeInTheDocument();
    expect(within(card).getByText("FILE_TRANSCRIBED")).toBeInTheDocument();
    expect(within(card).getByText("Reference transcript required for WER.")).toBeInTheDocument();
    expect(calculateCodeswitchWer).not.toHaveBeenCalled();
    expect(screen.getAllByText("Not integrated")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Gemini" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "OpenAI" })).toBeInTheDocument();
  });

  it("calculates and displays normalized WER only when a reference is supplied", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/reference transcript/i), "Please check my order!");
    await uploadAudio(user);
    await user.click(screen.getByRole("button", { name: /transcribe with sahara/i }));

    expect(calculateCodeswitchWer).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: "Please check my order!",
        hypothesis: "Please check my order!",
      })
    );
    const card = await screen.findByTestId("sahara-model-card");
    expect(within(card).getByText("0.000")).toBeInTheDocument();
    expect(within(card).getAllByText("0")).toHaveLength(3);
  });

  it("shows a safe provider error without fabricating model results", async () => {
    const user = userEvent.setup();
    const error = new Error("Sahara is rate limited. Try the transcription again later.");
    error.retryAfterSeconds = 9;
    transcribeWithSahara.mockRejectedValue(error);
    renderPage();
    await uploadAudio(user);
    await user.click(screen.getByRole("button", { name: /transcribe with sahara/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sahara is rate limited. Try the transcription again later. Try again in 9 seconds."
    );
    const card = screen.getByTestId("sahara-model-card");
    expect(within(card).queryByText("Please check my order!")).not.toBeInTheDocument();
  });
});
