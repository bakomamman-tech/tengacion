import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CodeSwitchPage from "../CodeSwitchPage";
import {
  analyzeCodeswitchIntent,
  runCodeswitchBenchmark,
} from "../../services/codeswitchApi";

vi.mock("../../components/seo/SeoHead", () => ({
  default: () => null,
}));

vi.mock("../../services/codeswitchApi", () => ({
  analyzeCodeswitchIntent: vi.fn(),
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

const WHISPER_MODEL = {
  ok: true,
  provider: "whisper",
  model: "whisper-1",
  languagePair: "ha-en",
  transcript: "Please check my order!",
  normalizedTranscript: "please check my order",
  normalizationVersion: "voicebridge-nwer-v1",
  latencyMs: 780,
  processingStatus: "FILE_TRANSCRIBED",
  benchmarkMode: true,
  evaluation: null,
};

const CHIRP_MODEL = {
  ok: true,
  provider: "chirp",
  vendor: "google-cloud",
  model: "chirp_3",
  languagePair: "ha-en",
  transcript: "Please check my order!",
  normalizedTranscript: "please check my order",
  normalizationVersion: "voicebridge-nwer-v1",
  latencyMs: 910,
  detectedLanguageCodes: ["ha"],
  processingStatus: "FILE_TRANSCRIBED",
  benchmarkMode: true,
  automaticLanguageDetection: true,
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
  successfulModels: 4,
  requestedModels: 4,
  models: [
    SAHARA_MODEL,
    OPENAI_MODEL,
    WHISPER_MODEL,
    CHIRP_MODEL,
  ],
};

const INTENT_RESULT = {
  ok: true,
  service: "Tengacion VoiceBridge",
  phase: 3,
  integrationEnabled: true,
  intentVersion: "voicebridge-intent-v1",
  languagePair: "ha-en",
  normalizedTranscript:
    "don allah check my payment na biya naira dubu biyar jiya amma ban samu confirmation ba",
  intent: "payment_confirmation_check",
  confidence: 0.98,
  confidenceType:
    "deterministic-heuristic-score-not-calibrated-probability",
  entities: {
    amount: 5000,
    currency: "NGN",
    timeReference: "yesterday",
    transactionReference: null,
  },
  requestedAction: "check_payment_status",
  actionPolicy: {
    mode: "read_only",
    moneyMovementAllowed: false,
    requiresConfirmation: false,
    manualReviewRequired: false,
  },
  execution: {
    attempted: false,
    moneyMovementPerformed: false,
    message:
      "Intent and entities extracted. No downstream action was executed.",
  },
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

    analyzeCodeswitchIntent.mockResolvedValue(
      INTENT_RESULT
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

  it("drives the downstream task from the Sahara transcript", async () => {
    const user = userEvent.setup();

    const paymentTranscript =
      "Don Allah, check my payment, na biya naira dubu biyar jiya amma ban samu confirmation ba.";

    runCodeswitchBenchmark.mockResolvedValue({
      ...BENCHMARK_RESULT,
      models: [
        {
          ...SAHARA_MODEL,
          transcript: paymentTranscript,
          normalizedTranscript:
            "don allah check my payment na biya naira dubu biyar jiya amma ban samu confirmation ba",
        },
        OPENAI_MODEL,
        WHISPER_MODEL,
        CHIRP_MODEL,
      ],
    });

    renderPage();
    await uploadAudio(user);

    await user.click(
      screen.getByRole("button", {
        name: /run voicebridge benchmark/i,
      })
    );

    expect(
      await screen.findByText(
        "payment_confirmation_check"
      )
    ).toBeInTheDocument();

    expect(
      analyzeCodeswitchIntent
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        transcript: paymentTranscript,
        languagePair: "ha-en",
      })
    );

    expect(
      screen.getByText(
        "NGN 5,000 | yesterday"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "check_payment_status"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Safe read-only analysis | No money moved"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Intent and entities extracted. No downstream action was executed."
      )
    ).toBeInTheDocument();
  });

  it("shows all four live provider cards while processing", async () => {
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
    ).toHaveLength(4);

    await act(async () => {
      resolveBenchmark(BENCHMARK_RESULT);
    });

    expect(
      await screen.findAllByText("FILE_TRANSCRIBED")
    ).toHaveLength(4);
  });

  it("shows all four model results without inventing WER", async () => {
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

    const whisper =
      screen.getByTestId("whisper-model-card");

    const chirp =
      screen.getByTestId("chirp-model-card");

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
      within(whisper).getByText("780 ms")
    ).toBeInTheDocument();

    expect(
      within(chirp).getByText("910 ms")
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
      within(whisper).getByText(
        "Reference transcript required for WER."
      )
    ).toBeInTheDocument();

    expect(
      within(chirp).getByText(
        "Reference transcript required for WER."
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Not integrated")
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("heading", {
        name: "Gemini",
      })
    ).not.toBeInTheDocument();
  });

  it("shows server-computed normalized WER for all four providers", async () => {
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
        {
          ...WHISPER_MODEL,
          evaluation: WER_RESULT,
        },
        {
          ...CHIRP_MODEL,
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

    const whisper =
      screen.getByTestId("whisper-model-card");

    const chirp =
      screen.getByTestId("chirp-model-card");

    expect(
      within(sahara).getByText("0.00% (0.000)")
    ).toBeInTheDocument();

    expect(
      within(openai).getByText("0.00% (0.000)")
    ).toBeInTheDocument();

    expect(
      within(whisper).getByText("0.00% (0.000)")
    ).toBeInTheDocument();

    expect(
      within(chirp).getByText("0.00% (0.000)")
    ).toBeInTheDocument();
  });

  it("preserves a successful provider when another provider fails", async () => {
    const user = userEvent.setup();

    runCodeswitchBenchmark.mockResolvedValue({
      ...BENCHMARK_RESULT,
      successfulModels: 3,
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
        WHISPER_MODEL,
        CHIRP_MODEL,
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
