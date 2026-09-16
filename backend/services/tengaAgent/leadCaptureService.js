const Lead = require("../../models/tengaAgent/Lead");

const cleanText = (value, max) =>
  String(value || "")
    .trim()
    .slice(0, max);

const normalizeEmail = (value) =>
  cleanText(value, 254).toLowerCase();

const isValidEmail = (value) => {
  if (!value) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

async function captureLead({
  organizationId,
  agentId,
  conversationId,
  sessionKey,
  name,
  email,
  phone,
  company,
  projectSummary,
  source = "web",
  consentToContact = false,
}) {
  if (!organizationId || !agentId || !conversationId || !sessionKey) {
    const error = new Error("Lead capture context is incomplete.");
    error.statusCode = 400;
    throw error;
  }

  const cleanedEmail = normalizeEmail(email);
  const cleanedPhone = cleanText(phone, 40);

  if (!cleanedEmail && !cleanedPhone) {
    const error = new Error(
      "Please provide an email address or phone number so the business can contact you."
    );
    error.statusCode = 400;
    throw error;
  }

  if (!isValidEmail(cleanedEmail)) {
    const error = new Error("Please provide a valid email address.");
    error.statusCode = 400;
    throw error;
  }

  if (consentToContact !== true) {
    const error = new Error(
      "Please confirm that the business may contact you about this enquiry."
    );
    error.statusCode = 400;
    throw error;
  }

  return Lead.findOneAndUpdate(
    {
      organizationId,
      agentId,
      conversationId,
    },
    {
      $set: {
        organizationId,
        agentId,
        conversationId,
        sessionKey: cleanText(sessionKey, 160),
        name: cleanText(name, 120),
        email: cleanedEmail,
        phone: cleanedPhone,
        company: cleanText(company, 160),
        projectSummary: cleanText(projectSummary, 2000),
        source,
        consentToContact: true,
        lastCapturedAt: new Date(),
      },
      $setOnInsert: {
        status: "new",
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );
}

module.exports = {
  captureLead,
  isValidEmail,
};
