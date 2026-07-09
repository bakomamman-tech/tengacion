const { sendBrandedEmail } = require("./sendBrandedEmail");

const sendSecurityEmail = async ({ to, subject, html }) => {
  await sendBrandedEmail({
    to,
    subject,
    html,
  });
};

module.exports = sendSecurityEmail;
