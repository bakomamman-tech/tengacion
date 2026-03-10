import { useEffect, useState } from "react";

function EyeIcon({ visible }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.2 4.2l17.6 15.6" />
      <path d="M10 6.4A10.8 10.8 0 0 1 12 6c6.1 0 9.5 6 9.5 6a17.3 17.3 0 0 1-4 4.4" />
      <path d="M14.2 14a3 3 0 0 1-4.2-4" />
      <path d="M6.1 6.8A17 17 0 0 0 2.5 12s3.4 6 9.5 6a10.7 10.7 0 0 0 4-.7" />
    </svg>
  );
}

export default function AuthPasswordField({
  className = "",
  containerClassName = "",
  value = "",
  placeholder = "Password",
  autoComplete = "current-password",
  disabled = false,
  required = false,
  onChange,
  name,
}) {
  const [visible, setVisible] = useState(false);
  const showToggle = Boolean(value);

  useEffect(() => {
    if (!value && visible) {
      setVisible(false);
    }
  }, [value, visible]);

  return (
    <div className={`password-toggle-field ${containerClassName}`.trim()}>
      <input
        type={visible ? "text" : "password"}
        className={className}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        required={required}
        onChange={onChange}
        name={name}
      />
      {showToggle ? (
        <button
          type="button"
          className="password-toggle-btn"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          <EyeIcon visible={visible} />
        </button>
      ) : null}
    </div>
  );
}
