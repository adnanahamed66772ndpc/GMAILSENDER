require('dotenv').config();
const express = require('express');
const session = require('express-session');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const UNSUBSCRIBES_FILE = path.join(DATA_DIR, 'unsubscribes.json');
const SMTP_CONFIG_FILE = path.join(DATA_DIR, 'smtp.json');

const SITE_USER = (process.env.SITE_USER || process.env.LOGIN_USER || '').trim();
const SITE_PASSWORD = (process.env.SITE_PASSWORD || process.env.LOGIN_PASSWORD || '').trim();

app.use(express.json({ limit: '25mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'gmail-sender-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

function requireAuth(req, res, next) {
  const allowed = ['/login', '/api/login', '/api/logout', '/logout', '/unsubscribe', '/api/ping'];
  if (allowed.includes(req.path) || req.path.startsWith('/unsubscribe')) return next();
  if (req.session && req.session.user) return next();
  if (req.path === '/' || req.path === '') return res.redirect('/login');
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Login required' });
  next();
}
app.use(requireAuth);

app.get('/login', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.post('/api/login', (req, res) => {
  const { user, password } = req.body || {};
  if (!SITE_USER || !SITE_PASSWORD) {
    return res.status(500).json({ success: false, error: 'Server: Set SITE_USER and SITE_PASSWORD in .env' });
  }
  if (String(user).trim() === SITE_USER && String(password) === SITE_PASSWORD) {
    req.session.user = SITE_USER;
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, error: 'Invalid username or password' });
});
app.get('/logout', (req, res) => {
  req.session.destroy(() => {});
  res.redirect('/login');
});
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {});
  res.json({ success: true });
});

app.use(express.static(path.join(__dirname, 'public')));

// Unsubscribe list
let unsubscribedEmails = new Set();
function loadUnsubscribes() {
  try {
    if (fs.existsSync(UNSUBSCRIBES_FILE)) {
      const data = JSON.parse(fs.readFileSync(UNSUBSCRIBES_FILE, 'utf8'));
      unsubscribedEmails = new Set(Array.isArray(data) ? data : data.emails || []);
    }
  } catch (e) {
    unsubscribedEmails = new Set();
  }
}
function saveUnsubscribes() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(UNSUBSCRIBES_FILE, JSON.stringify([...unsubscribedEmails], null, 2), 'utf8');
  } catch (e) {
    console.error('Unsubscribes save error:', e.message);
  }
}
loadUnsubscribes();

