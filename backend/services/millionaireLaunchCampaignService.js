const crypto = require("crypto");

const { config } = require("../config/env");
const AdminEmailCampaign = require("../models/AdminEmailCampaign");
const AdminEmailDelivery = require("../models/AdminEmailDelivery");
const User = require("../models/User");
const { createNotification } = require("./notificationService");
const { getEmailSettings } = require("../utils/emailSettings");
const { sendBrandedEmail } = require("../utils/sendBrandedEmail");

const CAMPAIGN_KEY = "millionaire-launch-2026-07-26";
const CAMPAIGN_TITLE = "Tengacion Millionaire launch";
const CAMPAIGN_SUBJECT =
  "Tengacion Millionaire starts today — Sunday, 26 July at 10:00 AM WAT";
const REMINDER_CAMPAIGN_KEY = "millionaire-reminder-2026-07-26";
const REMINDER_CAMPAIGN_TITLE = "Tengacion Millionaire reminder";
const REMINDER_CAMPAIGN_SUBJECT =
  "Reminder: Tengacion Millionaire begins today at 10:00 AM WAT";
const LAUNCH_AT = new Date("2026-07-26T09:00:00.000Z");
const MAX_DELIVERY_ATTEMPTS = 3;
const DELIVERY_CONCURRENCY = 4;
const DELIVERY_BATCH_SIZE = 40;

const toText = (value) => String(value || "").trim();
const escapeHtml = (value) =>
  toText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getAppUrl = () =>
  toText(config.APP_URL || config.appUrl || "https://tengacion.com").replace(/\/+$/, "");

const getCampaignUrls = () => {
  const appUrl = getAppUrl();
  return {
    appUrl,
    flyerUrl: `${appUrl}/assets/campaigns/tengacion-millionaire-2026.png?v=20260726-daily-prizes`,
    registrationUrl: `${appUrl}/millionaire/register`,
  };
};

const ACTIVE_AUDIENCE_FILTER = {
  email: { $type: "string", $regex: /^\S+@\S+\.\S+$/ },
  isActive: { $ne: false },
  isDeleted: { $ne: true },
  isBanned: { $ne: true },
  isSuspended: { $ne: true },
  "notificationPrefs.system": { $ne: false },
};

const buildMillionaireLaunchEmail = ({ name = "", flyerUrl, registrationUrl } = {}) => {
  const greetingName = escapeHtml(toText(name).split(/\s+/)[0] || "there");
  const safeFlyerUrl = escapeHtml(flyerUrl);
  const safeRegistrationUrl = escapeHtml(registrationUrl);

  return {
    previewText:
      "Tengacion Millionaire starts today at 10:00 AM WAT. Review the rules and transparent daily prize tiers.",
    html: `
      <h1 style="margin:10px 0 8px;font-size:26px;line-height:1.25;color:#241044;">
        Tengacion Millionaire starts today
      </h1>
      <p style="margin:0 0 16px;">Hello ${greetingName},</p>
      <p style="margin:0 0 18px;">
        Tengacion Millionaire commences on <strong>Sunday, 26 July 2026 at
        10:00 AM WAT</strong>. Participation is free.
      </p>
      <a href="${safeRegistrationUrl}" style="display:block;text-decoration:none;">
        <img
          src="${safeFlyerUrl}"
          width="592"
          alt="Tengacion Millionaire launch flyer for Sunday, 26 July 2026"
          style="display:block;width:100%;max-width:592px;height:auto;border:0;border-radius:16px;"
        />
      </a>
      <h2 style="margin:22px 0 8px;font-size:19px;color:#241044;">Guiding rules</h2>
      <ul style="margin:0 0 18px;padding-left:22px;">
        <li>Answer 15 multiple-choice questions across three stages of five questions each.</li>
        <li>Every question has a fresh 20-second reading and answer limit.</li>
        <li>One wrong answer or an expired timer ends the attempt and banks the cash already earned.</li>
        <li>Each player receives one Ask AI hint per game.</li>
        <li>Each Tengacion account may play once every six months.</li>
        <li>Basic account information, a profile picture and a cover photo are required before play.</li>
        <li>Admin accounts and payout-disabled QA attempts do not participate in prize selection.</li>
      </ul>
      <h2 style="margin:22px 0 8px;font-size:19px;color:#241044;">Cash prizes</h2>
      <p style="margin:0 0 18px;">
        Standard prizes unlock from <strong>₦100</strong> and rise to <strong>₦400</strong>.
        One eligible registered account is selected randomly each day for the premium
        ladder, which can reach <strong>₦1,000</strong>. All awards are subject to account
        and payout verification.
      </p>
      <p style="margin:22px 0;">
        <a
          href="${safeRegistrationUrl}"
          style="display:inline-block;padding:13px 22px;border-radius:999px;background:#f4c542;color:#241044;text-decoration:none;font-weight:800;"
        >
          Register or enter the game
        </a>
      </p>
      <p style="margin:18px 0 0;">
        Existing members should use their current Tengacion account. If your basic account
        information and both photos are present, you will not be asked to enter more profile details.
      </p>
      <p style="margin:18px 0 0;">— Tengacion Admin</p>
    `,
    text: [
      `Hello ${toText(name).split(/\s+/)[0] || "there"},`,
      "",
      "Tengacion Millionaire starts today, Sunday, 26 July 2026 at 10:00 AM WAT. Participation is free.",
      "",
      "RULES",
      "- 15 multiple-choice questions in three stages of five.",
      "- Every question receives a fresh 20-second reading and answer limit.",
      "- One wrong answer or an expired timer ends the attempt and banks cash already earned.",
      "- One Ask AI hint per game.",
      "- One play per Tengacion account every six months.",
      "- Basic account information, a profile picture and a cover photo are required.",
      "- Admin accounts and payout-disabled QA attempts are excluded from prize selection.",
      "",
      "PRIZES",
      "Standard prizes rise from ₦100 to ₦400. One eligible account is selected randomly each day for a premium ladder worth up to ₦1,000. Awards are subject to verification.",
      "",
      `Register or play: ${registrationUrl}`,
      `Flyer: ${flyerUrl}`,
      "",
      "— Tengacion Admin",
    ].join("\n"),
  };
};

