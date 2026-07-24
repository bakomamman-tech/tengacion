const { sanitizePlainText, sanitizeRoute } = require("./assistant/outputSanitizer");
const { findFeatureByIntent, findFeatureByRoute } = require("./akusoFeatureRegistryService");

const AKUSO_MODES = {
  AUTO: "auto",
  APP_HELP: "app_help",
  CREATOR_WRITING: "creator_writing",
  KNOWLEDGE_LEARNING: "knowledge_learning",
  MATH: "math",
};

const AKUSO_SUBJECTS = {
  BIOLOGY: "biology",
  CHEMISTRY: "chemistry",
  COMPUTER_SCIENCE: "computer_science",
  CURRENT_AFFAIRS: "current_affairs",
  ECONOMICS: "economics",
  ENGINEERING: "engineering",
  ENGLISH: "english",
  GENERAL_KNOWLEDGE: "general_knowledge",
  GEOGRAPHY: "geography",
  HISTORY: "history",
  MATHEMATICS: "mathematics",
  PHYSICS: "physics",
  GENERAL: "general",
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

const LEGAL_PATTERNS = [
  /\blegal\b/i,
  /\b(?:criminal|civil|family|employment|immigration|property|tax|contract|constitutional|corporate)\s+law\b/i,
  /\b(?:the )?laws?\s+(?:says?|allows?|requires?|prohibits?)\b/i,
  /\b(?:against|under)\s+(?:the )?law\b/i,
  /\bcontract\b/i,
  /\bcourt\b/i,
  /\blawyer\b/i,
];
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
  /\b(?:algebra|geometry|trigonometry|calculus|arithmetic)\b/i,
  /\b(?:sin|cos|tan|cot|sec|csc|cosec)\s*(?:\(?\s*)?(?:theta|\u03b8|[a-z])\b/i,
  /\bfind\b.*\b(?:sin|cos|tan|cot|sec|csc|cosec)\b/i,
  /\u03b8/i,
  /\btheta\b/i,
  /[0-9].*[\+\-\*\/]/,
];
const MATH_PATTERNS = [
  /\bmath(?:ematics)?\b/i,
  /\b(?:algebra|geometry|trigonometry|calculus|arithmetic)\b/i,
  /\b(?:factorise|factorize|expand|simplify|differentiate|integrate|derive|prove)\b/i,
  /\b(?:quadratic|polynomial|simultaneous|linear equation|inequality|indices|surds?)\b/i,
  /\b(?:probability|statistics|median|variance|standard deviation)\b/i,
  /\bmean\s+(?:of|=)\b/i,
  /\b(?:matrix|matrices|determinant|logarithm|log|sequence|series|bearing|angle|triangle)\b/i,
  /\b(?:sin|cos|tan|cot|sec|csc|cosec)\s*(?:\(?\s*)?(?:theta|\u03b8|[a-z])\b/i,
  /\bfind\b.*\b(?:sin|cos|tan|cot|sec|csc|cosec)\b/i,
  /\u03b8/i,
  /\btheta\b/i,
  /[0-9].*[\+\-\*\/^=]/,
  /[\u2264\u2265]/,
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
const SUBJECT_PATTERNS = {
  [AKUSO_SUBJECTS.PHYSICS]: [
    /\bphysics\b/i,
    /\b(?:kinematics|dynamics|mechanics|thermodynamics|electromagnetism|optics)\b/i,
    /\b(?:velocity|accelerat(?:e|es|ed|ing|ion)|momentum|projectile|free[-\s]?body diagram)\b/i,
    /\b(?:newton'?s laws?|ohm'?s law|electric circuit|potential difference)\b/i,
  ],
  [AKUSO_SUBJECTS.ENGINEERING]: [
    /\bengineering\b/i,
    /\b(?:civil|mechanical|electrical|electronic|chemical|structural|petroleum|aerospace)\s+engineer(?:ing)?\b/i,
    /\b(?:stress|strain|shear force|bending moment|factor of safety|fluid mechanics)\b/i,
    /\b(?:beam|truss|circuit|load-bearing|control system)\b/i,
  ],
  [AKUSO_SUBJECTS.CHEMISTRY]: [
    /\bchemistry\b/i,
    /\b(?:stoichiometry|molarity|molality|electrolysis|redox|oxidation|reduction)\b/i,
    /\b(?:periodic table|chemical equation|chemical reaction|limiting reagent)\b/i,
    /\b(?:acid|base|alkali|isotope|electron configuration|organic chemistry|inorganic chemistry)\b/i,
    /\b(?:moles?|molar mass|empirical formula|molecular formula)\b/i,
  ],
  [AKUSO_SUBJECTS.BIOLOGY]: [
    /\bbiology\b/i,
    /\b(?:cell biology|genetics|ecology|evolution|photosynthesis|respiration|mitosis|meiosis)\b/i,
    /\b(?:anatomy|physiology|organism|ecosystem|chromosome|dna|rna)\b/i,
  ],
  [AKUSO_SUBJECTS.HISTORY]: [
    /\bhistory\b/i,
    /\bhistorical\b/i,
    /\b(?:ancient|medieval|colonial|pre-colonial|post-colonial)\b/i,
    /\b(?:empire|dynasty|revolution|independence movement|world war)\b/i,
  ],
  [AKUSO_SUBJECTS.GEOGRAPHY]: [
    /\bgeography\b/i,
    /\b(?:climate|weathering|erosion|plate tectonics|population distribution|urbanisation|urbanization)\b/i,
    /\b(?:latitude|longitude|topograph|landform|river basin)\b/i,
  ],
  [AKUSO_SUBJECTS.ENGLISH]: [
    /\benglish(?: language)?\b/i,
    /\b(?:grammar|vocabulary|punctuation|comprehension|parts? of speech)\b/i,
    /\b(?:noun|pronoun|adjective|adverb|preposition|conjunction|verb tense)\b/i,
    /\b(?:figure of speech|metaphor|simile|personification|alliteration)\b/i,
    /\b(?:essay|letter writing|summary writing|literature)\b/i,
  ],
  [AKUSO_SUBJECTS.ECONOMICS]: [
    /\beconomics?\b/i,
    /\b(?:demand and supply|opportunity cost|inflation|gross domestic product|gdp|market structure)\b/i,
    /\b(?:microeconomics|macroeconomics|fiscal policy|monetary policy)\b/i,
  ],
  [AKUSO_SUBJECTS.COMPUTER_SCIENCE]: [
    /\bcomputer science\b/i,
    /\b(?:algorithm|data structure|computational complexity|binary search|database normalization)\b/i,
    /\b(?:operating system|computer network|machine learning|artificial intelligence)\b/i,
  ],
  [AKUSO_SUBJECTS.GENERAL_KNOWLEDGE]: [
    /\bgeneral knowledge\b/i,
    /\btrivia\b/i,
    /\bquiz\b/i,
  ],
};
const CURRENT_INFORMATION_PATTERNS = [
  /\bcurrent[-\s]+affairs?\b/i,
  /\b(?:latest|breaking|today'?s|recent)\s+(?:news|headlines?|events?|developments?|updates?)\b/i,
  /\b(?:news|headlines?)\s+(?:today|this week|this month|this year)\b/i,
  /\bwhat (?:is happening|happened)\s+(?:today|this week|this month|recently)\b/i,
  /\bwho is (?:the )?(?:current|present)\b/i,
  /\bwho (?:is|are) (?:the )?(?:president|prime minister|governor|minister|ceo) (?:of|for)\b/i,
  /\bas of (?:today|now|this week|this month|this year)\b/i,
  /\b(?:current|latest)\s+(?:president|prime minister|governor|minister|ceo|price|rate|law|rule|schedule|score|result)\b/i,
  /\b(?:what|how much) (?:is|are) (?:the )?(?:price|exchange rate|interest rate|inflation rate|unemployment rate|score|schedule)\b/i,
];
const SENSITIVE_PATTERNS = [
  /\bpassword\b/i,
  /\botp\b/i,
  /\bjwt\b/i,
  /\b(?:access|auth|authentication|bearer|session|secret|refresh)\s+tokens?\b/i,
  /\btokens?\s+(?:for|from)\s+(?:an?\s+)?(?:account|login|api|session)\b/i,
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

const detectAcademicSubject = ({ message = "", mathRequested = false } = {}) => {
  for (const [subject, patterns] of Object.entries(SUBJECT_PATTERNS)) {
    if (hasPattern(message, patterns)) {
      return subject;
    }
  }

  return mathRequested ? AKUSO_SUBJECTS.MATHEMATICS : AKUSO_SUBJECTS.GENERAL;
};

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
      AKUSO_MODES.MATH,
      "mathematics",
      "calculation",
      "calculations",
      "trig",
      "trigonometry",
    ].includes(input)
  ) {
    return AKUSO_MODES.MATH;
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
  const namedAcademicSubject = detectAcademicSubject({
    message: normalizedMessage,
    mathRequested: false,
  });
  const mathRequested =
    normalizedMode === AKUSO_MODES.MATH ||
    (namedAcademicSubject === AKUSO_SUBJECTS.GENERAL &&
      hasPattern(normalizedMessage, MATH_PATTERNS));
  const requiresCurrentInformation = hasPattern(
    normalizedMessage,
    CURRENT_INFORMATION_PATTERNS
  );
  const detectedSubject = requiresCurrentInformation
    ? AKUSO_SUBJECTS.CURRENT_AFFAIRS
    : namedAcademicSubject !== AKUSO_SUBJECTS.GENERAL
      ? namedAcademicSubject
      : mathRequested
        ? AKUSO_SUBJECTS.MATHEMATICS
        : AKUSO_SUBJECTS.GENERAL;
  const academicReasoningRequested = ![
    AKUSO_SUBJECTS.CURRENT_AFFAIRS,
    AKUSO_SUBJECTS.GENERAL,
  ].includes(detectedSubject);
  const needsReasoning =
    mathRequested ||
    softwareEngineeringRequested ||
    academicReasoningRequested ||
    requiresCurrentInformation ||
    hasPattern(normalizedMessage, REASONING_PATTERNS);
  const appHelpRequested =
    !softwareEngineeringRequested &&
    !needsReasoning &&
    (
      normalizedMode === AKUSO_MODES.APP_HELP ||
      Boolean(feature) ||
      hasPattern(normalizedMessage, APP_HELP_PATTERNS)
    );
  const sensitive = hasPattern(normalizedMessage, SENSITIVE_PATTERNS);

  let inferredMode = AKUSO_MODES.KNOWLEDGE_LEARNING;
  if (creatorWritingRequested) {
    inferredMode = AKUSO_MODES.CREATOR_WRITING;
  } else if (appHelpRequested) {
    inferredMode = AKUSO_MODES.APP_HELP;
  } else if (mathRequested) {
    inferredMode = AKUSO_MODES.MATH;
  }
  const resolvedMode =
    mathRequested && !creatorWritingRequested && !softwareEngineeringRequested
      ? AKUSO_MODES.MATH
      : (academicReasoningRequested || requiresCurrentInformation) &&
          !creatorWritingRequested &&
          !softwareEngineeringRequested &&
          normalizedMode === AKUSO_MODES.APP_HELP
        ? AKUSO_MODES.KNOWLEDGE_LEARNING
      : normalizedMode === AKUSO_MODES.AUTO
        ? inferredMode
        : normalizedMode;

  return {
    normalizedMessage,
    requestedMode: normalizedMode,
    mode: resolvedMode,
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
    subject: detectedSubject,
    needsReasoning,
    academicReasoningRequested,
    requiresCurrentInformation,
    mathRequested,
    softwareEngineeringRequested,
    creatorWritingRequested,
    appHelpRequested,
  };
};

module.exports = {
  AKUSO_MODES,
  AKUSO_SUBJECTS,
  classifyAkusoRequest,
  detectAcademicSubject,
  detectPromptInjectionAttempt,
  normalizeMode,
};
