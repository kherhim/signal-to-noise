// scripts/line/mail.mjs
import { spawnSync } from 'node:child_process';
import { ENV, need, log } from './env.mjs';

const TOKEN_RE = /\[S2N ([a-z0-9]+)\]/;

export function classify(text) {
  const t = String(text ?? '').trim().toLowerCase().replace(/[.!]+$/, '');
  return ['no', 'hold', 'publish', 'ok'].includes(t) ? t : 'text';
}

function qpDecode(s) {
  return Buffer.from(s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8');
}

export function parseReply(raw) {
  const norm = raw.replace(/\r\n/g, '\n');
  const [head, ...rest] = norm.split('\n\n');
  const headers = {};
  for (const line of head.replace(/\n[ \t]+/g, ' ').split('\n')) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m) headers[m[1].toLowerCase()] = m[2].trim();
  }
  const body = rest.join('\n\n');
  const boundary = (headers['content-type'] ?? '').match(/boundary="?([^";]+)"?/)?.[1];
  let plain = body;
  let qp = /quoted-printable/i.test(headers['content-transfer-encoding'] ?? '');
  if (boundary) {
    const part = body.split(`--${boundary}`).find((p) => /content-type:\s*text\/plain/i.test(p));
    if (part) {
      const [ph, ...pb] = part.replace(/^\n/, '').split('\n\n');
      qp = /quoted-printable/i.test(ph);
      plain = pb.join('\n\n');
    }
  }
  if (qp) plain = qpDecode(plain);
  const above = plain.split(/\n(?=On .{6,120} wrote:)/)[0];
  const text = above.split('\n').filter((l) => !l.startsWith('>')).join('\n').trim();
  return { headers, text };
}

export function buildMime({ from, to, replyTo, subject, messageId, text, attachments = [] }) {
  const b = `----=_S2N_${Date.now()}`;
  const head = [
    `From: Signal to Noise <${from}>`, `To: ${to}`, `Reply-To: ${replyTo}`,
    `Subject: ${subject}`, `Message-ID: ${messageId}`, `Date: ${new Date().toUTCString()}`, 'MIME-Version: 1.0',
  ];
  if (!attachments.length) return [...head, 'Content-Type: text/plain; charset=UTF-8', '', text, ''].join('\r\n');
  const parts = [`--${b}`, 'Content-Type: text/plain; charset=UTF-8', '', text];
  for (const a of attachments) {
    parts.push(`--${b}`, `Content-Type: ${a.type}; name="${a.name}"`, 'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${a.name}"`, '', a.data.toString('base64').replace(/(.{76})/g, '$1\r\n'));
  }
  parts.push(`--${b}--`, '');
  return [...head, `Content-Type: multipart/mixed; boundary="${b}"`, '', ...parts].join('\r\n');
}

function curl(args, input) {
  const r = spawnSync('curl', ['-s', '-m', '40', ...args], { input, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`curl failed (${r.status}): ${r.stderr.slice(0, 200)}`);
  return r.stdout;
}

export function sendMail({ subject, text, attachments = [], token = Math.random().toString(36).slice(2, 8) }) {
  const from = need('ZOHO_USER'), to = need('OWNER_EMAIL'), replyTo = need('ESSAY_LINE_REPLY_TO');
  const messageId = `<line-${token}-${Date.now()}@signal-to-noise.co>`;
  const mime = buildMime({ from, to, replyTo, subject: `${subject} [S2N ${token}]`, messageId, text, attachments });
  curl(['--url', `smtps://${need('ZOHO_SMTP_HOST')}:465`, '--user', `${from}:${need('ZOHO_APP_PASSWORD')}`,
    '--mail-from', from, '--mail-rcpt', to, '-T', '-'], mime);
  log('mail', `sent "${subject}" token ${token}`);
  return { messageId, token };
}

export function findReply({ messageId }) {
  const host = need('ZOHO_IMAP_HOST'), auth = `${need('ZOHO_USER')}:${need('ZOHO_APP_PASSWORD')}`;
  const url = `imaps://${host}/INBOX`;
  const ids = curl(['--url', url, '--user', auth, '-X', `SEARCH HEADER In-Reply-To "${messageId}"`])
    .replace('* SEARCH', '').trim().split(/\s+/).filter(Boolean);
  if (!ids.length) return null;
  const raw = curl(['--url', `${url};MAILINDEX=${ids.at(-1)}`, '--user', auth]);
  const { headers, text } = parseReply(raw);
  return { verdict: classify(text), text, date: headers.date ?? null, from: headers.from ?? null };
}

export { TOKEN_RE };
