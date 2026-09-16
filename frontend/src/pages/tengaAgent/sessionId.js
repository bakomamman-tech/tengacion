const bytesToUuid = (bytes) => {
  const copy = Uint8Array.from(bytes);

  // RFC 4122 version 4 / variant bits.
  copy[6] = (copy[6] & 0x0f) | 0x40;
  copy[8] = (copy[8] & 0x3f) | 0x80;

  const hex = Array.from(copy, (value) =>
    value.toString(16).padStart(2, "0")
  );

  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
};

export const createTengaAgentSessionId = (
  cryptoSource = globalThis.crypto
) => {
  if (typeof cryptoSource?.randomUUID === "function") {
    return cryptoSource.randomUUID();
  }

  if (typeof cryptoSource?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoSource.getRandomValues(bytes);
    return bytesToUuid(bytes);
  }

  throw new Error(
    "Secure browser randomness is required to start a TengaAgent session."
  );
};

export const readTengaAgentSessionId = (
  storageKey,
  storage =
    typeof window !== "undefined"
      ? window.sessionStorage
      : null,
  cryptoSource = globalThis.crypto
) => {
  if (!storage) {
    return createTengaAgentSessionId(cryptoSource);
  }

  try {
    const existing = storage.getItem(storageKey);

    if (existing) {
      return existing;
    }

    const created = createTengaAgentSessionId(
      cryptoSource
    );
    storage.setItem(storageKey, created);
    return created;
  } catch (error) {
    // Storage can be disabled by browser privacy settings. Preserve a secure
    // in-memory session rather than falling back to weak randomness.
    if (
      error?.message ===
      "Secure browser randomness is required to start a TengaAgent session."
    ) {
      throw error;
    }

    return createTengaAgentSessionId(
      cryptoSource
    );
  }
};
