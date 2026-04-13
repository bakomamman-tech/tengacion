const { findFeatureByIntent, findFeatureByRoute, resolveSurfaceFromPath } = require("./featureRegistry");
const { sanitizePlainText } = require("./outputSanitizer");

const normalize = (value = "") => sanitizePlainText(value, 1200).toLowerCase();

const PROMPT_INJECTION_PATTERNS = [
  /ignore (?:all|previous|earlier) instructions/i,
  /reveal (?:your|the) (?:system|developer|internal|hidden) prompt/i,
  /show (?:me )?(?:your|the) (?:system|developer|internal) instructions/i,
  /act as (?:an? )?(?:admin|super admin|system|root|developer)/i,
  /override (?:your|the) policies/i,
  /bypass (?:safety|security|rules|policy)/i,
  /print (?:your|the) secret/i,
  /give me (?:your|the) api key/i,
  /send me (?:your|the) otp/i,
  /show (?:me )?(?:your|the) session token/i,
  /show (?:me )?(?:your|the) jwt/i,
];

const EMERGENCY_PATTERNS = [
  /chest pain/i,
  /trouble breathing/i,
  /difficulty breathing/i,
  /stroke symptoms/i,
  /\bstroke\b/i,
  /severe bleeding/i,
  /uncontrolled bleeding/i,
  /seizure/i,
  /poisoning/i,
  /overdose/i,
  /severe allergic reaction/i,
  /\banaphylaxis\b/i,
  /pregnancy emergency/i,
  /suicidal/i,
  /want to die/i,
  /kill myself/i,
];

const DISALLOWED_PATTERNS = [
  /credential theft/i,
  /steal (?:an? )?(?:password|token|otp|session|jwt|api key)/i,
  /phishing/i,
  /fraud/i,
  /scam/i,
  /hack/i,
  /malware/i,
  /ransomware/i,
  /extremis/i,
  /child sexual/i,
  /sexual exploitation/i,
  /drug manufacturing/i,
  /build a bomb/i,
  /make explosives/i,
  /impersonat/i,
];

const SENSITIVE_ACCOUNT_PATTERNS = [
  /password/i,
  /otp/i,
  /session token/i,
  /refresh token/i,
  /api key/i,
  /jwt/i,
  /bank details/i,
  /card number/i,
  /withdraw/i,
  /transfer money/i,
  /send money/i,
  /delete my account/i,
  /change (?:my )?(?:security|payment|bank)/i,
  /change (?:my )?password/i,
];

const AUTOMATION_VERB_PATTERN = /\b(send|message|dm|post|publish|buy|purchase|withdraw|transfer|delete|change|update|follow|unfollow|like|share|open|navigate|join|leave|report|block)\b/i;
const AUTOMATION_REQUEST_PATTERN = /\b(automatically|on my behalf|for me|without asking|without confirming|without my permission)\b/i;

const MEDICAL_PATTERNS = [/\bmedical\b/i, /\bhealth\b/i, /\bwellness\b/i, /\bsymptom\b/i, /\bmedicine\b/i, /\bdrug\b/i, /\bpregnan/i];
const FINANCIAL_PATTERNS = [/\bfinance\b/i, /\binvest/i, /\bloan\b/i, /\btax\b/i, /\bbudget\b/i, /\brevenue\b/i, /\bearnings\b/i, /\bpayout\b/i, /\bwithdraw\b/i];
const LEGAL_PATTERNS = [/\blegal\b/i, /\blaw\b/i, /\bcontract\b/i, /\bcourt\b/i, /\blawyer\b/i, /\bcase\b/i];
const WRITING_PATTERNS = [/\bcaption\b/i, /\bbio\b/i, /\bblurb\b/i, /\bpost\b/i, /\barticle\b/i, /\bsummary\b/i, /\brewrite\b/i, /\bshorten\b/i, /\bpolish\b/i, /\bpersuasive\b/i, /\bprofessional\b/i, /\bpromotional\b/i, /\blaunch\b/i, /\bhook\b/i];
const MATH_PATTERNS = [/\bcalculate\b/i, /\bsolve\b/i, /\bmath\b/i, /\bpercentage\b/i, /\bfraction\b/i, /\bequation\b/i, /\balgebra\b/i, /\bdivide\b/i, /\bmultiply\b/i, /\bsubtract\b/i, /\badd\b/i, /\broot\b/i];
const HEALTH_WARNING_PATTERNS = [/\bfever\b/i, /\bcough\b/i, /\brash\b/i, /\bheadache\b/i, /\bnausea\b/i, /\bvomit/i, /\bpain\b/i, /\bdizzy/i];
const GENERAL_HELP_PATTERNS = [/\bwhat can (?:i|you) do\b/i, /\bwhat can (?:i|you) do here\b/i, /\bwhat are my options\b/i, /\bhelp\b/i, /\bhow does this work\b/i, /\bwhere do i\b/i, /\bhow do i\b/i, /\bopen\b/i, /\bshow me\b/i, /\btake me to\b/i];