const buildMillionaireReminderEmail = ({
  name = "",
  flyerUrl,
  registrationUrl,
} = {}) => {
  const greetingName = escapeHtml(toText(name).split(/\s+/)[0] || "there");
  const safeFlyerUrl = escapeHtml(flyerUrl);
  const safeRegistrationUrl = escapeHtml(registrationUrl);

  return {
    previewText:
      "Reminder: Tengacion Millionaire begins at 10:00 AM WAT. Check the rules and confirm that your account is eligible.",
    html: `
      <h1 style="margin:10px 0 8px;font-size:26px;line-height:1.25;color:#241044;">
        Your Tengacion Millionaire reminder
      </h1>
      <p style="margin:0 0 16px;">Hello ${greetingName},</p>
      <p style="margin:0 0 18px;">
        Tengacion Millionaire begins <strong>today, Sunday, 26 July 2026 at
        10:00 AM WAT</strong>. Participation is free. Please review the rules and
        eligibility checklist before opening the game.
      </p>
      <a href="${safeRegistrationUrl}" style="display:block;text-decoration:none;">
        <img
          src="${safeFlyerUrl}"
          width="592"
          alt="Tengacion Millionaire reminder flyer"
          style="display:block;width:100%;max-width:592px;height:auto;border:0;border-radius:16px;"
        />
      </a>
      <h2 style="margin:22px 0 8px;font-size:19px;color:#241044;">Eligibility checklist</h2>
      <ul style="margin:0 0 18px;padding-left:22px;">
        <li>Use one active Tengacion account and register it for Tengacion Millionaire.</li>
        <li>Your name, username and valid email address must be present.</li>
        <li>Upload both a profile picture and a cover photo.</li>
        <li>Phone number, country, date of birth, gender and other optional profile fields are not required to unlock the game.</li>
        <li>Admin, moderator and trust-and-safety accounts cannot participate.</li>
      </ul>
      <h2 style="margin:22px 0 8px;font-size:19px;color:#241044;">Game rules</h2>
      <ul style="margin:0 0 18px;padding-left:22px;">
        <li>There are 15 difficult multiple-choice questions across three stages.</li>
        <li>Each question starts its own fresh 20-second reading and answer countdown.</li>
        <li>A wrong answer or expired timer ends the attempt and banks cash already earned.</li>
        <li>Each player has one Ask AI hint per game.</li>
        <li>Ordinary eligible accounts may play once every six months.</li>
      </ul>
      <h2 style="margin:22px 0 8px;font-size:19px;color:#241044;">Prize rules</h2>
      <p style="margin:0 0 18px;">
        Standard prizes range from <strong>₦100 to ₦400</strong>. One eligible
        registered account is selected randomly each day for a premium ladder worth
        up to <strong>₦1,000</strong>. QA attempts are payout-disabled and all cash
        awards are verified before payment.
      </p>
      <p style="margin:22px 0;">
        <a
          href="${safeRegistrationUrl}"
          style="display:inline-block;padding:13px 22px;border-radius:999px;background:#f4c542;color:#241044;text-decoration:none;font-weight:800;"
        >
          Check eligibility and enter
        </a>
      </p>
      <p style="margin:18px 0 0;">
        Existing users who already have the basic information and both photos will
        not see a profile “Fix” requirement.
      </p>
      <p style="margin:18px 0 0;">— Tengacion Admin</p>
    `,
    text: [
      `Hello ${toText(name).split(/\s+/)[0] || "there"},`,
      "",
      "REMINDER: Tengacion Millionaire begins today, Sunday, 26 July 2026 at 10:00 AM WAT. Participation is free.",
      "",
      "ELIGIBILITY",
      "- Register one active Tengacion account for the game.",
      "- Your name, username and valid email address must be present.",
      "- Upload both a profile picture and a cover photo.",
      "- Phone, country, date of birth, gender and other optional fields are not required.",
      "- Admin, moderator and trust-and-safety accounts cannot participate.",
      "",
      "GAME RULES",
      "- 15 difficult multiple-choice questions across three stages.",
      "- Every question starts a fresh 20-second reading and answer countdown.",
      "- A wrong answer or expired timer ends the attempt and banks cash already earned.",
      "- One Ask AI hint per game.",
      "- One play per ordinary eligible account every six months.",
      "",
      "PRIZES",
      "- Standard prizes: ₦100 to ₦400.",
      "- One randomly selected eligible account per day may reach ₦1,000.",
      "- QA attempts do not qualify for payout; all awards are verified.",
      "",
      `Check eligibility and enter: ${registrationUrl}`,
      `Flyer: ${flyerUrl}`,
      "",
      "— Tengacion Admin",
    ].join("\n"),
  };
};

