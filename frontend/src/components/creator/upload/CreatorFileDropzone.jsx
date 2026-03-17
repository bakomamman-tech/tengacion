import { useId, useRef, useState } from "react";

const formatBytes = (value = 0) => {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return "";
  }
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const normalized = size / 1024 ** index;
  return `${normalized.toFixed(normalized >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

export default function CreatorFileDropzone({
  label,
  helper,
  accept,
  file,
  error = "",
  formats = "",
  icon = "F",
  onChange,
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const handleSelect = (nextFile) => {
    setDragActive(false);
    if (!nextFile && inputRef.current) {
      inputRef.current.value = "";
    }
    onChange(nextFile || null);
  };

  return (
    <div
      className={`creator-dropzone${dragActive ? " is-dragging" : ""}${file ? " has-file" : ""}${error ? " has-error" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) {
          return;
        }
        setDragActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        handleSelect(event.dataTransfer?.files?.[0] || null);
      }}
    >
      <input
        id={inputId}
        ref={inputRef}
        className="creator-dropzone-input"
        type="file"
        accept={accept}
        onChange={(event) => handleSelect(event.target.files?.[0] || null)}
      />

      <button
        type="button"
        className="creator-dropzone-surface"
        onClick={() => {
          if (inputRef.current) {
            inputRef.current.value = "";
            inputRef.current.click();
          }
        }}
      >
        <span className="creator-dropzone-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="creator-dropzone-copy">
          <strong>{label}</strong>
          <span>{file ? file.name : helper}</span>
        </span>
        <span className="creator-dropzone-action">{file ? "Replace file" : "Browse or drop"}</span>
      </button>

      <div className="creator-dropzone-meta">
        <span>{file ? formatBytes(file.size) : formats}</span>
        {file ? (
          <button type="button" className="creator-dropzone-clear" onClick={() => handleSelect(null)}>
            Remove
          </button>
        ) : null}
      </div>

      {error ? <p className="creator-field-error">{error}</p> : null}
    </div>
  );
}
