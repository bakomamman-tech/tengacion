import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CodeSwitchPage from "../CodeSwitchPage";
import { runCodeswitchBenchmark } from "../../services/codeswitchApi";

vi.mock("../../components/seo/SeoHead", () => ({
  default: () => null,
}));

vi.mock("../../services/codeswitchApi", () => ({
  runCodeswitchBenchmark: vi.fn(),
}));

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

const SAHARA_MODEL = {
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
  processingStatus: "FILE_TRANSCRIBED",
  benchmarkMode: true,
  evaluation: null,
};

const OPENAI_MODEL = {
  ok: true,
  provider: "openai",
  model: "gpt-transcribe",
  languagePair: "ha-en",
  transcript: "Please check my order!",
  normalizedTranscript: "please check my order",
  normalizationVersion: "voicebridge-nwer-v1",
  latencyMs: 640,
  processingStatus: "FILE_TRANSCRIBED",
  benchmarkMode: true,
  evaluation: null,
};

const BENCHMARK_RESULT = {
  ok: true,
  service: "Tengacion VoiceBridge",
  phase: 3,
  languagePair: "ha-en",
  normalizationVersion: "voicebridge-nwer-v1",
  benchmarkMode: true,
  sameSourceAudio: true,
  successfulModels: 2,
  requestedModels: 2,
  models: [SAHARA_MODEL, OPENAI_MODEL],
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <CodeSwitchPage />
    </MemoryRouter>
  );

const uploadAudio = async (
  user,
  name = "support-sample.wav"
) => {
  const file = new File(["voice"], name, {
    type: "audio/wav",
  });

  await user.upload(
    screen.getByLabelText("Upload audio"),
    file
  );

  return file;
};

describe("CodeSwitchPage Phase 3 benchmark", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runCodeswitchBenchmark.mockResolvedValue(
      BENCHMARK_RESULT
    );
  });

  it("uploads one file and launches the shared benchmark", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(
      screen.getByLabelText("Language pair"),
      "pcm-en"
    );

    const file = await uploadAudio(user);

    const button = screen.getByRole("button", {
      name: /run voicebridge benchmark/i,
    });

    expect(button).toBeEnabled();

    await user.click(button);

    expect(runCodeswitchBenchmark).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: file,
        languagePair: "pcm-en",
        referenceTranscript: "",
      })
    );
  });

  it("shows both live provider cards while processing", async () => {
    const user = userEvent.setup();

    let resolveBenchmark;

    runCodeswitchBenchmark.mockReturnValue(
      new Promise((resolve) => {
        resolveBenchmark = resolve;
      })
    );

    renderPage();
    await uploadAudio(user);

    await user.click(
      screen.getByRole("button", {
        name: /run voicebridge benchmark/i,
      })
    );

    expect(
      screen.getByRole("button", {
        name: /benchmarking models/i,
      })
    ).toHaveAttribute("aria-busy", "true");

    expect(
      screen.getAllByText("Benchmarking", {
        selector: ".voicebridge-status",
      })
    ).toHaveLength(2);

    await act(async () => {
      resolveBenchmark(BENCHMARK_RESULT);
    });

    expect(
      await screen.findAllByText("FILE_TRANSCRIBED")
    ).toHaveLength(2);
  });

  it("shows Sahara and OpenAI results without inventing WER", async () => {
    const user = userEvent.setup();

    renderPage();
    await uploadAudio(user);

    await user.click(
      screen.getByRole("button", {
        name: /run voicebridge benchmark/i,
      })
    );

    const sahara =
      await screen.findByTestId("sahara-model-card");

    const openai =
      screen.getByTestId("openai-model-card");

    expect(
      within(sahara).getByText("Please check my order!")
    ).toBeInTheDocument();

    expect(
      within(openai).getByText("Please check my order!")
    ).toBeInTheDocument();

    expect(
      within(sahara).getByText("1,234 ms")
    ).toBeInTheDocument();

    expect(
      within(openai).getByText("640 ms")
    ).toBeInTheDocument();

    expect(
      within(sahara).getByText(
        "Reference transcript required for WER."
      )
    ).toBeInTheDocument();

    expect(
      within(openai).getByText(
        "Reference transcript required for WER."
      )
    ).toBeInTheDocument();

    expect(
      screen.getAllByText("Not integrated")
    ).toHaveLength(1);

    expect(
      screen.getByRole("heading", {
        name: "Gemini",
      })
    ).toBeInTheDocument();
  });

  it("shows server-computed normalized WER for both providers", async () => {
    const user = userEvent.setup();

    runCodeswitchBenchmark.mockResolvedValue({
      ...BENCHMARK_RESULT,
      models: [
        {
          ...SAHARA_MODEL,
          evaluation: WER_RESULT,
        },
        {
          ...OPENAI_MODEL,
          evaluation: WER_RESULT,
        },
      ],
    });

    renderPage();

    await user.type(
      screen.getByLabelText(/reference transcript/i),
      "Please check my order!"
    );

    await uploadAudio(user);

    await user.click(
      screen.getByRole("button", {
        name: /run voicebridge benchmark/i,
      })
    );

    expect(runCodeswitchBenchmark).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceTranscript:
          "Please check my order!",
      })
    );

    const sahara =
      await screen.findByTestId("sahara-model-card");

    const openai =
      screen.getByTestId("openai-model-card");

    expect(
      within(sahara).getByText("0.00% (0.000)")
    ).toBeInTheDocument();

    expect(
      within(openai).getByText("0.00% (0.000)")
    ).toBeInTheDocument();
  });

  it("preserves a successful provider when another provider fails", async () => {
    const user = userEvent.setup();

    runCodeswitchBenchmark.mockResolvedValue({
      ...BENCHMARK_RESULT,
      successfulModels: 1,
      models: [
        SAHARA_MODEL,
        {
          ok: false,
          provider: "openai",
          error: {
            code: "OPENAI_UPSTREAM_ERROR",
            message:
              "OpenAI transcription is temporarily unavailable.",
          },
        },
      ],
    });

    renderPage();
    await uploadAudio(user);

    await user.click(
      screen.getByRole("button", {
        name: /run voicebridge benchmark/i,
      })
    );

    const sahara =
      await screen.findByTestId("sahara-model-card");

    const openai =
      screen.getByTestId("openai-model-card");

    expect(
      within(sahara).getByText("Please check my order!")
    ).toBeInTheDocument();

    expect(
      within(openai).getByText(
        "OpenAI transcription is temporarily unavailable."
      )
    ).toBeInTheDocument();

    expect(
      within(openai).getByText("Provider error")
    ).toBeInTheDocument();
  });

  it("shows a safe top-level benchmark error", async () => {
    const user = userEvent.setup();

    runCodeswitchBenchmark.mockRejectedValue(
      new Error(
        "VoiceBridge benchmark is temporarily unavailable."
      )
    );

    renderPage();
    await uploadAudio(user);

    await user.click(
      screen.getByRole("button", {
        name: /run voicebridge benchmark/i,
      })
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent(
      "VoiceBridge benchmark is temporarily unavailable."
    );
  });
});
