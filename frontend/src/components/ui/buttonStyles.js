const VARIANT_CLASS = {
  primary: "tg-btn--primary",
  secondary: "tg-btn--secondary",
  tertiary: "tg-btn--tertiary",
  ghost: "tg-btn--ghost",
  outline: "tg-btn--outline",
  destructive: "tg-btn--destructive",
  tab: "tg-btn--tab",
  icon: "tg-btn--icon",
  utility: "tg-btn--utility",
};

const SIZE_CLASS = {
  xs: "tg-btn--xs",
  sm: "tg-btn--sm",
  md: "tg-btn--md",
  lg: "tg-btn--lg",
};

export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function buttonStyles({
  variant = "secondary",
  size = "md",
  iconOnly = false,
  loading = false,
  fullWidth = false,
  pressed = false,
  className = "",
} = {}) {
  return cx(
    "tg-btn",
    VARIANT_CLASS[variant] || VARIANT_CLASS.secondary,
    SIZE_CLASS[size] || SIZE_CLASS.md,
    iconOnly && "tg-btn--icon-only",
    loading && "is-loading",
    fullWidth && "tg-btn--full",
    pressed && "is-active",
    className
  );
}
