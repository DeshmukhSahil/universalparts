// utils/mailer.js
const nodemailer = require("nodemailer");

let transporterPromise;

async function getTransporter() {
  if (transporterPromise) return transporterPromise;
  transporterPromise = (async () => {
    if (process.env.ETHEREAL_USER && process.env.ETHEREAL_PASS) {
      return nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: process.env.ETHEREAL_USER,
          pass: process.env.ETHEREAL_PASS,
        },
      });
    }
    // create test account for dev
    const testAcct = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAcct.user,
        pass: testAcct.pass,
      },
    });
  })();
  return transporterPromise;
}

async function sendEmail({ to, subject, html, text }) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: `"No Reply" <no-reply@example.com>`,
    to,
    subject,
    text,
    html,
  });

  // for dev: return preview URL (ethereal)
  return {
    messageId: info.messageId,
    previewUrl: nodemailer.getTestMessageUrl(info) || null,
  };
}

module.exports = { sendEmail, getTransporter };
