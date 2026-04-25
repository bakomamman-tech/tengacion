const { sanitizePlainText, sanitizeRoute } = require("./assistant/outputSanitizer");
const { findFeatureByIntent, findFeatureByRoute } = require("./akusoFeatureRegistryService");

const AKUSO_MODES = {
  AUTO: "auto",
  APP_HELP: "app_help",
  CREATOR_WRITING: "creator_writing",
  KNOWLEDGE_LEARNING: "knowledge_learning",
};

const PROMPT_INJECTION_PATTERNS = [
  /ignore (?:all|previous|earlier) instructions/i,
  /reveal (?:your|the) (?:system|developer|hidden|internal) prompt/i,
  /show (?:me )?(?:your|the) (?:system|developer|internal) instructions/i,
  /act as (?:an? )?(?:admin|system|developer|root)/i,
  /bypass (?:policy|safety|guardrails|rules)/i,
  /print (?:env|environment variables|secrets?)/i,
  /show (?:api keys?|tokens?|jwt|otp|database|private messages)/i,
  /dump (?:the )?(?:database|db|config)/i,
];

const DISALLOWED_PATTERNS = [
  /\bhack(?:ing)?\b/i,
  /\bphishing\b/i,
  /\bsteal\b.*\b(password|token|otp|api key|jwt)\b/i,
  /\bscam\b/i,
  /\bfraud\b/i,
  /\bmalware\b/i,
  /\bransomware\b/i,
  /\bbuild (?:a )?bomb\b/i,
  /\bdrug manufacturing\b/i,
  /\bsexual exploitation\b/i,
  /\bchild sexual\b/i,
];

const EMERGENCY_PATTERNS = [
  /\bchest pain\b/i,
  /\btrouble breathing\b/i,
  /\bdifficulty breathing\b/i,
  /\bseizure\b/i,
  /\boverdose\b/i,
  /\bsevere bleeding\b/i,
  /\banaphylaxis\b/i,
  /\bstroke\b/i,
  /\bsuicidal\b/i,
  /\bkill myself\b/i,
];

const MEDICAL_PATTERNS = [
  /\bmedical\b/i,
  /\bhealth\b/i,
  /\bsymptom\b/i,
  /\bdoctor\b/i,
  /\bmedicine\b/i,
  /\bprescription\b/i,
];

const LEGAL_PATTERNS = [/\blegal\b/i, /\blaw\b/i, /\bcontract\b/i, /\bcourt\b/i, /\blawyer\b/i];
const FINANCIAL_PATTERNS = [
  /\bfinance\b/i,
  /\binvest(?:ment)?\b/i,
  /\btax\b/i,
  /\bloan\b/i,
  /\bearnings\b/i,
  /\bpayout\b/i,
  /\bwithdraw\b/i,
];
const WRITING_PATTERNS = [
  /\bcaption\b/i,
  /\bbio\b/i,
  /\bblurb\b/i,
  /\brewrite\b/i,
  /\bpolish\b/i,
  /\bdraft\b/i,
  /\blaunch post\b/i,
  /\bteaser\b/i,
];
const APP_HELP_PATTERNS = [
  /\bhow do i\b/i,
  /\bwhere do i\b/i,
  /\bopen\b/i,
  /\bshow me\b/i,
  /\btake me to\b/i,
  /\bwhat can i do here\b/i,
  /\bhelp\b/i,
  /\bsettings\b/i,
  /\bdashboard\b/i,
  /\bmessages\b/i,
  /\bupload\b/i,
];
const REASONING_PATTERNS = [
  /\bsolve\b/i,
  /\bcalculate\b/i,
  /\bcalculator\b/i,
  /\bmath\b/i,
  /\bequation\b/i,
  /\bengineering\b/i,
  /\bphysics\b/i,
  /\bscience\b/i,
  /\bstep by step\b/i,
  /[0-9].*[\+\-\*\/]/,
];
const SOFTWARE_ENGINEERING_PATTERNS = [
  /\bcode\b/i,
  /\bcoding\b/i,
  /\bprogram(?:ming)?\b/i,
  /\bsoftware\b/i,
  /\bdeveloper\b/i,
  /\bdebug\b/i,
  /\bbug\b/i,
  /\bfix\b.*\b(error|issue|bug|test|build)\b/i,
  /\bimplement\b/i,
  /\bbuild\b.*\b(feature|app|component|page|ui|api|endpoint|route|service|calculator)\b/i,
  /\bcreate\b.*\b(component|page|ui|api|endpoint|route|service|schema|model|calculator)\b/i,
  /\brefactor\b/i,
  /\bunit tests?\b/i,
  /\bintegration tests?\b/i,
  /\bfrontend\b/i,
  /\bbackend\b/i,
  /\bfull[-\s]?stack\b/i,
  /\breact\b/i,
  /\bjavascript\b/i,
  /\btypescript\b/i,
  /\bnode(?:\.js)?\b/i,
  /\bexpress\b/i,
  /\bmongodb\b/i,
  /\bmongoose\b/i,
  /\bcss\b/i,
  /\bhtml\b/i,
  /\bjsx\b/i,
  /\btsx\b/i,
  /\bcalculator\b/i,
];
const SENSITIVE_PATTERNS = [
  /\bpassword\b/i,
  /\botp\b/i,
  /\bjwt\b/i,
  /\btoken\b/i,
  /\bapi key\b/i,
  /\bprivate messages?\b/i,
  /\bbank details?\b/i,
  /\bpayout details?\b/i,
  /\btransfer money\b/i,
  /\bwithdraw\b/i,
];

