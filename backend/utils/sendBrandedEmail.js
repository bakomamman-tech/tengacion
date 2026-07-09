const nodemailer = require("nodemailer");
const { getEmailSettings } = require("./emailSettings");

const BRAND_NAME = "Tengacion";

const makeTransporter = (settings) =>
  nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

const escapeAttribute = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const buildFromAddress = (settings) => `"${BRAND_NAME}" <${settings.emailFrom}>`;

const buildLogoHtml = (settings) => {
  const logoUrl = escapeAttribute(settings.emailLogoUrl || "");
  if (!logoUrl) {
    return `<div style="width:52px;height:52px;border-radius:14px;background:#111827;color:#ffffff;font-family:Arial,sans-serif;font-size:22px;font-weight:700;line-height:52px;text-align:center;">T</div>`;
  }

  return `<img src="${logoUrl}" width="52" height="52" alt="Tengacion" style="display:block;width:52px;height:52px;border:0;border-radius:14px;object-fit:cover;" />`;
};

const buildBrandedEmailHtml = ({ html = "", previewText = "", settings }) => {
  const safePreview = escapeAttribute(previewText || "Tengacion account notification");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Tengacion</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f7fb;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreview}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#f5f7fb;margin:0;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px 24px 10px 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:0 14px 0 0;vertical-align:middle;">${buildLogoHtml(settings)}</td>
                    <td style="vertical-align:middle;">
                      <div style="font-family:Arial,sans-serif;font-size:19px;line-height:24px;font-weight:700;color:#111827;">Tengacion</div>
                      <div style="font-family:Arial,sans-serif;font-size:13px;line-height:18px;color:#6b7280;">Official Tengacion mail</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 28px 24px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;">
                ${html}
              </td>
            </tr>
          </table>
          <div style="font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#6b7280;margin-top:12px;text-align:center;">
            Sent by Tengacion
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const sendBrandedEmail = async ({ to, subject, html, text, previewText }) => {
  const settings = getEmailSettings();
  if (!settings.configured) {
    throw new Error("Email service is not configured");
  }

  const transporter = makeTransporter(settings);
  await transporter.sendMail({
    from: buildFromAddress(settings),
    to,
    subject,
    text,
    html: buildBrandedEmailHtml({ html, previewText: previewText || subject, settings }),
  });
};

module.exports = {
  buildBrandedEmailHtml,
  buildFromAddress,
  sendBrandedEmail,
};
