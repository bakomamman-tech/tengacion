const normalizeText = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const EMERGENCY_HEALTH_PATTERNS = [
  /chest pain/i,
  /difficulty breathing/i,
  /trouble breathing/i,
  /\bstroke\b/i,
  /seizure/i,
  /severe bleeding/i,
  /uncontrolled bleeding/i,
  /poison/i,
  /overdose/i,
  /anaphylaxis/i,
  /severe allergic reaction/i,
  /pregnancy emergency/i,
  /suicidal/i,
  /want to die/i,
  /kill myself/i,
];

const isHealthEmergency = (message = "") => EMERGENCY_HEALTH_PATTERNS.some((pattern) => pattern.test(String(message || "")));

const buildGeneralHealthGuidance = ({ topic = "", query = "" } = {}) => {
  const subject = normalizeText(topic || query) || "your concern";
  return {
    mode: "health",
    safety: {
      level: "caution",
      notice: "I can share general wellness information, but I am not a doctor and cannot diagnose you.",
      escalation: "",
    },
    message: `Here is general wellness information about ${subject}.`,
    details: [
      {
        title: "General guidance",
        body:
          "Rest, hydration, and monitoring your symptoms can be useful for mild issues, but they are not a substitute for medical advice.",
      },
      {
        title: "When to get help",
        body:
          "If symptoms are severe, persistent, unusual, or getting worse, contact your GP or a licensed clinician.",
      },
    ],
    followUps: [
      { label: "Explain simply", prompt: `Explain ${subject} in simple language` },
      { label: "What to watch for", prompt: `What warning signs should I watch for with ${subject}?` },
    ],
  };
};

const buildEmergencyHealthResponse = (message = "") => ({
  mode: "emergency",
  safety: {
    level: "emergency",
    notice:
      "This could be serious. Please contact your GP, a licensed clinician, or emergency services immediately.",
    escalation: "medical-emergency",
  },
  message: "Please get urgent medical help now.",
  details: [
    {
      title: "Immediate action",
      body:
        "If the person is not safe, call emergency services now and do not wait for a chat response.",
    },
  ],
  followUps: [],
  emergencyMessage: normalizeText(message, 240),
});

const buildHealthResponse = ({ topic = "", message = "" } = {}) => {
  const normalizedMessage = String(message || "").trim();
  if (isHealthEmergency(normalizedMessage)) {
    return buildEmergencyHealthResponse(normalizedMessage);
  }

  const subject = normalizeText(topic || message, 120) || "your concern";
  return {
    mode: "health",
    safety: {
      level: "caution",
      notice:
        "I can share general wellness information, but I am not a doctor and cannot diagnose or prescribe.",
      escalation: "",
    },
    message: `Here is cautious general health information about ${subject}.`,
    details: [
      {
        title: "What I can do",
        body:
          "I can explain common health concepts in plain language and help you think about non-urgent next steps.",
      },
      {
        title: "What I cannot do",
        body:
          "I cannot diagnose, prescribe medication, replace a clinician, or help with dangerous treatment decisions.",
      },
      {
        title: "When to get medical help",
        body:
          "If symptoms are serious, urgent, unusual, worsening, or involve pregnancy, children, drugs, chest pain, breathing trouble, seizures, bleeding, poisoning, or self-harm, contact your GP, a licensed doctor, or emergency services immediately.",
      },
    ],
    followUps: [
      { label: "Explain simply", prompt: `Explain ${subject} in simple language` },
      { label: "What warning signs matter?", prompt: `What warning signs should I watch for with ${subject}?` },
    ],
  };
};

module.exports = {
  buildEmergencyHealthResponse,
  buildGeneralHealthGuidance,
  buildHealthResponse,
  isHealthEmergency,
};
