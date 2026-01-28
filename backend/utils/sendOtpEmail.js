const nodemailer = require("nodemailer");

const sendOtpEmail = async ({ email, otp }) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Gmail App Password
    },
  });

  await transporter.sendMail({
    from: `"Tengacion" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your Tengacion OTP Code",
    html: `
      <div style="font-family: Arial; padding: 12px;">
        <h2>Verify your email</h2>
        <p>Your OTP code is:</p>
        <h1 style="letter-spacing: 4px;">${otp}</h1>
        <p>This code expires in <b>10 minutes</b>.</p>
      </div>
    `,
  });
};

module.exports = sendOtpEmail;
