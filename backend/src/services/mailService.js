const nodemailer = require('nodemailer');
const env = require('../config/env');
const { textToHtml } = require('../utils/html');

let transporterPromise = null;

async function buildTransporter() {
  let { host, port, user, pass } = env.smtp;

  if (!user || !pass) {
    console.log('[mail] No SMTP_USER/SMTP_PASS in .env -> creating a free Ethereal test account...');
    const account = await nodemailer.createTestAccount();
    host = account.smtp.host;
    port = account.smtp.port;
    user = account.user;
    pass = account.pass;
    console.log('[mail] Ethereal inbox ready. View sent emails at https://ethereal.email/login');
    console.log(`[mail]   user: ${user}`);
    console.log(`[mail]   pass: ${pass}`);
    console.log('[mail] (optional) paste these into backend/.env as SMTP_USER / SMTP_PASS to reuse this inbox');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

// Lazily created once; if creation fails it is retried on the next call.
function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = buildTransporter().catch((err) => {
      transporterPromise = null;
      throw err;
    });
  }
  return transporterPromise;
}

async function sendMail({ to, subject, body }) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: env.smtp.from,
    to,
    subject,
    text: body,
    html: textToHtml(body),
  });
  return {
    messageId: info.messageId,
    previewUrl: nodemailer.getTestMessageUrl(info) || null, // only set for Ethereal
  };
}

module.exports = { getTransporter, sendMail };