const CAMPAIGN_DEFINITIONS = Object.freeze({
  launch: {
    key: CAMPAIGN_KEY,
    title: CAMPAIGN_TITLE,
    subject: CAMPAIGN_SUBJECT,
    buildEmail: buildMillionaireLaunchEmail,
    notificationText:
      "Tengacion Millionaire starts today at 10:00 AM WAT. Standard prizes reach ₦400 and one randomly selected eligible account can reach ₦1,000.",
    notificationPreview:
      "Review the 20-second rules, daily prize tiers and launch flyer.",
  },
  reminder: {
    key: REMINDER_CAMPAIGN_KEY,
    title: REMINDER_CAMPAIGN_TITLE,
    subject: REMINDER_CAMPAIGN_SUBJECT,
    buildEmail: buildMillionaireReminderEmail,
    notificationText:
      "Reminder: Tengacion Millionaire begins today at 10:00 AM WAT. Check your eligibility and review the game rules.",
    notificationPreview:
      "Basic account information plus profile and cover photos are required. View the flyer and full rules.",
  },
});

const serializeCampaign = (
  campaign,
  definition,
  { configured = getEmailSettings().configured } = {}
) => {
  const value = campaign?.toObject ? campaign.toObject() : campaign || {};
  const { flyerUrl, registrationUrl } = getCampaignUrls();
  return {
    campaignKey: definition.key,
    title: value.title || definition.title,
    subject: value.subject || definition.subject,
    status: value.status || "not_started",
    launchAt: value.launchAt || LAUNCH_AT,
    flyerUrl: value.flyerUrl || flyerUrl,
    registrationUrl,
    audienceCount: Number(value.audienceCount || 0),
    sentCount: Number(value.sentCount || 0),
    failedCount: Number(value.failedCount || 0),
    pendingCount: Number(value.pendingCount || 0),
    runCount: Number(value.runCount || 0),
    startedAt: value.startedAt || null,
    completedAt: value.completedAt || null,
    lastHeartbeatAt: value.lastHeartbeatAt || null,
    lastError: value.lastError || "",
    emailConfigured: Boolean(configured),
  };
};

const getCampaignStatus = async (definition) => {
  const [campaign, audienceCount] = await Promise.all([
    AdminEmailCampaign.findOne({ campaignKey: definition.key }).lean(),
    User.countDocuments(ACTIVE_AUDIENCE_FILTER),
  ]);
  const serialized = serializeCampaign(campaign, definition);
  if (!campaign) {
    serialized.audienceCount = audienceCount;
    serialized.pendingCount = audienceCount;
  }
  return serialized;
};

