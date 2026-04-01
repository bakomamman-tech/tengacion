const normalizeValue = (value = "") => String(value || "").trim().toLowerCase();

const getCanonicalOrigin = () => {
  if (typeof window === "undefined") {
    return "https://tengacion.com";
  }

  if (window.location?.hostname === "www.tengacion.com") {
    return "https://tengacion.com";
  }

  return window.location.origin || "https://tengacion.com";
};

export const normalizePurchaseType = (value = "") => {
  const type = normalizeValue(value);

  if (["track", "song", "music", "single", "audio"].includes(type)) {
    return "track";
  }

  if (["book", "books", "ebook", "ebooks", "document"].includes(type)) {
    return "book";
  }

  if (["podcast", "episode", "episodes"].includes(type)) {
    return "podcast";
  }

  if (["album", "ep"].includes(type)) {
    return "album";
  }

  if (["video", "film", "movie"].includes(type)) {
    return "video";
  }

  return type;
};

export const buildPaystackCallbackUrl = ({
  returnTo = "",
  itemType = "",
  itemId = "",
} = {}) => {
  if (typeof window === "undefined") {
    return "";
  }

  const url = new URL("/payment/verify", getCanonicalOrigin());
  if (returnTo) {
    url.searchParams.set("returnTo", String(returnTo));
  }
  if (itemType) {
    url.searchParams.set("itemType", String(itemType));
  }
  if (itemId) {
    url.searchParams.set("itemId", String(itemId));
  }
  return url.toString();
};

export const safeReturnTo = (value = "/purchases") => {
  if (typeof window === "undefined") {
    return "/purchases";
  }

  try {
    const resolved = new URL(String(value || "").trim() || "/purchases", window.location.origin);
    if (resolved.origin !== window.location.origin) {
      return "/purchases";
    }
    if (resolved.pathname === "/payments/callback" || resolved.pathname === "/payment/verify") {
      return "/purchases";
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}` || "/purchases";
  } catch {
    return "/purchases";
  }
};

export const resolveOwnedPurchaseLabel = (item = {}) => {
  const type = normalizePurchaseType(item.itemType || item.productType || item.mediaType);
  const mediaType = normalizeValue(item.mediaType);

  if (item.canDownload || item.downloadUrl) {
    if (type === "book" || mediaType === "document") {
      return "Read now";
    }
    if (type === "podcast") {
      return "Download now";
    }
    if (type === "video") {
      return "Watch now";
    }
    return "Download now";
  }

  if (type === "book" || mediaType === "document") {
    return "Read now";
  }

  if (type === "podcast") {
    return "Listen now";
  }

  if (type === "album") {
    return "Open album";
  }

  if (type === "video" || mediaType === "video") {
    return "Watch now";
  }

  return "Listen now";
};

export const resolvePurchaseCtaLabel = (item = {}, { busy = false } = {}) => {
  if (busy) {
    return "Opening secure checkout...";
  }

  const type = normalizePurchaseType(item.itemType || item.productType || item.mediaType);
  const amount = Number(item.price ?? item.amount ?? 0);
  const currency = String(item.currency || "NGN").toUpperCase();

  if (amount <= 0) {
    if (type === "book" || item.mediaType === "document") {
      return "Open book";
    }
    if (type === "podcast") {
      return "Open episode";
    }
    if (type === "video") {
      return "Watch now";
    }
    return "Open now";
  }

  const formatted = `${currency} ${amount.toLocaleString()}`;

  if (type === "book" || item.mediaType === "document") {
    return `Unlock book for ${formatted}`;
  }
  if (type === "podcast") {
    return `Unlock episode for ${formatted}`;
  }
  if (type === "album") {
    return `Unlock album for ${formatted}`;
  }
  if (type === "video") {
    return `Unlock video for ${formatted}`;
  }
  return `Unlock for ${formatted}`;
};
