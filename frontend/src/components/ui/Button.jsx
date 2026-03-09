import { buttonStyles, cx } from "./buttonStyles";

export default function Button({
  variant = "secondary",
  size = "md",
  iconOnly = false,
  loading = false,
  fullWidth = false,
  pressed = false,
  className = "",
  disabled = false,
  children,
  type,
  ...props
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type || "button"}
      className={buttonStyles({
        variant,
        size,
        iconOnly,
        loading,
        fullWidth,
        pressed,
        className,
      })}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      <span className="tg-btn__inner">
        <span className={cx("tg-btn__spinner", loading && "is-visible")} aria-hidden="true" />
        <span className="tg-btn__content">{children}</span>
      </span>
    </button>
  );
}
