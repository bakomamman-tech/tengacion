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
  "Tengacion Millionaire starts tomorrow — Sunday, 26 July at 10:00 AM WAT";
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
    flyerUrl: `${appUrl}/assets/campaigns/tengacion-millionaire-2026.png?v=20260725-prizes`,
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
      "Tengacion Millionaire starts Sunday, 26 July 2026 at 10:00 AM WAT. Participation is free.",
    html: `
      <h1 style="margin:10px 0 8px;font-size:26px;line-height:1.25;color:#241044;">
        Tengacion Millionaire starts tomorrow
      </h1>
      <p style="margin:0 0 16px;">Hello ${greetingName},</p>
      <p style="margin:0 0 18px;">
        Tengacion Millionaire commences on <strong>Sunday, 26 July 2026 at
        10:00 AM WAT</strong>. The virtual lobby opens at 9:00 AM WAT and participation is free.
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
        <li>Question time limits are 45 seconds in Stage 1, 35 seconds in Stage 2 and 30 seconds in Stage 3.</li>
        <li>One wrong answer or an expired timer ends the attempt and banks the cash already earned.</li>
        <li>Each player receives one Ask AI hint per game.</li>
        <li>Each Tengacion account may play once every six months.</li>
        <li>A complete standard profile, profile picture and cover photo are required before play.</li>
      </ul>
      <h2 style="margin:22px 0 8px;font-size:19px;color:#241044;">Cash prizes</h2>
      <p style="margin:0 0 18px;">
        Correct answers unlock cash from <strong>₦100</strong>, rising through the prize ladder
        to a maximum of <strong>₦5,000</strong> for all 15 correct answers. Every award is
        subject to account and payout verification.
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
        Existing members should use their current Tengacion account. If your standard profile
        and both photos are complete, you will not be asked to enter that information again.
      </p>
      <p style="margin:18px 0 0;">— Tengacion Admin</p>
    `,
    text: [
      `Hello ${toText(name).split(/\s+/)[0] || "there"},`,
      "",
      "Tengacion Millionaire starts Sunday, 26 July 2026 at 10:00 AM WAT. The virtual lobby opens at 9:00 AM WAT and participation is free.",
      "",
      "RULES",
      "- 15 multiple-choice questions in three stages of five.",
      "- Time limits: 45 seconds, 35 seconds and 30 seconds by stage.",
      "- One wrong answer or an expired timer ends the attempt and banks cash already earned.",
      "- One Ask AI hint per game.",
      "- One play per Tengacion account every six months.",
      "- A complete standard profile, profile picture and cover photo are required.",
      "",
      "PRIZES",
      "Cash prizes rise from ₦100 to ₦5,000 for all 15 correct answers, subject to verification.",
      "",
      `Register or play: ${registrationUrl}`,
      `Flyer: ${flyerUrl}`,
      "",
      "— Tengacion Admin",
    ].join("\n"),
  };
};

