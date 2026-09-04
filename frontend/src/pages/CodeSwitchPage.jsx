import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import SeoHead from "../components/seo/SeoHead";
import Button from "../components/ui/Button";
import {
  analyzeCodeswitchIntent,
  runCodeswitchBenchmark,
} from "../services/codeswitchApi";

import "./codeswitch.css";

const LANGUAGE_PAIRS = [
  { value: "ha-en", label: "Hausa ↔ English", code: "ha" },
  { value: "pcm-en", label: "Nigerian Pidgin ↔ English", code: "pcm" },
];

const DOWNSTREAM_FIELDS = [
  "Detected intent",
  "Extracted entities",
  "Requested action",
  "Task result",
  "Success / failure",
];

const SUMMARY_FIELDS = [
  { label: "Overall normalized WER", shortLabel: "Overall" },
  { label: "Hausa–English normalized WER", shortLabel: "HA ↔ EN" },
  { label: "Pidgin–English normalized WER", shortLabel: "PCM ↔ EN" },
  { label: "Average latency", shortLabel: "Latency" },
  { label: "Downstream task-success rate", shortLabel: "Task success" },
];

const METHODOLOGY = [
  "The exact same source audio will be evaluated across every ASR model.",
  "Every transcript uses the voicebridge-nwer-v1 deterministic normalization policy.",
  "Normalized word error rate is the primary transcription benchmark.",
  "Downstream intent and task performance will be evaluated separately.",
];

const formatDownstreamEntities = (
  entities
) => {
  if (!entities) {
    return "Awaiting benchmark";
  }

  const parts = [];

  if (
    Number.isFinite(entities.amount) &&
    entities.currency
  ) {
    parts.push(
      `${entities.currency} ${entities.amount.toLocaleString()}`
    );
  } else if (Number.isFinite(entities.amount)) {
    parts.push(
      entities.amount.toLocaleString()
    );
  }

  if (entities.timeReference) {
    parts.push(entities.timeReference);
  }

  if (entities.transactionReference) {
    parts.push(
      `Ref: ${entities.transactionReference}`
    );
  }

  return parts.length > 0
    ? parts.join(" | ")
    : "No supported entities detected";
};

