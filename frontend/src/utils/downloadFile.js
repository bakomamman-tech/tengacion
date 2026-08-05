export const triggerFileDownload = (url = "") => {
  const href = String(url || "").trim();
  if (!href || typeof document === "undefined") {
    return false;
  }

  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = "";
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
};
