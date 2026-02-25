const checks = [
  { key: "MONGO_URI", label: "MongoDB URI", type: "hard" },
  { key: "JWT_SECRET", label: "JWT secret", type: "hard", minLength: 32 },
  { key: "MEDIA_SIGNING_SECRET", label: "Media signing secret", type: "hard", minLength: 32 },
  { key: "FRONTEND_URL", label: "Frontend URL", type: "warn" },
  { key: "PAYSTACK_SECRET_KEY", label: "Paystack secret", type: "warn" },
  { key: "STRIPE_SECRET_KEY", label: "Stripe secret", type: "warn" },
  { key: "STRIPE_WEBHOOK_SECRET", label: "Stripe webhook secret", type: "warn" },
];

const statusIcons = {
  ok: "✅",
  missing: "❌",
  weak: "⚠️",
};

const runPreflight = () => {
  const results = [];
  let success = true;

  console.log("\n== Render preflight ==");

  checks.forEach((check) => {
    const value = process.env[check.key];
    let status = "ok";
    let note = "";

    if (!value) {
      status = "missing";
      note = "not set";
      if (check.type === "hard") {
        success = false;
      }
    } else if (check.minLength && value.length < check.minLength) {
      status = "weak";
      note = `too short (needs ≥ ${check.minLength} chars)`;
      if (check.type === "hard") {
        success = false;
      }
    }

    results.push({ ...check, status, note });
    const icon = statusIcons[status] || statusIcons.ok;
    const suffix = note ? ` — ${note}` : "";
    console.log(`${icon} ${check.label}${suffix}`);
  });

  if (!success) {
    console.error("\nPreflight failed: missing or invalid env vars detected.");
  } else {
    console.log("\nPreflight passed.");
  }

  return { success, results };
};

if (require.main === module) {
  const outcome = runPreflight();
  if (!outcome.success) {
    process.exit(1);
  }
}

module.exports = runPreflight;