const upsertAudienceDeliveries = async (definition) => {
  const cursor = User.find(ACTIVE_AUDIENCE_FILTER)
    .select("_id name username email")
    .lean()
    .cursor();
  let operations = [];

  const flush = async () => {
    if (!operations.length) return;
    await AdminEmailDelivery.bulkWrite(operations, { ordered: false });
    operations = [];
  };

  for await (const user of cursor) {
    operations.push({
      updateOne: {
        filter: { campaignKey: definition.key, userId: user._id },
        update: {
          $setOnInsert: {
            campaignKey: definition.key,
            userId: user._id,
            email: toText(user.email).toLowerCase(),
            name: toText(user.name),
            username: toText(user.username),
            status: "pending",
          },
        },
        upsert: true,
      },
    });
    if (operations.length >= 500) {
      await flush();
    }
  }
  await flush();
};

const runWithConcurrency = async (items, limit, worker) => {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
};

const refreshCampaignCounts = async (
  definition,
  { status, lastError = "" } = {}
) => {
  const [sentCount, failedCount, pendingCount] = await Promise.all([
    AdminEmailDelivery.countDocuments({
      campaignKey: definition.key,
      status: "sent",
    }),
    AdminEmailDelivery.countDocuments({
      campaignKey: definition.key,
      status: "failed",
    }),
    AdminEmailDelivery.countDocuments({
      campaignKey: definition.key,
      status: { $in: ["pending", "sending"] },
    }),
  ]);
  const update = {
    audienceCount: sentCount + failedCount + pendingCount,
    sentCount,
    failedCount,
    pendingCount,
    lastHeartbeatAt: new Date(),
    lastError: toText(lastError).slice(0, 500),
  };
  if (status) {
    update.status = status;
  }
  return AdminEmailCampaign.findOneAndUpdate(
    { campaignKey: definition.key },
    { $set: update },
    { returnDocument: "after" }
  );
};

const sendDelivery = async ({
  definition,
  delivery,
  runId,
  adminUserId,
  io,
  onlineUsers,
}) => {
  const claimed = await AdminEmailDelivery.findOneAndUpdate(
    {
      _id: delivery._id,
      status: { $in: ["pending", "failed"] },
      attempts: { $lt: MAX_DELIVERY_ATTEMPTS },
      lastRunId: { $ne: runId },
    },
    {
      $set: { status: "sending", lastRunId: runId, lastError: "" },
      $inc: { attempts: 1 },
    },
    { returnDocument: "after" }
  );
  if (!claimed) return;

  const { flyerUrl, registrationUrl } = getCampaignUrls();
  const email = definition.buildEmail({
    name: claimed.name,
    flyerUrl,
    registrationUrl,
  });

  try {
    await sendBrandedEmail({
      to: claimed.email,
      subject: definition.subject,
      previewText: email.previewText,
      html: email.html,
      text: email.text,
    });
    await AdminEmailDelivery.updateOne(
      { _id: claimed._id },
      {
        $set: {
          status: "sent",
          sentAt: new Date(),
          lastError: "",
        },
      }
    );
    await createNotification({
      recipient: claimed.userId,
      sender: adminUserId,
      type: "system",
      text: definition.notificationText,
      metadata: {
        dedupeKey: definition.key,
        link: "/millionaire/register",
        flyerUrl,
        previewImage: flyerUrl,
        previewText: definition.notificationPreview,
      },
      io,
      onlineUsers,
    });
  } catch (error) {
    await AdminEmailDelivery.updateOne(
      { _id: claimed._id },
      {
        $set: {
          status: "failed",
          lastError: toText(error?.message || "Email delivery failed").slice(0, 500),
        },
      }
    );
  }
};