const extractTopic = (message = "") => {
  const text = sanitizePlainText(message, 240);
  const cleaned = text
    .replace(/^(please\s+)?(take me to|open|go to|go|show me|show|find|search for|search|help me find|help me upload|help me|draft|write|create|explain|teach me about)\b[:\s-]*/i, "")
    .trim();
  return cleaned || text;
};

const hasPattern = (message = "", patterns = []) => patterns.some((pattern) => pattern.test(message));

const detectPromptInjection = (message = "") => hasPattern(message, PROMPT_INJECTION_PATTERNS);
const detectEmergency = (message = "") => hasPattern(message, EMERGENCY_PATTERNS);
const detectDisallowed = (message = "") => hasPattern(message, DISALLOWED_PATTERNS);
const detectAutomatedAction = (message = "") => AUTOMATION_VERB_PATTERN.test(message) && AUTOMATION_REQUEST_PATTERN.test(message);
const detectSensitiveAction = (message = "") => hasPattern(message, SENSITIVE_ACCOUNT_PATTERNS) || detectAutomatedAction(message);
const detectMedical = (message = "") => hasPattern(message, MEDICAL_PATTERNS);
const detectFinancial = (message = "") => hasPattern(message, FINANCIAL_PATTERNS);
const detectLegal = (message = "") => hasPattern(message, LEGAL_PATTERNS);
const detectWriting = (message = "") => hasPattern(message, WRITING_PATTERNS);
const detectMath = (message = "") => hasPattern(message, MATH_PATTERNS) || /[0-9].*[\+\-\*\/\^]/.test(message);
const detectGeneralHelp = (message = "") => hasPattern(message, GENERAL_HELP_PATTERNS);
const detectHealthWarning = (message = "") => hasPattern(message, HEALTH_WARNING_PATTERNS);

