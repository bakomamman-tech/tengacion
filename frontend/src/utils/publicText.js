const normalizeFinanceShorthand = (value = "") =>
  String(value || "")
    .replace(
      /\b(?:USD|US\$)\s*\.(\d+)\s*(bn|billion|mn|million)\b/gi,
      (_, digits, unit) => `$0.${digits}${unit}`
    )
    .replace(
      /\$\s*\.(\d+)\s*(bn|billion|mn|million)\b/gi,
      (_, digits, unit) => `$0.${digits}${unit}`
    )
    .replace(
      /(^|[^\w$])\.(\d+)\s*(bn|billion|mn|million)\b/gi,
      (_, prefix, digits, unit) => `${prefix}$0.${digits}${unit}`
    );

export const normalizePublicText = (value = "") =>
  normalizeFinanceShorthand(value).replace(/\s+/g, " ").trim();

export const uniquePublicActivity = (items = []) => {
  const seen = new Set();

  return (Array.isArray(items) ? items : []).filter((item) => {
    const normalizedText = normalizePublicText(item?.text).toLowerCase();
    if (!normalizedText) {
      return true;
    }

    if (seen.has(normalizedText)) {
      return false;
    }

    seen.add(normalizedText);
    return true;
  });
};