const serializeCampaign = (campaign, { configured = getEmailSettings().configured } = {}) => {
  const value = campaign?.toObject ? campaign.toObject() : campaign || {};
  const { flyerUrl, registrationUrl } = getCampaignUrls();
  return {
    campaignKey: CAMPAIGN_KEY,
    title: value.title || CAMPAIGN_TITLE,
    subject: value.subject || CAMPAIGN_SUBJECT,
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

const getMillionaireLaunchCampaignStatus = async () => {
  const [campaign, audienceCount] = await Promise.all([
    AdminEmailCampaign.findOne({ campaignKey: CAMPAIGN_KEY }).lean(),
    User.countDocuments(ACTIVE_AUDIENCE_FILTER),
  ]);
  const serialized = serializeCampaign(campaign);
  if (!campaign) {
    serialized.audienceCount = audienceCount;
    serialized.pendingCount = audienceCount;
  }
  return serialized;
};

const upsertAudienceDeliveries = async () => {
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
        filter: { campaignKey: CAMPAIGN_KEY, userId: user._id },
        update: {
          $setOnInsert: {
            campaignKey: CAMPAIGN_KEY,
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

const refreshCampaignCounts = async ({ status, lastError = "" } = {}) => {
  const [sentCount, failedCount, pendingCount] = await Promise.all([
    AdminEmailDelivery.countDocuments({ campaignKey: CAMPAIGN_KEY, status: "sent" }),
    AdminEmailDelivery.countDocuments({ campaignKey: CAMPAIGN_KEY, status: "failed" }),
    AdminEmailDelivery.countDocuments({
      campaignKey: CAMPAIGN_KEY,
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
    { campaignKey: CAMPAIGN_KEY },
    { $set: update },
    { returnDocument: "after" }
  );
};

const sendDelivery = async ({ delivery, runId, adminUserId, io, onlineUsers }) => {
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
  const email = buildMillionaireLaunchEmail({
    name: claimed.name,
    flyerUrl,
    registrationUrl,
  });

  try {
    await sendBrandedEmail({
      to: claimed.email,
      subject: CAMPAIGN_SUBJECT,
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
      text: "Tengacion Millionaire starts Sunday, 26 July at 10:00 AM WAT. Participation is free.",
      metadata: {
        dedupeKey: CAMPAIGN_KEY,
        link: "/millionaire/register",
        flyerUrl,
        previewText: "Review the rules, prizes and launch flyer.",
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

const runMillionaireLaunchCampaign = async ({ adminUserId, io, onlineUsers } = {}) => {
  const runId = crypto.randomUUID();
  const campaign = await AdminEmailCampaign.findOneAndUpdate(
    {
      campaignKey: CAMPAIGN_KEY,
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
    return getMillionaireLaunchCampaignStatus();
  }

  try {
    await upsertAudienceDeliveries();
    await refreshCampaignCounts({ status: "sending" });

    while (true) {
      const deliveries = await AdminEmailDelivery.find({
        campaignKey: CAMPAIGN_KEY,
        status: { $in: ["pending", "failed"] },
        attempts: { $lt: MAX_DELIVERY_ATTEMPTS },
        lastRunId: { $ne: runId },
      })
        .sort({ createdAt: 1 })
        .limit(DELIVERY_BATCH_SIZE)
        .lean();
      if (!deliveries.length) break;

      await runWithConcurrency(deliveries, DELIVERY_CONCURRENCY, (delivery) =>
        sendDelivery({ delivery, runId, adminUserId, io, onlineUsers })
      );
      await refreshCampaignCounts({ status: "sending" });
    }

    const latest = await refreshCampaignCounts();
    const completed = Number(latest?.pendingCount || 0) === 0 && Number(latest?.failedCount || 0) === 0;
    const finalStatus = completed ? "completed" : "partial";
    const finalCampaign = await AdminEmailCampaign.findOneAndUpdate(
      { campaignKey: CAMPAIGN_KEY },
      {
        $set: {
          status: finalStatus,
          completedAt: new Date(),
          lastHeartbeatAt: new Date(),
          lastError: completed ? "" : "Some recipients could not be reached. Retry the failed deliveries.",
        },
      },
      { returnDocument: "after" }
    );
    return serializeCampaign(finalCampaign);
  } catch (error) {
    const failedCampaign = await refreshCampaignCounts({
      status: "failed",
      lastError: error?.message || "Campaign processing failed",
    });
    return serializeCampaign(failedCampaign);
  }
};

const queueMillionaireLaunchCampaign = async ({ adminUserId, io, onlineUsers } = {}) => {
  const settings = getEmailSettings();
  if (!settings.configured) {
    const error = new Error("Email service is not configured.");
    error.status = 503;
    error.code = "email_not_configured";
    throw error;
  }

  const { flyerUrl } = getCampaignUrls();
  let campaign = await AdminEmailCampaign.findOne({ campaignKey: CAMPAIGN_KEY });
  if (campaign?.status === "completed" || campaign?.status === "sending") {
    return {
      alreadyRunningOrSent: true,
      campaign: serializeCampaign(campaign, { configured: true }),
    };
  }

  if (!campaign) {
    try {
      campaign = await AdminEmailCampaign.create({
        campaignKey: CAMPAIGN_KEY,
        title: CAMPAIGN_TITLE,
        subject: CAMPAIGN_SUBJECT,
        status: "queued",
        launchAt: LAUNCH_AT,
        flyerUrl,
        initiatedBy: adminUserId,
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      campaign = await AdminEmailCampaign.findOne({ campaignKey: CAMPAIGN_KEY });
    }
  } else {
    campaign.status = "queued";
    campaign.initiatedBy = adminUserId;
    campaign.lastError = "";
    await campaign.save();
  }

  setImmediate(() => {
    runMillionaireLaunchCampaign({ adminUserId, io, onlineUsers }).catch((error) => {
      console.error("Millionaire launch campaign failed:", error);
    });
  });

  return {
    alreadyRunningOrSent: false,
    campaign: serializeCampaign(campaign, { configured: true }),
  };
};

module.exports = {
  CAMPAIGN_KEY,
  CAMPAIGN_SUBJECT,
  LAUNCH_AT,
  buildMillionaireLaunchEmail,
  getMillionaireLaunchCampaignStatus,
  queueMillionaireLaunchCampaign,
  runMillionaireLaunchCampaign,
};