const runCampaign = async (
  definition,
  { adminUserId, io, onlineUsers } = {}
) => {
  const runId = crypto.randomUUID();
  const campaign = await AdminEmailCampaign.findOneAndUpdate(
    {
      campaignKey: definition.key,
      status: { $in: ["queued", "partial", "failed"] },
    },
    {
      $set: {
        status: "sending",
        startedAt: new Date(),
        completedAt: null,
        lastHeartbeatAt: new Date(),
        lastError: "",
      },
      $inc: { runCount: 1 },
    },
    { returnDocument: "after" }
  );
  if (!campaign) {
    return getCampaignStatus(definition);
  }

  try {
    await upsertAudienceDeliveries(definition);
    await refreshCampaignCounts(definition, { status: "sending" });

    while (true) {
      const deliveries = await AdminEmailDelivery.find({
        campaignKey: definition.key,
        status: { $in: ["pending", "failed"] },
        attempts: { $lt: MAX_DELIVERY_ATTEMPTS },
        lastRunId: { $ne: runId },
      })
        .sort({ createdAt: 1 })
        .limit(DELIVERY_BATCH_SIZE)
        .lean();
      if (!deliveries.length) break;

      await runWithConcurrency(deliveries, DELIVERY_CONCURRENCY, (delivery) =>
        sendDelivery({
          definition,
          delivery,
          runId,
          adminUserId,
          io,
          onlineUsers,
        })
      );
      await refreshCampaignCounts(definition, { status: "sending" });
    }

    const latest = await refreshCampaignCounts(definition);
    const completed =
      Number(latest?.pendingCount || 0) === 0 &&
      Number(latest?.failedCount || 0) === 0;
    const finalStatus = completed ? "completed" : "partial";
    const finalCampaign = await AdminEmailCampaign.findOneAndUpdate(
      { campaignKey: definition.key },
      {
        $set: {
          status: finalStatus,
          completedAt: new Date(),
          lastHeartbeatAt: new Date(),
          lastError: completed
            ? ""
            : "Some recipients could not be reached. Retry the failed deliveries.",
        },
      },
      { returnDocument: "after" }
    );
    return serializeCampaign(finalCampaign, definition);
  } catch (error) {
    const failedCampaign = await refreshCampaignCounts(definition, {
      status: "failed",
      lastError: error?.message || "Campaign processing failed",
    });
    return serializeCampaign(failedCampaign, definition);
  }
};

const queueCampaign = async (
  definition,
  { adminUserId, io, onlineUsers } = {}
) => {
  const settings = getEmailSettings();
  if (!settings.configured) {
    const error = new Error("Email service is not configured.");
    error.status = 503;
    error.code = "email_not_configured";
    throw error;
  }

  const { flyerUrl } = getCampaignUrls();
  let campaign = await AdminEmailCampaign.findOne({ campaignKey: definition.key });
  if (campaign?.status === "completed" || campaign?.status === "sending") {
    return {
      alreadyRunningOrSent: true,
      campaign: serializeCampaign(campaign, definition, { configured: true }),
    };
  }

  if (!campaign) {
    try {
      campaign = await AdminEmailCampaign.create({
        campaignKey: definition.key,
        title: definition.title,
        subject: definition.subject,
        status: "queued",
        launchAt: LAUNCH_AT,
        flyerUrl,
        initiatedBy: adminUserId,
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      campaign = await AdminEmailCampaign.findOne({ campaignKey: definition.key });
    }
  } else {
    campaign.status = "queued";
    campaign.initiatedBy = adminUserId;
    campaign.lastError = "";
    await campaign.save();
  }

  setImmediate(() => {
    runCampaign(definition, { adminUserId, io, onlineUsers }).catch((error) => {
      console.error(`${definition.title} campaign failed:`, error);
    });
  });

  return {
    alreadyRunningOrSent: false,
    campaign: serializeCampaign(campaign, definition, { configured: true }),
  };
};

const getMillionaireLaunchCampaignStatus = () =>
  getCampaignStatus(CAMPAIGN_DEFINITIONS.launch);

const getMillionaireReminderCampaignStatus = () =>
  getCampaignStatus(CAMPAIGN_DEFINITIONS.reminder);

const runMillionaireLaunchCampaign = (options = {}) =>
  runCampaign(CAMPAIGN_DEFINITIONS.launch, options);

const runMillionaireReminderCampaign = (options = {}) =>
  runCampaign(CAMPAIGN_DEFINITIONS.reminder, options);

const queueMillionaireLaunchCampaign = (options = {}) =>
  queueCampaign(CAMPAIGN_DEFINITIONS.launch, options);

const queueMillionaireReminderCampaign = (options = {}) =>
  queueCampaign(CAMPAIGN_DEFINITIONS.reminder, options);

module.exports = {
  CAMPAIGN_KEY,
  CAMPAIGN_SUBJECT,
  LAUNCH_AT,
  REMINDER_CAMPAIGN_KEY,
  REMINDER_CAMPAIGN_SUBJECT,
  buildMillionaireLaunchEmail,
  buildMillionaireReminderEmail,
  getMillionaireLaunchCampaignStatus,
  getMillionaireReminderCampaignStatus,
  queueMillionaireLaunchCampaign,
  queueMillionaireReminderCampaign,
  runMillionaireLaunchCampaign,
  runMillionaireReminderCampaign,
};