const classifyAssistantRequest = ({ message = "", context = {}, user = null, preferences = {} } = {}) => {
  const normalizedMessage = normalize(message);
  const surface = resolveSurfaceFromPath(context?.currentPath || "");
  const access = String(user?.role || "").trim().toLowerCase() === "admin" || String(user?.role || "").trim().toLowerCase() === "super_admin"
    ? "admin"
    : context?.isCreator
      ? "creator"
      : "authenticated";
  const featureMatch =
    findFeatureByIntent(normalizedMessage, {
      access,
    }) || findFeatureByRoute(context?.currentPath || "");

  const base = {
    category: "knowledge",
    mode: "knowledge",
    topic: extractTopic(message),
    surface,
    feature: featureMatch,
    featureId: featureMatch?.id || "",
    confidence: 0.5,
    safety: { level: "safe", notice: "", escalation: "" },
    requiresAuth: Boolean(user?.id),
    reasons: [],
    followUps: [],
    routeHint: featureMatch?.route || "",
    actionHint: "",
  };

  if (detectPromptInjection(normalizedMessage)) {
    return {
      ...base,
      category: "prompt_injection",
      mode: "refusal",
      confidence: 0.99,
      safety: {
        level: "refusal",
        notice: "I cannot help extract hidden instructions, secrets, or internal configuration.",
        escalation: "",
      },
      reasons: ["prompt_injection"],
      followUps: ["Ask me about a Tengacion feature", "Ask for a caption or explanation instead"],
    };
  }

  if (detectEmergency(normalizedMessage)) {
    return {
      ...base,
      category: "emergency",
      mode: "emergency",
      confidence: 0.98,
      safety: {
        level: "emergency",
        notice: "This sounds urgent. Please contact your GP, a licensed clinician, or emergency services immediately.",
        escalation: "emergency-care",
      },
      reasons: ["emergency"],
      followUps: [],
    };
  }

  if (detectDisallowed(normalizedMessage)) {
    return {
      ...base,
      category: "disallowed",
      mode: "refusal",
      confidence: 0.97,
      safety: {
        level: "refusal",
        notice: "I can't help with fraud, hacking, credential theft, exploitation, or similar harmful requests.",
        escalation: "",
      },
      reasons: ["disallowed"],
      followUps: ["Ask for a safe alternative", "Ask for general safety guidance"],
    };
  }

  if (detectSensitiveAction(normalizedMessage)) {
    const routeHint =
      featureMatch?.route ||
      (/\b(messages?|inbox|chat)\b/.test(normalizedMessage) ? "/messages" : "") ||
      (/\bprivacy\b/.test(normalizedMessage) ? "/settings/privacy" : "") ||
      (/\bsecurity\b/.test(normalizedMessage) || /\bpassword\b/.test(normalizedMessage) ? "/settings/security" : "") ||
      (/\bcreator\b/.test(normalizedMessage) && /\bpayout/i.test(normalizedMessage) ? "/creator/payouts" : "");

    return {
      ...base,
      category: "sensitive_action",
      mode: "copilot",
      confidence: 0.9,
      safety: {
        level: "caution",
        notice: "I can point you to the secure page, but I cannot perform sensitive actions for you.",
        escalation: "",
      },
      reasons: ["sensitive_action"],
      routeHint,
      actionHint: routeHint ? "navigate" : "",
      followUps: routeHint
        ? [`Open ${featureMatch?.title || "the secure page"}`]
        : ["Open the relevant secure page", "Ask for the safe next step"],
    };
  }

  if (/\b(find|search|discover)\b/i.test(normalizedMessage) && /\b(creator|creators|artist|artists|author|authors|book|books|podcast|podcasts|profile|handle)\b/i.test(normalizedMessage)) {
    const discoveryFeature = findFeatureByRoute("/find-creators") || findFeatureByIntent("find creators", { access }) || featureMatch;

    return {
      ...base,
      category: "app_guidance",
      mode: "copilot",
      feature: discoveryFeature,
      featureId: discoveryFeature?.id || "creator_discovery",
      confidence: 0.89,
      safety: { level: "safe", notice: "", escalation: "" },
      reasons: ["creator_discovery"],
      routeHint: "/find-creators",
      actionHint: "navigate",
      followUps: ["Open creator discovery", "Find music creators", "Find book creators"],
    };
  }

  if (detectMedical(normalizedMessage)) {
    const isSerious = detectHealthWarning(normalizedMessage) || /\bchest pain\b|\bbreathing\b|\bstroke\b|\bseizure\b|\bbleeding\b|\bpoison\b|\ballergic\b/i.test(normalizedMessage);

    return {
      ...base,
      category: "medical",
      mode: "health",
      confidence: 0.85,
      safety: {
        level: isSerious ? "emergency" : "caution",
        notice: isSerious
          ? "If this could be serious, contact your GP, a licensed doctor, or emergency services immediately."
          : "I can share general wellness information, but I am not a doctor and cannot diagnose you.",
        escalation: isSerious ? "medical-emergency" : "",
      },
      reasons: [isSerious ? "medical_emergency" : "medical_caution"],
      followUps: isSerious ? [] : ["Ask for general wellness tips", "Ask what signs mean urgent care"],
    };
  }

  if (detectFinancial(normalizedMessage) || detectLegal(normalizedMessage)) {
    return {
      ...base,
      category: detectFinancial(normalizedMessage) ? "financial" : "legal",
      mode: "knowledge",
      confidence: 0.78,
      safety: {
        level: "caution",
        notice: detectFinancial(normalizedMessage)
          ? "I can give high-level financial education, but not personal financial advice."
          : "I can give high-level legal information, but not legal advice.",
        escalation: "",
      },
      reasons: [detectFinancial(normalizedMessage) ? "financial" : "legal"],
      followUps: ["Ask for a simpler explanation", "Ask for practical next steps"],
    };
  }

  if (detectWriting(normalizedMessage)) {
    return {
      ...base,
      category: "writing",
      mode: "writing",
      confidence: 0.87,
      safety: { level: "safe", notice: "", escalation: "" },
      reasons: ["writing"],
      followUps: ["Make it more premium", "Rewrite it for fans", "Shorten it into a caption"],
      writingTopic: base.topic,
      writingPreferences: preferences,
    };
  }

  if (detectMath(normalizedMessage)) {
    return {
      ...base,
      category: "math",
      mode: "math",
      confidence: 0.83,
      safety: { level: "safe", notice: "", escalation: "" },
      reasons: ["math"],
      followUps: ["Show every step", "Check my answer", "Solve another problem"],
    };
  }

  if (detectGeneralHelp(normalizedMessage)) {
    const routeHint = featureMatch?.route || "";
    return {
      ...base,
      category: "app_guidance",
      mode: "copilot",
      confidence: 0.91,
      safety: { level: "safe", notice: "", escalation: "" },
      reasons: ["app_guidance"],
      routeHint,
      actionHint: routeHint ? "navigate" : "explain",
      followUps: routeHint
        ? [`Open ${featureMatch?.title || "the relevant page"}`]
        : ["Show me the available shortcuts", "Find creators", "Open settings"],
    };
  }

  if (featureMatch) {
    return {
      ...base,
      category: "app_guidance",
      mode: "copilot",
      confidence: 0.84,
      safety: { level: "safe", notice: "", escalation: "" },
      reasons: ["feature_match"],
      routeHint: featureMatch.route || "",
      actionHint: featureMatch.route ? "navigate" : "explain",
      followUps: [...(featureMatch.quickPrompts || [])].slice(0, 4),
    };
  }

  return base;
};

module.exports = {
  classifyAssistantRequest,
  detectDisallowed,
  detectEmergency,
  detectFinancial,
  detectGeneralHelp,
  detectLegal,
  detectMath,
  detectMedical,
  detectPromptInjection,
  detectSensitiveAction,
  detectWriting,
  detectHealthWarning,
  extractTopic,
};
