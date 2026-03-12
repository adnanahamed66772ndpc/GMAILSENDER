const form = document.getElementById('emailForm');
const sendBtn = document.getElementById('sendBtn');
const messageEl = document.getElementById('message');

function fetchAuth(url, options) {
  return fetch(url, options).then(res => {
    if (res.status === 401) window.location.href = '/login';
    return res;
  });
}

function showMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.className = 'message show ' + (isError ? 'error' : 'success');
  messageEl.setAttribute('role', 'alert');
}

function hideMessage() {
  messageEl.className = 'message';
  messageEl.removeAttribute('role');
}

// Load SMTP settings on page load
async function loadSmtp() {
  try {
    const res = await fetchAuth('/api/smtp');
    const data = await res.json();
    if (data.source === 'web') {
      document.getElementById('smtpHost').value = data.host || '';
      document.getElementById('smtpPort').value = data.port || 587;
      document.getElementById('smtpSecure').checked = !!data.secure;
      document.getElementById('smtpUser').value = data.user || '';
      document.getElementById('smtpPass').value = data.password === '********' ? '' : (data.password || '');
      document.getElementById('smtpFromEmail').value = data.fromEmail || '';
      document.getElementById('smtpFromName').value = data.fromName || '';
      document.getElementById('smtpStatus').textContent = 'Using web SMTP settings.';
    } else {
      document.getElementById('smtpStatus').textContent = data.useGmail ? 'Using Gmail from .env' : 'No SMTP set. Use form or .env';
      document.getElementById('smtpHost').value = document.getElementById('smtpHost').value || 'smtp.gmail.com';
      document.getElementById('smtpPort').value = document.getElementById('smtpPort').value || '587';
      if (data.user) document.getElementById('smtpUser').value = data.user;
      if (data.fromEmail) document.getElementById('smtpFromEmail').value = data.fromEmail;
      if (data.fromName) document.getElementById('smtpFromName').value = data.fromName;
    }
  } catch (e) {
    document.getElementById('smtpStatus').textContent = '';
  }
}
loadSmtp();

// Tab system
const tabButtons = document.querySelectorAll('.tab');
const tabPanels = document.querySelectorAll('.tab-panel');
function showPanel(panelId) {
  const panel = document.getElementById(panelId);
  if (panel && (panelId === 'panel-bulk' || panelId === 'panel-smtp')) loadUnsubList();
}
function renderUnsubList(emails) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const html = emails.length === 0
    ? '<li class="unsub-empty">None</li>'
    : emails.map(email => `<li><span>${esc(email)}</span> <button type="button" class="remove-unsub" data-email="${String(email).replace(/"/g, '&quot;')}">Remove</button></li>`).join('');
  return html;
}
function loadUnsubList() {
  const uls = document.querySelectorAll('#unsubList, #unsubListSettings');
  if (!uls.length) return;
  const emptyHtml = '<li class="unsub-empty">Could not load list.</li>';
  fetchAuth('/api/unsubscribes')
    .then(res => res.json())
    .then(emails => {
      const html = renderUnsubList(emails);
      uls.forEach(ul => { ul.innerHTML = html; });
    })
    .catch(() => { uls.forEach(ul => { ul.innerHTML = emptyHtml; }); });
}
function onRemoveUnsub(e) {
  if (!e.target.classList.contains('remove-unsub')) return;
  const email = e.target.getAttribute('data-email');
  if (!email) return;
  fetchAuth('/api/unsubscribes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
    .then(r => r.json())
    .then(data => { if (data.success) loadUnsubList(); })
    .catch(() => {});
}
document.getElementById('unsubList') && document.getElementById('unsubList').addEventListener('click', onRemoveUnsub);
document.getElementById('unsubListSettings') && document.getElementById('unsubListSettings').addEventListener('click', onRemoveUnsub);
tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('aria-controls');
    tabButtons.forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    tabPanels.forEach((p) => {
      p.classList.remove('active');
      p.hidden = true;
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    const panel = document.getElementById(targetId);
    if (panel) {
      panel.classList.add('active');
      panel.hidden = false;
      showPanel(targetId);
    }
  });
});

