import { useState } from "react";
import { Link } from "react-router-dom";

import SeoHead from "../components/seo/SeoHead";
import Button from "../components/ui/Button";

import "./codeswitch.css";

const LANGUAGE_PAIRS = [
  "Hausa ↔ English",
  "Nigerian Pidgin ↔ English",
];

const MODEL_FIELDS = [
  "Original transcript",
  "Normalized transcript",
  "Normalized WER",
  "Substitutions",
  "Deletions",
  "Insertions",
  "Latency",
];

const MODELS = [
  { name: "Sahara v2.5", label: "SA", tone: "sand" },
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
  "Every transcript will use the same deterministic normalization function.",
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
    chart: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
    methodology: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
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

function ModelCard({ model }) {
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
        <span className="voicebridge-status">Awaiting Phase 2/3</span>
      </header>
      <dl>
        {MODEL_FIELDS.map((field) => (
          <div key={field}>
            <dt>{field}</dt>
            <dd aria-label={`${model.name} ${field}: awaiting integration`}>—</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export default function CodeSwitchPage() {
  const [languagePair, setLanguagePair] = useState(LANGUAGE_PAIRS[0]);
  const [audioFile, setAudioFile] = useState(null);

  const handleAudioSelection = (event) => {
    setAudioFile(event.target.files?.[0] || null);
  };

  return (
    <main className="voicebridge-page">
      <SeoHead
        title="Tengacion VoiceBridge | African Code-Switching Voice Intelligence"
        description="Phase 1 of Tengacion VoiceBridge: deterministic transcript normalization and normalized WER foundations for African digital-commerce support."
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
            Phase 1 · Evaluation foundation
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
              A fair, shared evaluation layer for Hausa, Nigerian Pidgin, and
              English customer-support speech—before any provider is connected.
            </p>
            <a className="voicebridge-hero__link" href="#voice-assistant">
              Explore the evaluation workspace
              <VoiceBridgeIcon name="arrow" size={19} />
            </a>
          </div>

          <div className="voicebridge-signal" aria-label="VoiceBridge Phase 1 signal preview">
            <div className="voicebridge-signal__topline">
              <span>Voice input</span>
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
              <span>HA</span>
              <i />
              <strong>Shared normalization</strong>
              <i />
              <span>EN</span>
            </div>
            <div className="voicebridge-signal__footer">
              <span>One source</span>
              <span>Three models</span>
              <span>One fair metric</span>
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
            title="Start with one source of truth"
            detail="Stage an audio sample and select the language pair. Audio remains local in Phase 1."
          />

          <div className="voicebridge-input-panel">
            <div className="voicebridge-input-panel__controls">
              <div className="voicebridge-field">
                <label htmlFor="voicebridge-language">Language pair</label>
                <div className="voicebridge-select-wrap">
                  <select
                    id="voicebridge-language"
                    value={languagePair}
                    onChange={(event) => setLanguagePair(event.target.value)}
                  >
                    {LANGUAGE_PAIRS.map((pair) => (
                      <option key={pair} value={pair}>{pair}</option>
                    ))}
                  </select>
                  <span aria-hidden="true">⌄</span>
                </div>
              </div>

              <div className="voicebridge-audio-actions">
                <Button variant="primary" size="lg" disabled title="Recording arrives in a later phase">
                  <VoiceBridgeIcon name="microphone" size={20} />
                  Record audio
                </Button>
                <label className="voicebridge-upload-control">
                  <VoiceBridgeIcon name="upload" size={20} />
                  <span>Upload audio</span>
                  <input
                    type="file"
                    accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm"
                    aria-label="Upload audio"
                    onChange={handleAudioSelection}
                  />
                </label>
              </div>
            </div>

            <div className="voicebridge-file-state" aria-live="polite">
              <span className="voicebridge-file-state__icon">
                <VoiceBridgeIcon name={audioFile ? "check" : "upload"} size={21} />
              </span>
              <div>
                <strong>{audioFile ? audioFile.name : "No audio staged yet"}</strong>
                <p>
                  {audioFile
                    ? "Staged locally—no upload or transcription occurs in Phase 1."
                    : "WAV, MP3, M4A, OGG, or WebM · External transcription is not enabled."}
                </p>
              </div>
              <span className="voicebridge-file-state__pair">{languagePair}</span>
            </div>
          </div>
        </section>

        <section className="voicebridge-section">
          <SectionHeading
            number="02"
            icon="compare"
            eyebrow="Model comparison"
            title="One benchmark, side by side"
            detail="Provider connections and live transcript results begin in Phase 2/3."
          />
          <div className="voicebridge-model-grid">
            {MODELS.map((model) => <ModelCard key={model.name} model={model} />)}
          </div>
        </section>

        <section className="voicebridge-section voicebridge-two-column">
          <div>
            <SectionHeading
              number="03"
              icon="task"
              eyebrow="Downstream task"
              title="From speech to resolution"
              detail="Intent and task-success evaluation stays separate from transcription accuracy."
            />
            <article className="voicebridge-task-card">
              <div className="voicebridge-task-card__flow" aria-hidden="true">
                <span>Speech</span><i />
                <span>Intent</span><i />
                <span>Action</span>
              </div>
              <dl>
                {DOWNSTREAM_FIELDS.map((field) => (
                  <div key={field}>
                    <dt>{field}</dt>
                    <dd>Awaiting future evaluation</dd>
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
              detail="Aggregate results will populate after equivalent model runs are available."
            />
            <div className="voicebridge-summary-grid">
              {SUMMARY_FIELDS.map((metric) => (
                <article key={metric.label}>
                  <span>{metric.shortLabel}</span>
                  <strong>—</strong>
                  <p>{metric.label}</p>
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
              Provider-independent evaluation keeps the benchmark focused on
              what customers actually said—not on vendor-specific cleanup.
            </p>
          </div>
          <ol>
            {METHODOLOGY.map((item, index) => (
              <li key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <footer className="voicebridge-footer">
        <div className="voicebridge-shell">
          <div>
            <img src="/tengacion_logo_64.png" alt="" />
            <span>Tengacion VoiceBridge</span>
          </div>
          <p>Phase 1 · Deterministic normalization and normalized WER foundation</p>
        </div>
      </footer>
    </main>
  );
}
