#!/usr/bin/env node
/* Post to Substack (hkher.substack.com) via the private dashboard API.
 *
 * Substack has no official API; this drives the same JSON endpoints the
 * web dashboard uses, authenticated with a browser session cookie. The
 * endpoints are stable enough that python-substack has wrapped them for
 * years, but they can change without notice — if a call 404s, re-check
 * against https://github.com/ma2za/python-substack.
 *
 * Auth: put your session cookie in .env (gitignored):
 *   SUBSTACK_SID=<value of the `substack.sid` cookie>
 * Grab it while logged in: DevTools → Application → Cookies →
 * https://substack.com → substack.sid. Rotates when you log out.
 *
 * Commands:
 *   probe                       verify the cookie, print user id
 *   draft <file.md>             create a draft from a hook file
 *   list                        list current drafts
 *   publish <draftId>           publish a draft WITHOUT sending email
 *   publish <draftId> --send-email   publish and email subscribers
 *
 * Hook file format — markdown with frontmatter:
 *   ---
 *   title: ...
 *   subtitle: ...
 *   ---
 *   body markdown (## headings, paragraphs, **bold**, *em*, [links](url),
 *   > blockquotes, - lists, --- rules)
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUB = 'https://hkher.substack.com';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- env ----------

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(resolve(ROOT, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* fall through to process.env */
  }
  return { ...env, ...process.env };
}

const ENV = loadEnv();
const SID = ENV.SUBSTACK_SID;
if (!SID) {
  console.error('Missing SUBSTACK_SID. Add it to .env (see header comment).');
  process.exit(1);
}

// ---------- http ----------

async function api(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      cookie: `substack.sid=${SID}`,
      'content-type': 'application/json',
      referer: `${PUB}/publish`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${url} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

// ---------- markdown → ProseMirror ----------

function inline(text) {
  // Tokenize links first so their labels still get bold/em parsing.
  const nodes = [];
  const linkRe = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m;
  while ((m = linkRe.exec(text)) !== null) {
    if (m.index > last) nodes.push(...marks(text.slice(last, m.index)));
    nodes.push(
      ...marks(m[1]).map((n) => ({
        ...n,
        marks: [...(n.marks ?? []), { type: 'link', attrs: { href: m[2] } }],
      })),
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(...marks(text.slice(last)));
  return nodes;
}

function marks(text) {
  // **bold**, *em*, `code` — non-nested, which is all the hooks use.
  const out = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) });
    if (m[2]) out.push({ type: 'text', text: m[2], marks: [{ type: 'strong' }] });
    else if (m[3]) out.push({ type: 'text', text: m[3], marks: [{ type: 'em' }] });
    else if (m[4]) out.push({ type: 'text', text: m[4], marks: [{ type: 'code' }] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out.filter((n) => n.text.length > 0);
}

function mdToDoc(md) {
  const content = [];
  for (const block of md.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)) {
    const h = block.match(/^(#{1,4})\s+(.*)$/s);
    if (h) {
      content.push({
        type: 'heading',
        attrs: { level: h[1].length },
        content: inline(h[2].replace(/\n/g, ' ')),
      });
    } else if (/^---+$/.test(block)) {
      content.push({ type: 'horizontal_rule' });
    } else if (block.startsWith('>')) {
      const text = block
        .split('\n')
        .map((l) => l.replace(/^>\s?/, ''))
        .join(' ')
        .trim();
      content.push({
        type: 'blockquote',
        content: [{ type: 'paragraph', content: inline(text) }],
      });
    } else if (/^[-*]\s/.test(block)) {
      content.push({
        type: 'bullet_list',
        content: block.split('\n').map((l) => ({
          type: 'list_item',
          content: [
            { type: 'paragraph', content: inline(l.replace(/^[-*]\s+/, '')) },
          ],
        })),
      });
    } else {
      content.push({ type: 'paragraph', content: inline(block.replace(/\n/g, ' ')) });
    }
  }
  return { type: 'doc', content };
}

// ---------- hook file ----------

function parseHook(path) {
  const raw = readFileSync(path, 'utf8');
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fm) throw new Error(`${path}: missing frontmatter (--- title/subtitle ---)`);
  const meta = {};
  for (const line of fm[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  if (!meta.title) throw new Error(`${path}: frontmatter needs a title`);
  return { title: meta.title, subtitle: meta.subtitle ?? '', body: fm[2].trim() };
}

// ---------- commands ----------

async function userId() {
  if (ENV.SUBSTACK_USER_ID) return Number(ENV.SUBSTACK_USER_ID);
  const candidates = [
    'https://substack.com/api/v1/user/profile/self',
    `${PUB}/api/v1/subscription`,
  ];
  for (const url of candidates) {
    try {
      const r = await api(url);
      const id = r?.id ?? r?.user_id;
      if (id) return Number(id);
    } catch {
      /* try next */
    }
  }
  throw new Error(
    'Could not resolve user id — run `probe`, find your id in the output, ' +
      'and set SUBSTACK_USER_ID in .env',
  );
}

async function cmdProbe() {
  for (const url of [
    'https://substack.com/api/v1/user/profile/self',
    `${PUB}/api/v1/subscription`,
    `${PUB}/api/v1/drafts`,
  ]) {
    try {
      const r = await api(url);
      const s = JSON.stringify(r);
      console.log(`OK   ${url}\n     ${s.slice(0, 240)}${s.length > 240 ? '…' : ''}`);
    } catch (e) {
      console.log(`FAIL ${url} — ${e.message.slice(0, 160)}`);
    }
  }
}

async function cmdDraft(file) {
  const { title, subtitle, body } = parseHook(file);
  const id = await userId();
  const draft = await api(`${PUB}/api/v1/drafts`, {
    method: 'POST',
    body: {
      draft_title: title,
      draft_subtitle: subtitle,
      draft_body: JSON.stringify(mdToDoc(body)),
      draft_bylines: [{ id, is_guest: false }],
      audience: 'everyone',
      type: 'newsletter',
      section_chosen: false,
      draft_section_id: null,
      write_comment_permissions: 'everyone',
    },
  });
  console.log(`Draft ${draft.id}: ${title}`);
  console.log(`Review: ${PUB}/publish/post/${draft.id}`);
  return draft.id;
}

async function cmdList() {
  const drafts = await api(`${PUB}/api/v1/drafts`);
  for (const d of drafts) {
    console.log(`${d.id}\t${d.draft_title ?? '(untitled)'}`);
  }
  if (!drafts.length) console.log('No drafts.');
}

async function cmdPublish(id, sendEmail) {
  const post = await api(`${PUB}/api/v1/drafts/${id}/publish`, {
    method: 'POST',
    body: { send: sendEmail, share_automatically: false },
  });
  console.log(
    `Published${sendEmail ? ' + emailed' : ' (no email)'}: ${PUB}/p/${post.slug}`,
  );
}

// ---------- main ----------

const [cmd, arg] = process.argv.slice(2);
const sendEmail = process.argv.includes('--send-email');

try {
  if (cmd === 'probe') await cmdProbe();
  else if (cmd === 'draft' && arg) await cmdDraft(arg);
  else if (cmd === 'list') await cmdList();
  else if (cmd === 'publish' && arg) await cmdPublish(arg, sendEmail);
  else {
    console.error(
      'Usage: substack-post.mjs probe | draft <file.md> | list | publish <id> [--send-email]',
    );
    process.exit(1);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