// Save SMTP
const smtpForm = document.getElementById('smtpForm');
const smtpStatus = document.getElementById('smtpStatus');
smtpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    host: document.getElementById('smtpHost').value.trim(),
    port: document.getElementById('smtpPort').value.trim() || '587',
    secure: document.getElementById('smtpSecure').checked,
    user: document.getElementById('smtpUser').value.trim(),
    pass: document.getElementById('smtpPass').value,
    fromEmail: document.getElementById('smtpFromEmail').value.trim(),
    fromName: document.getElementById('smtpFromName').value.trim()
  };
  if (!payload.host || !payload.user) {
    smtpStatus.textContent = 'Host and Username are required.';
    return;
  }
  document.getElementById('smtpSaveBtn').disabled = true;
  smtpStatus.textContent = 'Saving...';
  try {
    const res = await fetchAuth('/api/smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (data.success) {
      smtpStatus.textContent = 'SMTP saved.';
    } else {
      smtpStatus.textContent = data.error || 'Save failed.';
    }
    if (!res.ok && data.error) smtpStatus.textContent = data.error;
  } catch (err) {
    smtpStatus.textContent = 'Network error. Make sure the server is running (npm start) and you open http://localhost:' + (window.location.port || '3000') + ' in the browser.';
  }
  document.getElementById('smtpSaveBtn').disabled = false;
});

// Parse CSV and return array of emails (first column or column named "email")
function parseCsvEmails(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return [];
  const header = lines[0].toLowerCase();
  const cols = header.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
  let emailIdx = cols.findIndex(c => c === 'email');
  if (emailIdx === -1) emailIdx = 0;
  const emails = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    const match = row.match(new RegExp('(?:^|,)("(?:[^"]*(?:""[^"]*)*)"|[^,]*)'.repeat(cols.length).slice(0, -1) + '?')) || [row];
    let cell = row;
    if (row.includes(',')) {
      const parts = [];
      let inQuotes = false;
      let cur = '';
      for (let j = 0; j < row.length; j++) {
        const ch = row[j];
        if (ch === '"') inQuotes = !inQuotes;
        else if ((ch === ',' && !inQuotes) || j === row.length - 1) {
          if (j === row.length - 1) cur += ch;
          parts.push(cur.replace(/^"|"$/g, '').trim());
          cur = '';
        } else cur += ch;
      }
      if (cur) parts.push(cur.replace(/^"|"$/g, '').trim());
      cell = parts[emailIdx] != null ? parts[emailIdx] : parts[0];
    }
    const email = (cell || row).trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) emails.push(email);
  }
  return emails;
}

// Simpler CSV parse: split by newline, then by comma; take first column or column named email
function parseCsvEmailsSimple(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return [];
  const header = lines[0].toLowerCase();
  const sep = header.includes(',') ? ',' : '\t';
  const cols = header.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));
  const emailIdx = cols.includes('email') ? cols.indexOf('email') : 0;
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep).map(p => p.replace(/^["']|["']$/g, '').trim());
    const email = (parts[emailIdx] != null ? parts[emailIdx] : parts[0] || '').trim();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) result.push(email);
  }
  return result;
}

// Read files as base64 for attachments (max 5MB per file)
const MAX_FILE_SIZE = 5 * 1024 * 1024;
function readAttachments(fileInput) {
  const files = fileInput.files;
  if (!files || files.length === 0) return Promise.resolve([]);
  const list = [];
  let index = 0;
  return new Promise((resolve, reject) => {
    function next() {
      if (index >= files.length) {
        resolve(list);
        return;
      }
      const file = files[index++];
      if (file.size > MAX_FILE_SIZE) {
        next();
        return;
      }
      const reader = new FileReader();
      reader.onload = function () {
        const base64 = (reader.result || '').split(',')[1] || reader.result || '';
        list.push({ filename: file.name, content: base64 });
        next();
      };
      reader.onerror = () => next();
      reader.readAsDataURL(file);
    }
    next();
  });
}

document.getElementById('attachments').addEventListener('change', function () {
  const names = Array.from(this.files || []).map(f => f.name);
  document.getElementById('attachList').textContent = names.length ? names.join(', ') : '';
});
document.getElementById('bulkAttachments').addEventListener('change', function () {
  const names = Array.from(this.files || []).map(f => f.name);
  document.getElementById('bulkAttachList').textContent = names.length ? names.join(', ') : '';
});

