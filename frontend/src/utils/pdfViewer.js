export const buildPdfViewerSrc = (src = "") => {
  const value = String(src || "").trim();
  if (!value) {
    return "";
  }

  const viewerOptions = "toolbar=0&navpanes=0&scrollbar=1";
  if (value.includes("#")) {
    return `${value}&${viewerOptions}`;
  }
  return `${value}#${viewerOptions}`;
};
