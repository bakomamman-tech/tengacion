const { sendBrandedEmail } = require("./sendBrandedEmail");

const sendOtpEmail = async ({ email, otp }) => {
  await sendBrandedEmail({
    to: email,
    subject: "Your Tengacion OTP Code",
    previewText: "Use this code to verify your Tengacion email.",
    html: `
      <div>
        <h2>Verify your email</h2>
        <p>Your OTP code is:</p>
        <h1 style="letter-spacing: 4px;">${otp}</h1>
        <p>This code expires in <b>10 minutes</b>.</p>
      </div>
    `,
  });
};

module.exports = sendOtpEmail;