// CSV file upload
document.getElementById('csvFile').addEventListener('change', function (e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (ev) {
    const emails = parseCsvEmailsSimple(ev.target.result || '');
    document.getElementById('bulkTo').value = emails.join('\n');
    showMessage(emails.length ? `Loaded ${emails.length} email(s) from CSV.` : 'No valid emails found in CSV. First column or "email" column used.', emails.length === 0);
  };
  reader.readAsText(file, 'UTF-8');
  e.target.value = '';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMessage();

  const to = document.getElementById('to').value.trim();
  const subject = document.getElementById('subject').value.trim();
  const body = document.getElementById('body').value.trim();

  if (!to) {
    showMessage('Please enter recipient email.', true);
    return;
  }

  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';

  try {
    const attachments = await readAttachments(document.getElementById('attachments'));
    const payload = { to, subject, text: body, html: body ? body.replace(/\n/g, '<br>') : '' };
    if (attachments.length) payload.attachments = attachments;
    const res = await fetchAuth('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let data;
    try {
      data = await res.json();
    } catch (_) {
      showMessage(res.ok ? 'Invalid response from server.' : 'Server error ' + res.status + '. Run: npm start', true);
      return;
    }

    if (data.success) {
      showMessage(data.message || 'Email sent successfully!');
      form.reset();
      document.getElementById('attachments').value = '';
      document.getElementById('attachList').textContent = '';
    } else {
      showMessage(data.error || 'Something went wrong.', true);
    }
  } catch (err) {
    const url = window.location.origin || 'http://localhost:3000';
    showMessage('Cannot reach server. Open ' + url + ' in the browser and run: npm start', true);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Email';
  }
});

// Bulk send
const bulkForm = document.getElementById('bulkForm');
const bulkSendBtn = document.getElementById('bulkSendBtn');

bulkForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMessage();

  const bulkTo = document.getElementById('bulkTo').value.trim();
  const bulkSubject = document.getElementById('bulkSubject').value.trim();
  const bulkBody = document.getElementById('bulkBody').value.trim();
  const addUnsubscribeLink = document.getElementById('addUnsubscribeLink').checked;

  if (!bulkTo) {
    showMessage('Enter at least one recipient email.', true);
    return;
  }
  if (!bulkSubject) {
    showMessage('Please enter a subject.', true);
    return;
  }

  bulkSendBtn.disabled = true;
  bulkSendBtn.textContent = 'Sending bulk...';
  const liveEl = document.getElementById('bulkLiveCount');
  const messageElBulk = document.getElementById('message');

  try {
    const attachments = await readAttachments(document.getElementById('bulkAttachments'));
    const payload = {
      to: bulkTo,
      subject: bulkSubject,
      text: bulkBody,
      html: bulkBody ? bulkBody.replace(/\n/g, '<br>') : '',
      addUnsubscribeLink
    };
    if (attachments.length) payload.attachments = attachments;

    const res = await fetchAuth('/api/send-bulk-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({}));
      showMessage(err.error || 'Request failed.', true);
      return;
    }

    hideMessage();
    liveEl.hidden = false;
    liveEl.className = 'bulk-live-count show';

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalData = null;

    function processChunk(str) {
      const parts = str.split('\n\n');
      for (const part of parts) {
        const m = part.match(/^data:\s*(.+)$/m);
        if (!m) continue;
        try {
          const data = JSON.parse(m[1]);
          if (data.done) {
            finalData = data;
            return;
          }
          const { sent = 0, skipped = 0, failed = 0, total = 0, processed = 0 } = data;
          liveEl.innerHTML = 'Sending… <strong>Sent: ' + sent + '</strong> | Skipped: ' + skipped + ' | Failed: ' + failed + ' <span class="bulk-progress">(' + processed + ' / ' + total + ')</span>';
        } catch (_) {}
      }
    }

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(0), { stream: !done });
      const idx = buffer.lastIndexOf('\n\n');
      if (idx !== -1) {
        processChunk(buffer.slice(0, idx + 2));
        buffer = buffer.slice(idx + 2);
      }
      if (done) {
        processChunk(buffer);
        break;
      }
      if (finalData) break;
    }

    liveEl.hidden = true;
    liveEl.className = 'bulk-live-count';

    if (finalData) {
      let msg = 'Sent: ' + finalData.sent + ', Skipped: ' + finalData.skipped + ', Failed: ' + finalData.failed;
      if (finalData.failedEmails && finalData.failedEmails.length > 0) {
        msg += ' — Failed: ' + finalData.failedEmails.map(f => f.email).join(', ');
      }
      showMessage(msg);
      if (finalData.sent > 0) {
        bulkForm.reset();
        document.getElementById('bulkAttachments').value = '';
        document.getElementById('bulkAttachList').textContent = '';
      }
    } else {
      showMessage('Done. Check counts above.', false);
    }
  } catch (err) {
    if (liveEl) liveEl.hidden = true;
    showMessage('Cannot reach server. Open ' + (window.location.origin || 'http://localhost:3000') + ' and run: npm start', true);
  } finally {
    bulkSendBtn.disabled = false;
    bulkSendBtn.textContent = 'Send Bulk Email';
  }
});
