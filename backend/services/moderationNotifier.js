const { findPrimaryModerationAdmin } = require("./moderationAdminService");
const { createNotification } = require("./notificationService");

const notifyCriticalModerationCase = async ({ moderationCase }) => {
  const admin = await findPrimaryModerationAdmin();
  if (!admin?._id || !moderationCase?._id) {
    return null;
  }

  return createNotification({
    recipient: admin._id,
    sender: moderationCase?.uploader?.userId || admin._id,
    type: "system",
    text: "Critical moderation case requires review",
    entity: {
      id: moderationCase._id,
      model: "ModerationCase",
    },
    metadata: {
      previewText: moderationCase.publicWarningLabel || moderationCase.status,
      link: "/admin/reports",
      moderationCaseId: moderationCase._id.toString(),
      dedupeKey: `moderation_case:${moderationCase._id.toString()}`,
    },
  });
};

module.exports = {
  notifyCriticalModerationCase,
};