const normalize = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const hasPattern = (message = "", patterns = []) =>
  patterns.some((pattern) => pattern.test(message));

const normalizeMode = (value = "") => {
  const input = normalize(value);
  if (
    [
      AKUSO_MODES.APP_HELP,
      "apphelp",
      "copilot",
      "assistant",
      "app",
    ].includes(input)
  ) {
    return AKUSO_MODES.APP_HELP;
  }
  if (
    [
      AKUSO_MODES.CREATOR_WRITING,
      "writing",
      "creator_writing",
      "creator-writing",
      "write",
    ].includes(input)
  ) {
    return AKUSO_MODES.CREATOR_WRITING;
  }
  if (
    [
      AKUSO_MODES.KNOWLEDGE_LEARNING,
      "knowledge",
      "learning",
      "knowledge_learning",
      "knowledge-learning",
      "general",
    ].includes(input)
  ) {
    return AKUSO_MODES.KNOWLEDGE_LEARNING;
  }
  return AKUSO_MODES.AUTO;
};

const detectPromptInjectionAttempt = (message = "") => {
  const text = String(message || "");
  const reasons = PROMPT_INJECTION_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) =>
    pattern.toString()
  );
  return {
    matched: reasons.length > 0,
    reasons,
  };
};

const extractTopic = (message = "") =>
  sanitizePlainText(
    String(message || "")
      .replace(
        /^(please\s+)?(help me|open|show me|take me to|draft|write|rewrite|explain|teach me|solve|calculate)\b[:\s-]*/i,
        ""
      ),
    160
  );

const classifyAkusoRequest = ({
  message = "",
  mode = "",
  currentRoute = "",
  currentPage = "",
  promptInjectionGuard = null,
} = {}) => {
  const normalizedMessage = normalize(message);
  const normalizedMode = normalizeMode(mode);
  const route = sanitizeRoute(currentRoute);
  const feature =
    findFeatureByIntent(normalizedMessage) ||
    findFeatureByRoute(route) ||
    findFeatureByIntent(currentPage);

  const promptInjection = promptInjectionGuard?.matched
    ? promptInjectionGuard
    : detectPromptInjectionAttempt(normalizedMessage);
  const disallowed = hasPattern(normalizedMessage, DISALLOWED_PATTERNS);
  const emergency = hasPattern(normalizedMessage, EMERGENCY_PATTERNS);
  const medical = emergency || hasPattern(normalizedMessage, MEDICAL_PATTERNS);
  const legal = hasPattern(normalizedMessage, LEGAL_PATTERNS);
  const financial = hasPattern(normalizedMessage, FINANCIAL_PATTERNS);
  const creatorWritingRequested =
    normalizedMode === AKUSO_MODES.CREATOR_WRITING ||
    hasPattern(normalizedMessage, WRITING_PATTERNS);
  const softwareEngineeringRequested = hasPattern(
    normalizedMessage,
    SOFTWARE_ENGINEERING_PATTERNS
  );
  const appHelpRequested =
    !softwareEngineeringRequested &&
    (
      normalizedMode === AKUSO_MODES.APP_HELP ||
      Boolean(feature) ||
      hasPattern(normalizedMessage, APP_HELP_PATTERNS)
    );
  const needsReasoning =
    softwareEngineeringRequested || hasPattern(normalizedMessage, REASONING_PATTERNS);
  const sensitive = hasPattern(normalizedMessage, SENSITIVE_PATTERNS);

  let inferredMode = AKUSO_MODES.KNOWLEDGE_LEARNING;
  if (creatorWritingRequested) {
    inferredMode = AKUSO_MODES.CREATOR_WRITING;
  } else if (appHelpRequested) {
    inferredMode = AKUSO_MODES.APP_HELP;
  }

  return {
    normalizedMessage,
    requestedMode: normalizedMode,
    mode: normalizedMode === AKUSO_MODES.AUTO ? inferredMode : normalizedMode,
    topic: extractTopic(message) || sanitizePlainText(message, 160),
    currentRoute: route,
    currentPage: sanitizePlainText(currentPage, 120),
    feature,
    routeHint: feature?.routePattern || route,
    promptInjection,
    disallowed,
    emergency,
    medical,
    legal,
    financial,
    sensitive,
    needsReasoning,
    softwareEngineeringRequested,
    creatorWritingRequested,
    appHelpRequested,
  };
};

module.exports = {
  AKUSO_MODES,
  classifyAkusoRequest,
  detectPromptInjectionAttempt,
  normalizeMode,
};