// SMTP: use web config if present, else .env Gmail
let transporter = null;
function loadSmtpConfig() {
  try {
    if (fs.existsSync(SMTP_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(SMTP_CONFIG_FILE, 'utf8'));
    }
  } catch (e) {}
  return null;
}
function buildTransporter() {
  const smtp = loadSmtpConfig();
  if (smtp && smtp.host && smtp.user) {
    const port = parseInt(smtp.port, 10) || 587;
    // Port 465 = implicit SSL. Port 587/25 = plain then STARTTLS (never use secure: true on 587).
    const secure = port === 465;
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port,
      secure,
      requireTLS: !secure,
      auth: { user: smtp.user, pass: smtp.pass || '' },
      tls: secure ? undefined : { rejectUnauthorized: true }
    });
    return;
  }
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
    return;
  }
  transporter = null;
}
function getFromName() {
  const smtp = loadSmtpConfig();
  if (smtp && smtp.fromName) return String(smtp.fromName).replace(/"/g, '');
  return (process.env.GMAIL_FROM_NAME || 'Gmail Sender').trim().replace(/"/g, '');
}
function getFromEmail() {
  const smtp = loadSmtpConfig();
  if (smtp && smtp.fromEmail) return String(smtp.fromEmail).trim();
  if (smtp && smtp.user) return smtp.user;
  return process.env.GMAIL_USER || '';
}
function hasSmtp() {
  buildTransporter();
  return transporter !== null;
}
buildTransporter();

// Token for unsubscribe link
function emailToToken(email) {
  const base64 = Buffer.from(email.trim().toLowerCase(), 'utf8').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function tokenToEmail(token) {
  try {
    let b = token.replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    return Buffer.from(b, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

function getUnsubscribeBlock(recipientEmail, addLink = true) {
  const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
  const token = emailToToken(recipientEmail);
  const url = `${baseUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
  if (!addLink) return { text: '', html: '' };
  const text = `\n\n---\nDon't want to receive these emails? Unsubscribe here: ${url}`;
  const html = `<br><br><hr><p style="color:#888;font-size:12px;">Don't want to receive these emails? <a href="${url}">Unsubscribe here</a>.</p>`;
  return { text, html };
}

// Health check – so frontend can detect if server is reachable
app.get('/api/ping', (req, res) => {
  res.json({ ok: true });
});

// GET /api/smtp – current config (password masked)
app.get('/api/smtp', (req, res) => {
  const smtp = loadSmtpConfig();
  if (smtp && smtp.host) {
    return res.json({
      source: 'web',
      host: smtp.host,
      port: smtp.port || 587,
      secure: smtp.secure === true,
      user: smtp.user,
      fromEmail: smtp.fromEmail || '',
      fromName: smtp.fromName || '',
      password: smtp.pass ? '********' : ''
    });
  }
  res.json({
    source: 'env',
    useGmail: !!process.env.GMAIL_USER,
    fromName: process.env.GMAIL_FROM_NAME || '',
    fromEmail: process.env.GMAIL_USER || '',
    user: process.env.GMAIL_USER || ''
  });
});

// POST /api/smtp – save SMTP from web
app.post('/api/smtp', (req, res) => {
  try {
    const { host, port, secure, user, pass, fromEmail, fromName } = req.body || {};
    if (!host || !user) {
      return res.status(400).json({ success: false, error: 'Host and Username are required' });
    }
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const config = {
      host: String(host).trim(),
      port: (port !== undefined && port !== '') ? parseInt(port, 10) || 587 : 587,
      secure: !!secure,
      user: String(user).trim(),
      pass: pass != null ? String(pass) : '',
      fromEmail: fromEmail != null ? String(fromEmail).trim() : '',
      fromName: fromName != null ? String(fromName).trim() : ''
    };
    fs.writeFileSync(SMTP_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    buildTransporter();
    return res.json({ success: true, message: 'SMTP settings saved.' });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || 'Failed to save SMTP' });
  }
});

// GET unsubscribed list (so UI can show / resubscribe)
app.get('/api/unsubscribes', (req, res) => {
  loadUnsubscribes();
  res.json([...unsubscribedEmails].sort());
});

// DELETE remove one from unsubscribed list (resubscribe)
app.delete('/api/unsubscribes', (req, res) => {
  const email = req.body && req.body.email ? String(req.body.email).trim().toLowerCase() : '';
  if (!email) return res.status(400).json({ success: false, error: 'Email required' });
  unsubscribedEmails.delete(email);
  saveUnsubscribes();
  res.json({ success: true, message: 'Removed from unsubscribe list.' });
});

// Unsubscribe page
app.get('/unsubscribe', (req, res) => {
  const token = req.query.token;
  const email = token ? tokenToEmail(token) : null;
  if (!email) {
    return res.status(400).send(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Invalid link</title></head>
      <body style="font-family:system-ui;max-width:480px;margin:2rem auto;padding:1rem;text-align:center;">
        <p>This link is invalid or has already been used.</p>
        <a href="/">Back to home</a>
      </body></html>
    `);
  }
  const normalized = email.trim().toLowerCase();
  unsubscribedEmails.add(normalized);
  saveUnsubscribes();
  res.send(`
    <!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
    <body style="font-family:system-ui;max-width:480px;margin:2rem auto;padding:1rem;text-align:center;">
      <h2>Unsubscribed</h2>
      <p>No more emails will be sent to: ${email}</p>
      <a href="/">Back to home</a>
    </body></html>
  `);
});

// Parse attachments from body: [{ filename, content: base64 }] -> [{ filename, content: Buffer }]
function parseAttachments(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) return undefined;
  const list = [];
  for (const a of attachments) {
    if (!a || !a.filename) continue;
    const content = a.content;
    if (typeof content === 'string') {
      try {
        list.push({ filename: String(a.filename), content: Buffer.from(content, 'base64') });
      } catch (e) { /* skip invalid */ }
    }
  }
  return list.length ? list : undefined;
}

// Single email
app.post('/api/send', async (req, res) => {
  const { to, subject, text, html, attachments } = req.body;

  if (!to || !subject) {
    return res.status(400).json({ success: false, error: 'To and Subject are required' });
  }
  if (!hasSmtp()) {
    return res.status(500).json({
      success: false,
      error: 'SMTP not configured. Set in SMTP Settings below or add GMAIL_USER and GMAIL_APP_PASSWORD to .env'
    });
  }

  const toEmail = to.trim();
  const attachmentsList = parseAttachments(attachments);
  const mailOptions = {
    from: `"${getFromName()}" <${getFromEmail()}>`,
    replyTo: getFromEmail(),
    to: toEmail,
    subject: subject.trim(),
    text: text || '',
    html: html || (text ? text.replace(/\n/g, '<br>') : ''),
    headers: { 'X-Priority': '3', 'X-Mailer': 'Gmail Sender (Node)' }
  };
  if (attachmentsList) mailOptions.attachments = attachmentsList;

  try {
    const info = await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Email sent!', messageId: info.messageId });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to send email.'
    });
  }
});

// Bulk send
app.post('/api/send-bulk', async (req, res) => {
  const { to, subject, text, html, addUnsubscribeLink, attachments } = req.body;

  if (!to || !subject) {
    return res.status(400).json({ success: false, error: 'Recipient list and Subject are required' });
  }
  if (!hasSmtp()) {
    return res.status(500).json({
      success: false,
      error: 'SMTP not configured. Set in SMTP Settings below or add GMAIL_USER and GMAIL_APP_PASSWORD to .env'
    });
  }

  const rawList = typeof to === 'string' ? to : (Array.isArray(to) ? to.join('\n') : '');
  const emails = rawList
    .split(/[\n,;]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  const unique = [...new Set(emails)];

  const addLink = addUnsubscribeLink !== false;
  const results = { sent: 0, skipped: 0, failed: 0, failedEmails: [] };
  const delayMs = Math.max(200, parseInt(process.env.BULK_DELAY_MS, 10) || 400);

  for (const email of unique) {
    if (unsubscribedEmails.has(email)) {
      results.skipped++;
      continue;
    }
    const unsub = getUnsubscribeBlock(email, addLink);
    const textBody = (text || '').trim();
    const htmlBody = (html || (textBody ? textBody.replace(/\n/g, '<br>') : '')).trim();
    const finalText = textBody + unsub.text;
    const finalHtml = htmlBody + unsub.html;

    const mailOptions = {
      from: `"${getFromName()}" <${getFromEmail()}>`,
      replyTo: getFromEmail(),
      to: email,
      subject: subject.trim(),
      text: finalText,
      html: finalHtml,
      headers: { 'X-Priority': '3', 'X-Mailer': 'Gmail Sender (Node)' }
    };
    const attachmentsList = parseAttachments(attachments);
    if (attachmentsList) mailOptions.attachments = attachmentsList;
    try {
      await transporter.sendMail(mailOptions);
      results.sent++;
    } catch (err) {
      results.failed++;
      results.failedEmails.push({ email, error: err.message });
    }
    await new Promise(r => setTimeout(r, delayMs));
  }

  res.json({
    success: true,
    message: `Sent: ${results.sent}, Skipped: ${results.skipped}, Failed: ${results.failed}`,
    ...results
  });
});

// Bulk send with live progress (SSE stream)
app.post('/api/send-bulk-stream', async (req, res) => {
  const { to, subject, text, html, addUnsubscribeLink, attachments } = req.body;

  if (!to || !subject) {
    return res.status(400).json({ success: false, error: 'Recipient list and Subject are required' });
  }
  if (!hasSmtp()) {
    return res.status(500).json({
      success: false,
      error: 'SMTP not configured. Set in SMTP Settings below or add GMAIL_USER and GMAIL_APP_PASSWORD to .env'
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const rawList = typeof to === 'string' ? to : (Array.isArray(to) ? to.join('\n') : '');
  const emails = rawList
    .split(/[\n,;]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  const unique = [...new Set(emails)];
  const total = unique.length;

  const addLink = addUnsubscribeLink !== false;
  const results = { sent: 0, skipped: 0, failed: 0, failedEmails: [] };
  const delayMs = Math.max(200, parseInt(process.env.BULK_DELAY_MS, 10) || 400);

  const sendEvent = (obj) => {
    res.write('data: ' + JSON.stringify(obj) + '\n\n');
    if (typeof res.flush === 'function') res.flush();
  };

  let processed = 0;
  for (const email of unique) {
    if (unsubscribedEmails.has(email)) {
      results.skipped++;
      processed++;
      sendEvent({ ...results, total, processed });
      continue;
    }
    const unsub = getUnsubscribeBlock(email, addLink);
    const textBody = (text || '').trim();
    const htmlBody = (html || (textBody ? textBody.replace(/\n/g, '<br>') : '')).trim();
    const finalText = textBody + unsub.text;
    const finalHtml = htmlBody + unsub.html;

    const mailOptions = {
      from: `"${getFromName()}" <${getFromEmail()}>`,
      replyTo: getFromEmail(),
      to: email,
      subject: subject.trim(),
      text: finalText,
      html: finalHtml,
      headers: { 'X-Priority': '3', 'X-Mailer': 'Gmail Sender (Node)' }
    };
    const attachmentsList = parseAttachments(attachments);
    if (attachmentsList) mailOptions.attachments = attachmentsList;
    try {
      await transporter.sendMail(mailOptions);
      results.sent++;
    } catch (err) {
      results.failed++;
      results.failedEmails.push({ email, error: err.message });
    }
    processed++;
    sendEvent({ ...results, total, processed });
    await new Promise(r => setTimeout(r, delayMs));
  }

  sendEvent({ done: true, ...results, total });
  res.end();
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
