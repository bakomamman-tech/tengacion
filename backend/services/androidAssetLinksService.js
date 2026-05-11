const ANDROID_PACKAGE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const SHA256_HEX_PATTERN = /^[A-F0-9]{64}$/;
const SHA256_COLON_PATTERN = /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/;

const normalizePackageName = (value = "") => {
  const packageName = String(value || "").trim();
  return ANDROID_PACKAGE_PATTERN.test(packageName) ? packageName : "";
};

const normalizeFingerprint = (value = "") => {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) {
    return "";
  }

  const compact = raw.replace(/[^A-F0-9]/g, "");
  if (!SHA256_HEX_PATTERN.test(compact)) {
    return "";
  }

  const colonSeparated = compact.match(/.{2}/g).join(":");
  return SHA256_COLON_PATTERN.test(colonSeparated) ? colonSeparated : "";
};

const normalizeFingerprints = (values = []) => {
  const source = Array.isArray(values) ? values : String(values || "").split(/[,\n]+/);
  return [
    ...new Set(source.map((entry) => normalizeFingerprint(entry)).filter(Boolean)),
  ];
};

const buildAndroidAssetLinks = ({
  packageName = "",
  sha256CertFingerprints = [],
} = {}) => {
  const normalizedPackageName = normalizePackageName(packageName);
  const normalizedFingerprints = normalizeFingerprints(sha256CertFingerprints);

  if (!normalizedPackageName || normalizedFingerprints.length === 0) {
    return null;
  }

  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: normalizedPackageName,
        sha256_cert_fingerprints: normalizedFingerprints,
      },
    },
  ];
};

const buildAndroidAssetLinksFromConfig = (config = {}) =>
  buildAndroidAssetLinks({
    packageName: config.androidTwa?.packageName || config.androidTwaPackageName,
    sha256CertFingerprints:
      config.androidTwa?.sha256CertFingerprints ||
      config.androidTwaSha256CertFingerprints ||
      [],
  });

module.exports = {
  buildAndroidAssetLinks,
  buildAndroidAssetLinksFromConfig,
  normalizeFingerprint,
  normalizeFingerprints,
  normalizePackageName,
};
