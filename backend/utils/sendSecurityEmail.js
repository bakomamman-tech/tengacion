const nodemailer = require("nodemailer");
const { getEmailSettings } = require("./emailSettings");

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

const sendSecurityEmail = async ({ to, subject, html }) => {
  const settings = getEmailSettings();
  if (!settings.configured) {
    throw new Error("Email service is not configured");
  }
  const transporter = makeTransporter(settings);
  await transporter.sendMail({
    from: `"Tengacion" <${settings.emailFrom}>`,
    to,
    subject,
    html,
  });
};

module.exports = sendSecurityEmail;