function VoiceBridgeIcon({ name, size = 24 }) {
  const paths = {
    microphone: (
      <>
        <rect x="8" y="3" width="8" height="12" rx="4" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4M7 9l5-5 5 5" />
        <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
      </>
    ),
    compare: (
      <>
        <path d="M7 4v16M17 4v16" />
        <path d="m4 7 3-3 3 3M14 17l3 3 3-3" />
      </>
    ),
    task: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="m8 9 2 2 4-4M8 16h8" />
      </>
    ),
    chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
    methodology: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 5 6v5c0 4.7 2.9 8.1 7 10 4.1-1.9 7-5.3 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    arrow: <path d="m5 12 14 0m-5-5 5 5-5 5" />,
    check: <path d="m5 12 4 4L19 6" />,
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function SectionHeading({ number, icon, eyebrow, title, detail }) {
  return (
    <div className="voicebridge-section-heading">
      <span className="voicebridge-section-heading__number">{number}</span>
      <span className="voicebridge-section-heading__icon">
        <VoiceBridgeIcon name={icon} />
      </span>
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
        {detail ? <span>{detail}</span> : null}
      </div>
    </div>
  );
}

const displayMetric = (value) =>
  Number.isFinite(value) ? String(value) : "—";

function BenchmarkModelCard({
  result,
  languagePairLabel,
  isLoading,
  name,
  mark,
  subtitle,
  tone,
  testId,
}) {
  const isSuccess = result?.ok === true;
  const isFailure = result?.ok === false;
  const evaluation = isSuccess ? result?.evaluation : null;

  const werDisplay = evaluation
    ? evaluation.wer === null
      ? "Undefined"
      : Number.isFinite(evaluation.wer)
        ? `${(evaluation.wer * 100).toFixed(2)}% (${evaluation.wer.toFixed(3)})`
        : "Unavailable"
    : isSuccess
      ? "Reference transcript required for WER."
      : isFailure
        ? "Provider failed"
        : "\u2014";

  const statusText = isLoading
    ? "Benchmarking"
    : isSuccess
      ? "Live result"
      : isFailure
        ? "Provider error"
        : "Ready for benchmark";

  return (
    <article
      className={`voicebridge-model-card voicebridge-model-card--${tone} voicebridge-model-card--active`}
      data-testid={testId}
    >
      <header>
        <span className="voicebridge-model-card__mark" aria-hidden="true">
          {mark}
        </span>

        <div>
          <h3>{name}</h3>
          <p>{isSuccess ? result.model || subtitle : subtitle}</p>
        </div>

        <span className={`voicebridge-status${isSuccess ? " is-ready" : ""}`}>
          {statusText}
        </span>
      </header>

      <dl>
        <div>
          <dt>Language pair</dt>
          <dd>{isSuccess ? languagePairLabel : "\u2014"}</dd>
        </div>

        <div className="voicebridge-model-card__text-row">
          <dt>Original transcript</dt>
          <dd>
            {isSuccess
              ? result.transcript || "No speech recognized"
              : isFailure
                ? result.error?.message || "Provider transcription failed."
                : "\u2014"}
          </dd>
        </div>

        <div className="voicebridge-model-card__text-row">
          <dt>Normalized transcript</dt>
          <dd>
            {isSuccess
              ? result.normalizedTranscript || "No speech recognized"
              : "\u2014"}
          </dd>
        </div>

        <div>
          <dt>Normalization version</dt>
          <dd>
            {isSuccess
              ? result.normalizationVersion
              : "voicebridge-nwer-v1"}
          </dd>
        </div>

        <div>
          <dt>Normalized WER</dt>
          <dd>{werDisplay}</dd>
        </div>

        <div>
          <dt>Substitutions</dt>
          <dd>{displayMetric(evaluation?.substitutions)}</dd>
        </div>

        <div>
          <dt>Deletions</dt>
          <dd>{displayMetric(evaluation?.deletions)}</dd>
        </div>

        <div>
          <dt>Insertions</dt>
          <dd>{displayMetric(evaluation?.insertions)}</dd>
        </div>

        <div>
          <dt>Latency</dt>
          <dd>
            {isSuccess && Number.isFinite(result.latencyMs)
              ? `${result.latencyMs.toLocaleString()} ms`
              : isSuccess
                ? "Not reported"
                : "\u2014"}
          </dd>
        </div>

        <div>
          <dt>Processed duration</dt>
          <dd>
            {isSuccess && Number.isFinite(result.processedAudioDurationSeconds)
              ? `${result.processedAudioDurationSeconds} s`
              : isSuccess
                ? "Not reported"
                : "\u2014"}
          </dd>
        </div>

        <div>
          <dt>Transcription status</dt>
          <dd>
            {isSuccess
              ? result.processingStatus || "Completed"
              : "\u2014"}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export default function CodeSwitchPage() {
  const [languagePair, setLanguagePair] = useState(LANGUAGE_PAIRS[0].value);
  const [audioFile, setAudioFile] = useState(null);
  const [referenceTranscript, setReferenceTranscript] = useState("");
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [intentResult, setIntentResult] = useState(null);
  const [intentError, setIntentError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const activeRequestRef = useRef(null);

  const selectedLanguage = useMemo(
    () =>
      LANGUAGE_PAIRS.find((pair) => pair.value === languagePair) ||
      LANGUAGE_PAIRS[0],
    [languagePair]
  );

  const saharaResult =
    benchmarkResult?.models?.find(
      (model) => model.provider === "sahara"
    ) || null;

  const openAiResult =
    benchmarkResult?.models?.find(
      (model) => model.provider === "openai"
    ) || null;

  const whisperResult =
    benchmarkResult?.models?.find(
      (model) => model.provider === "whisper"
    ) || null;

  const chirpResult =
    benchmarkResult?.models?.find(
      (model) => model.provider === "chirp"
    ) || null;

  useEffect(() => {
    const requestRef = activeRequestRef;
    return () => requestRef.current?.abort();
  }, []);

  const cancelActiveRequest = () => {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    setIsSubmitting(false);
  };

  const resetResults = () => {
    setBenchmarkResult(null);
    setIntentResult(null);
    setIntentError("");
    setErrorMessage("");
  };

  const handleAudioSelection = (event) => {
    cancelActiveRequest();
    setAudioFile(event.target.files?.[0] || null);
    resetResults();
  };

  const handleLanguageChange = (event) => {
    cancelActiveRequest();
    setLanguagePair(event.target.value);
    resetResults();
  };

  const handleBenchmark = async () => {
    if (!audioFile || isSubmitting) {
      return;
    }

    activeRequestRef.current?.abort();

    const controller = new AbortController();
    activeRequestRef.current = controller;

    setIsSubmitting(true);
    resetResults();

    try {
      const benchmark = await runCodeswitchBenchmark({
        audio: audioFile,
        languagePair,
        referenceTranscript,
        signal: controller.signal,
      });

      if (!controller.signal.aborted) {
        setBenchmarkResult(benchmark);

        const saharaDownstream =
          benchmark?.models?.find(
            (model) =>
              model.provider === "sahara" &&
              model.ok === true &&
              typeof model.transcript === "string" &&
              model.transcript.trim()
          ) || null;

        if (!saharaDownstream) {
          setIntentError(
            "Sahara v2.5 did not return a usable transcript, so the downstream task was not run."
          );
          return;
        }

        try {
          const intent =
            await analyzeCodeswitchIntent({
              transcript:
                saharaDownstream.transcript,
              languagePair,
              signal: controller.signal,
            });

          if (!controller.signal.aborted) {
            setIntentResult({
              ...intent,
              sourceProvider: "sahara",
              sourceModel:
                saharaDownstream.model ||
                "sahara-v2.5",
            });
          }
        } catch (intentFailure) {
          if (
            intentFailure?.name !==
            "AbortError"
          ) {
            setIntentError(
              intentFailure?.message ||
                "VoiceBridge intent analysis could not be completed."
            );
          }
        }
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        const retryHint = Number.isFinite(error?.retryAfterSeconds)
          ? ` Try again in ${error.retryAfterSeconds} seconds.`
          : "";

        setErrorMessage(
          `${error?.message || "VoiceBridge benchmark failed."}${retryHint}`
        );
      }
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
        setIsSubmitting(false);
      }
    }
  };

  const downstreamValues = {
    "Detected intent":
      intentResult?.intent ||
      (intentError
        ? "Intent analysis unavailable"
        : "Awaiting benchmark"),

    "Extracted entities":
      intentResult
        ? formatDownstreamEntities(
            intentResult.entities
          )
        : intentError
          ? "Unavailable"
          : "Awaiting benchmark",

    "Requested action":
      intentResult?.requestedAction ||
      (intentError
        ? "No action selected"
        : "Awaiting benchmark"),

    "Task result":
      intentResult?.execution?.message ||
      (intentError
        ? intentError
        : "Awaiting benchmark"),

    "Success / failure":
      intentResult
        ? intentResult.actionPolicy
            ?.manualReviewRequired
          ? "Manual review required | No money moved"
          : "Safe read-only analysis | No money moved"
        : intentError
          ? "Downstream analysis unavailable"
          : "Awaiting benchmark",
  };

  return (
    <main className="voicebridge-page">
      <SeoHead
        title="Tengacion VoiceBridge | African Code-Switching Voice Intelligence"
        description="Phase 3 of Tengacion VoiceBridge benchmarks Sahara v2.5, GPT-Transcribe, Whisper-1, and Google Chirp 3 on the same Hausa-English or Nigerian Pidgin-English source audio using shared normalized WER."
        canonical="/codeswitch"
        robots="noindex,follow"
      />

      <header className="voicebridge-nav">
        <div className="voicebridge-shell voicebridge-nav__inner">
          <Link className="voicebridge-brand" to="/" aria-label="Tengacion home">
            <img src="/tengacion_logo_128.png" alt="" />
            <span>Tengacion</span>
          </Link>
          <span className="voicebridge-phase-pill">
            <i aria-hidden="true" />
            Phase 3 | Four-model benchmark
          </span>
        </div>
      </header>

      <section className="voicebridge-hero">
        <div className="voicebridge-shell voicebridge-hero__grid">
          <div className="voicebridge-hero__copy">
            <p className="voicebridge-kicker">Voice intelligence · Built for Africa</p>
            <h1>Tengacion <span>VoiceBridge</span></h1>
            <p className="voicebridge-hero__subtitle">
              Code-Switching Voice Intelligence for African Digital Commerce
            </p>
            <p className="voicebridge-hero__summary">
              Benchmark authorized Hausa-English and Nigerian Pidgin-English
              recordings across Sahara v2.5, GPT-Transcribe, Whisper-1, and
              Google Chirp 3 using the exact same source audio, normalization
              policy, and evaluation metric.
            </p>
            <a className="voicebridge-hero__link" href="#voice-assistant">
              Open the benchmark workspace
              <VoiceBridgeIcon name="arrow" size={19} />
            </a>
          </div>

          <div className="voicebridge-signal" aria-label="VoiceBridge multi-model benchmark signal preview">
            <div className="voicebridge-signal__topline">
              <span>Sahara + GPT + Whisper + Chirp</span>
              <span><i aria-hidden="true" /> Ready for audio</span>
            </div>
            <div className="voicebridge-wave" aria-hidden="true">
              {[28, 48, 72, 42, 88, 58, 34, 76, 100, 68, 44, 82, 54, 30, 62, 40].map(
                (height, index) => (
                  <i key={`${height}-${index}`} style={{ "--wave-height": `${height}%` }} />
                )
              )}
            </div>
            <div className="voicebridge-signal__route">
              <span>{selectedLanguage.code.toUpperCase()}</span>
              <i />
              <strong>voicebridge-nwer-v1</strong>
              <i />
              <span>EN</span>
            </div>
            <div className="voicebridge-signal__footer">
              <span>One source</span>
              <span>Raw ASR mode</span>
              <span>Shared normalization</span>
            </div>
          </div>
        </div>
      </section>

      <div className="voicebridge-shell voicebridge-workspace">
        <section className="voicebridge-section" id="voice-assistant">
          <SectionHeading
            number="01"
            icon="microphone"
            eyebrow="Voice assistant"
            title="Run the shared-audio benchmark"
            detail="Upload one authorized recording once, send the same source audio to every live provider, and optionally score every transcript against one human reference."
          />

          <div className="voicebridge-input-panel">
            <div className="voicebridge-input-panel__controls">
              <div className="voicebridge-field">
                <label htmlFor="voicebridge-language">Language pair</label>
                <div className="voicebridge-select-wrap">
                  <select
                    id="voicebridge-language"
                    value={languagePair}
                    disabled={isSubmitting}
                    onChange={handleLanguageChange}
                  >
                    {LANGUAGE_PAIRS.map((pair) => (
                      <option key={pair.value} value={pair.value}>{pair.label}</option>
                    ))}
                  </select>
                  <span aria-hidden="true">⌄</span>
                </div>
              </div>

              <div className="voicebridge-audio-actions">
                <Button variant="primary" size="lg" disabled title="Browser recording is not enabled yet">
                  <VoiceBridgeIcon name="microphone" size={20} />
                  Record audio
                </Button>
                <label className="voicebridge-upload-control">
                  <VoiceBridgeIcon name="upload" size={20} />
                  <span>Upload audio</span>
                  <input
                    type="file"
                    accept="audio/*,video/mp4,video/webm,.wav,.mp3,.mp4,.m4a,.ogg,.webm,.flac"
                    aria-label="Upload audio"
                    disabled={isSubmitting}
                    onChange={handleAudioSelection}
                  />
                </label>
              </div>
            </div>

            <div className="voicebridge-reference-field">
              <label htmlFor="voicebridge-reference">
                Reference transcript <span>Optional · enables normalized WER</span>
              </label>
              <textarea
                id="voicebridge-reference"
                value={referenceTranscript}
                disabled={isSubmitting}
                maxLength={20000}
                rows={3}
                placeholder="Paste the human-verified transcript here before transcribing…"
                onChange={(event) => {
                  setReferenceTranscript(event.target.value);
                  setBenchmarkResult(null);
                  setIntentResult(null);
                  setIntentError("");
                }}
              />
            </div>

            <div className="voicebridge-file-state" aria-live="polite">
              <span className="voicebridge-file-state__icon">
                <VoiceBridgeIcon name={audioFile ? "check" : "upload"} size={21} />
              </span>
              <div>
                <strong>{audioFile ? audioFile.name : "No audio selected"}</strong>
                <p>
                  {audioFile
                    ? `${(audioFile.size / (1024 * 1024)).toFixed(2)} MB · Ready for secure in-memory transfer.`
                    : "WAV, MP3, MP4, M4A, OGG, WebM, or FLAC · Maximum 25MB."}
                </p>
              </div>
              <span className="voicebridge-file-state__pair">{selectedLanguage.label}</span>
            </div>

            <div className="voicebridge-privacy-note">
              <span>
                <VoiceBridgeIcon name="shield" size={20} />
              </span>
              <p>
                Audio is sent to Sahara/Intron, OpenAI, and Google Cloud for
                benchmark transcription. VoiceBridge does not intentionally
                persist uploaded audio in this prototype. Use only recordings
                you are authorized to process.
              </p>
            </div>

            <div className="voicebridge-transcribe-row">
              <div>
                <strong>Benchmark-safe mode</strong>
                <span>One source audio | shared normalization | comparable provider outputs.</span>
              </div>
              <Button
                variant="primary"
                size="lg"
                loading={isSubmitting}
                disabled={!audioFile}
                onClick={handleBenchmark}
              >
                <VoiceBridgeIcon name="arrow" size={19} />
                {isSubmitting
                  ? "Benchmarking models..."
                  : "Run VoiceBridge Benchmark"}
              </Button>
            </div>

            {errorMessage ? (
              <div className="voicebridge-error" role="alert">{errorMessage}</div>
            ) : null}
          </div>
        </section>

        <section className="voicebridge-section">
          <SectionHeading
            number="02"
            icon="compare"
            eyebrow="Model comparison"
            title="One benchmark, side by side"
            detail="Four ASR models run from one shared-audio request: Sahara v2.5, GPT-Transcribe, Whisper-1, and Google Chirp 3."
          />
          <div className="voicebridge-model-grid">
            <BenchmarkModelCard
              result={saharaResult}
              languagePairLabel={selectedLanguage.label}
              isLoading={isSubmitting}
              name="Sahara v2.5"
              mark="SA"
              subtitle="Intron benchmark transcription"
              tone="sand"
              testId="sahara-model-card"
            />

            <BenchmarkModelCard
              result={openAiResult}
              languagePairLabel={selectedLanguage.label}
              isLoading={isSubmitting}
              name="GPT-Transcribe"
              mark="GPT"
              subtitle="OpenAI benchmark transcription"
              tone="green"
              testId="openai-model-card"
            />

            <BenchmarkModelCard
              result={whisperResult}
              languagePairLabel={selectedLanguage.label}
              isLoading={isSubmitting}
              name="Whisper-1"
              mark="W1"
              subtitle="OpenAI Whisper benchmark transcription"
              tone="blue"
              testId="whisper-model-card"
            />

            <BenchmarkModelCard
              result={chirpResult}
              languagePairLabel={selectedLanguage.label}
              isLoading={isSubmitting}
              name="Chirp 3"
              mark="C3"
              subtitle="Google Cloud Speech-to-Text benchmark"
              tone="violet"
              testId="chirp-model-card"
            />
          </div>
        </section>

        <section className="voicebridge-section voicebridge-two-column">
          <div>
            <SectionHeading
              number="03"
              icon="task"
              eyebrow="Downstream task"
              title="From speech to resolution"
              detail="Sahara v2.5 drives the application path: its transcript is analyzed for intent, entities, and a safe downstream action without moving money."
            />
            <article className="voicebridge-task-card">
              <div className="voicebridge-task-card__flow" aria-hidden="true">
                <span>Speech</span><i /><span>Intent</span><i /><span>Action</span>
              </div>
              <dl>
                {DOWNSTREAM_FIELDS.map((field) => (
                  <div key={field}>
                    <dt>{field}</dt>
                    <dd>{downstreamValues[field]}</dd>
                  </div>
                ))}
              </dl>
            </article>
          </div>

          <div>
            <SectionHeading
              number="04"
              icon="chart"
              eyebrow="Benchmark summary"
              title="The scorecard"
              detail="Aggregate reporting remains pending until equivalent multi-model runs exist."
            />
            <div className="voicebridge-summary-grid">
              {SUMMARY_FIELDS.map((metric) => (
                <article key={metric.label}>
                  <span>{metric.shortLabel}</span><strong>—</strong><p>{metric.label}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="voicebridge-methodology">
          <div className="voicebridge-methodology__intro">
            <span><VoiceBridgeIcon name="methodology" size={26} /></span>
            <p>05 · Methodology</p>
            <h2>Designed for a fair comparison</h2>
            <p>
              The same uploaded source audio is dispatched to every live ASR provider,
              and each transcript passes through the same deterministic normalization
              and normalized-WER evaluation layer.
            </p>
          </div>
          <ol>
            {METHODOLOGY.map((item, index) => (
              <li key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></li>
            ))}
          </ol>
        </section>
      </div>

      <footer className="voicebridge-footer">
        <div className="voicebridge-shell">
          <div><img src="/tengacion_logo_64.png" alt="" /><span>Tengacion VoiceBridge</span></div>
          <p>Phase 3 | Sahara v2.5 + GPT-Transcribe + Whisper-1 + Chirp 3 + voicebridge-nwer-v1</p>
        </div>
      </footer>
    </main>
  );
}
