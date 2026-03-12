const parseCookieHeader = (cookieHeader = "") => {
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) {
        return acc;
      }
      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (!key) {
        return acc;
      }
      acc[key] = decodeURIComponent(value || "");
      return acc;
    }, {});
};

const getCookieValue = (cookieHeader = "", cookieName = "") => {
  if (!cookieName) {
    return "";
  }
  const cookies = parseCookieHeader(cookieHeader);
  return String(cookies[cookieName] || "").trim();
};

module.exports = {
  parseCookieHeader,
  getCookieValue,
};
