const Lead = require("../../models/tengaAgent/Lead");

const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_PHONE_LENGTH = 40;
const MAX_COMPANY_LENGTH = 160;
const MAX_SUMMARY_LENGTH = 2000;

const cleanText = (value, max) =>
  String(value || "")
    .trim()
    .slice(0, max);

const normalizeEmail = (value) =>
  cleanText(value, MAX_EMAIL_LENGTH).toLowerCase();

const isValidEmail = (value) => {
  if (!value) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const normalizePhone = (value) =>
  cleanText(value, MAX_PHONE_LENGTH);

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

  const cleanedName = cleanText(name, MAX_NAME_LENGTH);
  const cleanedEmail = normalizeEmail(email);
  const cleanedPhone = normalizePhone(phone);
  const cleanedCompany = cleanText(company, MAX_COMPANY_LENGTH);
  const cleanedSummary = cleanText(projectSummary, MAX_SUMMARY_LENGTH);

  if (!cleanedEmail && !cleanedPhone) {
    const error = new Error(
      "Please provide an email address or phone number so the team can contact you."
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
      "Please confirm that Tengacion may contact you about this enquiry."
    );
    error.statusCode = 400;
    throw error;
  }

  const update = {
    organizationId,
    agentId,
    conversationId,
    sessionKey: cleanText(sessionKey, 160),
    name: cleanedName,
    email: cleanedEmail,
    phone: cleanedPhone,
    company: cleanedCompany,
    projectSummary: cleanedSummary,
    source,
    consentToContact: true,
    lastCapturedAt: new Date(),
  };

  const lead = await Lead.findOneAndUpdate(
    {
      organizationId,
      agentId,
      conversationId,
    },
    {
      $set: update,
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

  return lead;
}

module.exports = {
  captureLead,
  isValidEmail,
};
