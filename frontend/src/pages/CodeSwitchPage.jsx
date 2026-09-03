import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import SeoHead from "../components/seo/SeoHead";
import Button from "../components/ui/Button";
import {
  calculateCodeswitchWer,
  transcribeWithSahara,
} from "../services/codeswitchApi";

import "./codeswitch.css";

const LANGUAGE_PAIRS = [
  { value: "ha-en", label: "Hausa ↔ English", code: "ha" },
  { value: "pcm-en", label: "Nigerian Pidgin ↔ English", code: "pcm" },
];

const PENDING_MODEL_FIELDS = [
  "Original transcript",
  "Normalized transcript",
  "Normalized WER",
  "Substitutions",
  "Deletions",
  "Insertions",
  "Latency",
];

const PENDING_MODELS = [
  { name: "Gemini", label: "GE", tone: "blue" },
  { name: "OpenAI", label: "OA", tone: "green" },
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

function PendingModelCard({ model }) {
  return (
    <article className={`voicebridge-model-card voicebridge-model-card--${model.tone}`}>
      <header>
        <span className="voicebridge-model-card__mark" aria-hidden="true">
          {model.label}
        </span>
        <div>
          <h3>{model.name}</h3>
          <p>ASR evaluation model</p>
        </div>
        <span className="voicebridge-status">Not integrated</span>
      </header>
      <dl>
        {PENDING_MODEL_FIELDS.map((field) => (
          <div key={field}>
            <dt>{field}</dt>
            <dd aria-label={`${model.name} ${field}: not integrated`}>—</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

const displayMetric = (value) =>
  Number.isFinite(value) ? String(value) : "—";

function SaharaModelCard({ result, evaluation, languagePairLabel, isLoading }) {
  const werDisplay = evaluation
    ? evaluation.wer === null
      ? "Undefined"
      : Number.isFinite(evaluation.wer)
        ? evaluation.wer.toFixed(3)
        : "Unavailable"
    : result
      ? "Reference transcript required for WER."
      : "—";

  return (
    <article
      className="voicebridge-model-card voicebridge-model-card--sand voicebridge-model-card--active"
      data-testid="sahara-model-card"
    >
      <header>
        <span className="voicebridge-model-card__mark" aria-hidden="true">SA</span>
        <div>
          <h3>Sahara v2.5</h3>
          <p>Intron synchronous transcription</p>
        </div>
        <span className={`voicebridge-status${result ? " is-ready" : ""}`}>
          {isLoading ? "Transcribing" : result ? "Live result" : "Ready for Phase 2"}
        </span>
      </header>
      <dl>
        <div><dt>Language pair</dt><dd>{result ? languagePairLabel : "—"}</dd></div>
        <div className="voicebridge-model-card__text-row">
          <dt>Original transcript</dt>
          <dd>{result ? result.transcript || "No speech recognized" : "—"}</dd>
        </div>
        <div className="voicebridge-model-card__text-row">
          <dt>Normalized transcript</dt>
          <dd>{result ? result.normalizedTranscript || "No speech recognized" : "—"}</dd>
        </div>
        <div><dt>Normalization version</dt><dd>{result?.normalizationVersion || "voicebridge-nwer-v1"}</dd></div>
        <div><dt>Normalized WER</dt><dd>{werDisplay}</dd></div>
        <div><dt>Substitutions</dt><dd>{displayMetric(evaluation?.substitutions)}</dd></div>
        <div><dt>Deletions</dt><dd>{displayMetric(evaluation?.deletions)}</dd></div>
        <div><dt>Insertions</dt><dd>{displayMetric(evaluation?.insertions)}</dd></div>
        <div>
          <dt>Latency</dt>
          <dd>
            {result
              ? Number.isFinite(result.latencyMs)
                ? `${result.latencyMs.toLocaleString()} ms`
                : "Not reported"
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Processed duration</dt>
          <dd>
            {result
              ? Number.isFinite(result.processedAudioDurationSeconds)
                ? `${result.processedAudioDurationSeconds} s`
                : "Not reported"
              : "—"}
          </dd>
        </div>
        <div><dt>Transcription status</dt><dd>{result?.processingStatus || "—"}</dd></div>
      </dl>
    </article>
  );
}

export default function CodeSwitchPage() {
  const [languagePair, setLanguagePair] = useState(LANGUAGE_PAIRS[0].value);
  const [audioFile, setAudioFile] = useState(null);
  const [referenceTranscript, setReferenceTranscript] = useState("");
  const [saharaResult, setSaharaResult] = useState(null);
  const [werResult, setWerResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const activeRequestRef = useRef(null);

  const selectedLanguage = useMemo(
    () => LANGUAGE_PAIRS.find((pair) => pair.value === languagePair) || LANGUAGE_PAIRS[0],
    [languagePair]
  );

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
    setSaharaResult(null);
    setWerResult(null);
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

  const handleTranscribe = async () => {
    if (!audioFile || isSubmitting) {
      return;
    }

    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setIsSubmitting(true);
    resetResults();

    try {
      const transcription = await transcribeWithSahara({
        audio: audioFile,
        languagePair,
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        return;
      }
      setSaharaResult(transcription);

      if (referenceTranscript.trim()) {
        try {
          const evaluation = await calculateCodeswitchWer({
            reference: referenceTranscript,
            hypothesis: transcription.transcript,
            signal: controller.signal,
          });
          if (!controller.signal.aborted) {
            setWerResult(evaluation);
          }
        } catch (evaluationError) {
          if (evaluationError?.name !== "AbortError") {
            setErrorMessage(
              `Transcription completed, but WER evaluation failed: ${evaluationError.message}`
            );
          }
        }
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        const retryHint = Number.isFinite(error?.retryAfterSeconds)
          ? ` Try again in ${error.retryAfterSeconds} seconds.`
          : "";
        setErrorMessage(`${error?.message || "Sahara transcription failed."}${retryHint}`);
      }
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
        setIsSubmitting(false);
      }
    }
  };

  return (
    <main className="voicebridge-page">
      <SeoHead
        title="Tengacion VoiceBridge | African Code-Switching Voice Intelligence"
        description="Phase 2 of Tengacion VoiceBridge adds benchmark-safe Sahara v2.5 transcription for Hausa and Nigerian Pidgin code-switching evaluation."
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
            Phase 2 · Sahara transcription
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
              Transcribe authorized Hausa–English and Nigerian Pidgin–English
              recordings with Sahara v2.5, then evaluate them with one shared metric.
            </p>
            <a className="voicebridge-hero__link" href="#voice-assistant">
              Open the Sahara workspace
              <VoiceBridgeIcon name="arrow" size={19} />
            </a>
          </div>

          <div className="voicebridge-signal" aria-label="VoiceBridge Sahara signal preview">
            <div className="voicebridge-signal__topline">
              <span>Sahara v2.5</span>
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
            title="Transcribe with Sahara"
            detail="Upload one authorized recording up to 25MB and 120 seconds, then optionally score it against a human reference."
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
                  setWerResult(null);
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
              <span><VoiceBridgeIcon name="shield" size={20} /></span>
              <p>
                Audio is sent to Sahara/Intron for transcription. VoiceBridge does not
                intentionally persist uploaded audio in this prototype. Avoid sensitive
                or private recordings unless you have authorization.
              </p>
            </div>

            <div className="voicebridge-transcribe-row">
              <div>
                <strong>Benchmark-safe mode</strong>
                <span>LLM transcript corrections are disabled.</span>
              </div>
              <Button
                variant="primary"
                size="lg"
                loading={isSubmitting}
                disabled={!audioFile}
                onClick={handleTranscribe}
              >
                <VoiceBridgeIcon name="arrow" size={19} />
                {isSubmitting ? "Transcribing with Sahara…" : "Transcribe with Sahara"}
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
            detail="Sahara is live in Phase 2. Gemini and OpenAI remain deliberately unconnected."
          />
          <div className="voicebridge-model-grid">
            <SaharaModelCard
              result={saharaResult}
              evaluation={werResult}
              languagePairLabel={selectedLanguage.label}
              isLoading={isSubmitting}
            />
            {PENDING_MODELS.map((model) => (
              <PendingModelCard key={model.name} model={model} />
            ))}
          </div>
        </section>

        <section className="voicebridge-section voicebridge-two-column">
          <div>
            <SectionHeading
              number="03"
              icon="task"
              eyebrow="Downstream task"
              title="From speech to resolution"
              detail="Intent and task-success evaluation remains outside Phase 2."
            />
            <article className="voicebridge-task-card">
              <div className="voicebridge-task-card__flow" aria-hidden="true">
                <span>Speech</span><i /><span>Intent</span><i /><span>Action</span>
              </div>
              <dl>
                {DOWNSTREAM_FIELDS.map((field) => (
                  <div key={field}><dt>{field}</dt><dd>Awaiting future evaluation</dd></div>
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
              Sahara receives raw benchmark-mode audio without LLM transcript
              correction, and every result passes through the shared evaluation layer.
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
          <p>Phase 2 · Sahara v2.5 + voicebridge-nwer-v1</p>
        </div>
      </footer>
    </main>
  );
}
