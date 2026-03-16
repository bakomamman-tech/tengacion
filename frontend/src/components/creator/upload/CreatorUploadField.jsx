export default function CreatorUploadField({
  icon = "",
  label,
  helper,
  accept,
  multiple = false,
  selectedText = "",
  onChange,
}) {
  const hasSelection = Boolean(selectedText);
  const inputKey = hasSelection ? selectedText : "empty";

  return (
    <label className={`creator-upload-field${hasSelection ? " is-selected" : ""}`}>
      <span className="creator-upload-field-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="creator-upload-field-copy">
        <strong>{label}</strong>
        <small>{hasSelection ? selectedText : helper}</small>
      </div>
      <input
        key={inputKey}
        className="creator-upload-field-input"
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
      />
    </label>
  );
}
