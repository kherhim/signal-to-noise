# Weekly Essay Line Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish one essay a week on signal-to-noise.co with no human in the loop except a Monday brief email (silence = go) and a Tuesday final email (explicit "publish" required), enforcing the site's standing rules in code.

**Architecture:** A staged local pipeline. Each essay has a folder under `_sources/staging-articles/<slug>/` with a `state.json`; a launchd runner wakes four times a day and advances whichever essay is due by exactly one stage. Creative stages call headless Claude (`claude -p`) with a versioned skill from `.claude/skills/essay-line/`; mechanical stages are plain Node scripts under `scripts/line/`. Mail goes out through Zoho SMTP and replies are read from Zoho IMAP, both via `curl` so there are no new dependencies.

**Tech Stack:** Node 25 (ESM, `node --test`, native TypeScript type-stripping for cover modules), `curl` for SMTP/IMAP/HTTP, `claude` CLI 2.1 headless with `--output-format json`, `codex exec` for Layer B, the local watermarks service on `:8765` for Layer A, existing `scripts/render-cover.mjs`, `scripts/make-og-images.mjs`, `deploy.sh`, `scripts/substack-mirror.mjs`, `scripts/metrics-pull.mjs`.

## Global Constraints

- British English in every string that ships and in every skill prompt (`-ise`, `-our`, `-re`; house style "learned" not "learnt").
- Never mention Axi, the owner's employer, colleagues or clients; never a company on `_sources/NEVER-LIST.md`; never a number or quote from memory (spec §1 rules A, B, D).
- Every shipping string goes through Layer B (Codex) then plagiarism, British English, and Layer A last, in that order (spec §5).
- Monday brief: silence means go. Tuesday final: silence means hold; only the word `publish` ships (spec §2).
- Automation mail always sets `Reply-To: essay-line@signal-to-noise.co`; replies are matched on the subject token `[S2N <token>]` because Zoho IMAP cannot search `In-Reply-To` (found in Task 2); `In-Reply-To` is checked only when present (spec §6).
- Scanner runs score-only until `calibration_until` in `distribution/line/config.json` (initially `2026-10-07`).
- Kill switch: `distribution/autopilot/PAUSE` halts every job. `state.json.hold === true` parks one essay.
- Credentials only from `.env` (`SUBSTACK_SID`, `ZOHO_*`, `OWNER_EMAIL`, `ESSAY_LINE_REPLY_TO`, `CLOUDFLARE_*`); never printed, never committed.
- Article format per `docs/specs/article-formatting.md` (sentence-case titles and headings, frontmatter keys `title, date, excerpt, seoDescription, tags, draft, coverImage, coverImageAlt, coverAnimation`).
- Commit after every task with the session's attribution trailer.

---

## File structure

| Path | Responsibility |
|---|---|
| `scripts/line/env.mjs` | Load `.env`, resolve `ROOT`, shared `log()`, `PAUSE` check, `nowIso()` |
| `scripts/line/mail.mjs` | `sendMail`, `findReply`, `parseReply` (curl SMTP/IMAP, MIME building) |
| `scripts/line/claude.mjs` | `runSkill` — headless Claude with a skill file, JSON result, cost |
| `scripts/line/state.mjs` | Per-essay `state.json` load/save/list; stage constants |
| `scripts/line/scan.mjs` | Daily scanner → `distribution/line/peg-board.{md,json}` |
| `scripts/line/layerb.mjs` | Codex rewrite of body + frontmatter strings |
| `scripts/line/bre.mjs` | British English scan and spelling fixes |
| `scripts/line/layera.mjs` | Watermarks service inspect/clean |
| `scripts/line/plagiarism.mjs` | Exact-phrase web checks + citation verification via headless Claude |
| `scripts/line/gate.mjs` | Orchestrates the four checks → `gate-report.md`, exit code |
| `scripts/line/cover.mjs` | Cover skill → module → render → OG → motion check |
| `scripts/line/brief.mjs` | Topic selection, never-list check, brief email |
| `scripts/line/draft.mjs` | Outline + draft via write-essay skill |
| `scripts/line/final.mjs` | Builds `final.md`, sends the Tuesday email |
| `scripts/line/publish.mjs` | Copy to content, build, deploy, verify, ledger, registry, commit |
| `scripts/line/runner.mjs` | State machine; one advance per wake |
| `scripts/line/fixtures/planted.md` | Gate fixture with three planted faults |
| `scripts/line/test/*.test.mjs` | `node --test` suites |
| `.claude/skills/essay-line/{scan,brief,write-essay,plagiarism,cover,monday}/SKILL.md` | Versioned prompts |
| `distribution/line/config.json` | `calibration_until`, `preempt`, thresholds |
| `distribution/line/themes.md` | Scanner theme list and watch-list |
| `distribution/line/queue.md` | Seed queue + holding pen (from spec §3.3–3.4) |
| `distribution/line/peg-board.md`, `peg-board.json` | Scanner output |
| `distribution/line/ledger.json` | Published essays: slug, date, family, urls |
| `infra/co.signal-to-noise.essay-line.plist` | launchd, 06:30/12:00/19:00/22:00 |
| `_sources/NEVER-LIST.md` | Local-only never-list (owner writes) |
| `_sources/staging-articles/<slug>/` | `state.json, brief.md, OUTLINE.md, draft.md, layerb.md, gate-report.md, final.md` |

`package.json` gains `"test:line": "node --test scripts/line/test/"`.

---

## Phase 1 — Foundations and mail

### Task 1: env, state and test scaffolding

**Files:**
- Create: `scripts/line/env.mjs`, `scripts/line/state.mjs`, `scripts/line/test/state.test.mjs`
- Modify: `package.json` (add `test:line` script)

**Interfaces:**
- Produces: `ENV` (object), `ROOT` (abs path), `log(job, msg)`, `paused()` → boolean, `nowIso()`; `STAGES` array, `loadState(slug)`, `saveState(slug, patch)`, `listEssays()`, `essayDir(slug)`.

- [ ] **Step 1: Write the failing test**

```js
// scripts/line/test/state.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

process.env.LINE_STAGING = fs.mkdtempSync(path.join(os.tmpdir(), 'line-'));
const { loadState, saveState, listEssays, STAGES, essayDir } = await import('../state.mjs');

test('state round-trips and lists essays', () => {
  assert.equal(loadState('x').stage, 'new');
  saveState('x', { stage: 'briefed', brief_sent_at: '2026-09-14T06:00:00Z' });
  assert.equal(loadState('x').stage, 'briefed');
  assert.deepEqual(listEssays().map((e) => e.slug), ['x']);
  assert.ok(fs.existsSync(path.join(essayDir('x'), 'state.json')));
  assert.equal(STAGES[0], 'new');
  assert.equal(STAGES.at(-1), 'published');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/line/test/state.test.mjs`
Expected: FAIL with "Cannot find module '../state.mjs'"

- [ ] **Step 3: Write env.mjs and state.mjs**

```js
// scripts/line/env.mjs
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
export const PAUSE = path.join(ROOT, 'distribution', 'autopilot', 'PAUSE');
export const LOG_FILE = path.join(process.env.HOME ?? ROOT, 'Library', 'Logs', 'signal2noise-essay-line.log');

function loadEnv() {
  const env = {};
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* fall through */ }
  return { ...env, ...process.env };
}
export const ENV = loadEnv();

export const nowIso = () => new Date().toISOString();
export const paused = () => fs.existsSync(PAUSE);

export function log(job, msg) {
  const line = `${nowIso().replace('T', ' ').slice(0, 19)}Z  ${job.padEnd(9)}  ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch { /* logging must never fail the job */ }
}

export function need(key) {
  if (!ENV[key]) throw new Error(`${key} missing from .env`);
  return ENV[key];
}
```

```js
// scripts/line/state.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, nowIso } from './env.mjs';

export const STAGING = process.env.LINE_STAGING ?? path.join(ROOT, '_sources', 'staging-articles');
export const STAGES = ['new', 'briefed', 'approved', 'drafted', 'gated', 'covered', 'final-sent', 'published'];

export const essayDir = (slug) => path.join(STAGING, slug);
const stateFile = (slug) => path.join(essayDir(slug), 'state.json');

export function loadState(slug) {
  try {
    return JSON.parse(fs.readFileSync(stateFile(slug), 'utf8'));
  } catch {
    return { slug, stage: 'new', hold: false, killed: false, cost_usd: 0, history: [] };
  }
}

export function saveState(slug, patch) {
  const cur = loadState(slug);
  const next = { ...cur, ...patch, slug, updated_at: nowIso() };
  if (patch.stage && patch.stage !== cur.stage) next.history = [...(cur.history ?? []), { stage: patch.stage, at: next.updated_at }];
  fs.mkdirSync(essayDir(slug), { recursive: true });
  fs.writeFileSync(stateFile(slug), JSON.stringify(next, null, 2) + '\n');
  return next;
}

export function addCost(slug, usd) {
  const cur = loadState(slug);
  return saveState(slug, { cost_usd: Math.round(((cur.cost_usd ?? 0) + (usd ?? 0)) * 10000) / 10000 });
}

export function listEssays() {
  if (!fs.existsSync(STAGING)) return [];
  return fs.readdirSync(STAGING, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(stateFile(d.name)))
    .map((d) => loadState(d.name));
}
```

- [ ] **Step 4: Add the test script and run**

In `package.json` `"scripts"`, add `"test:line": "node --test scripts/line/test/"`.

Run: `npm run test:line`
Expected: `# pass 1`

- [ ] **Step 5: Commit**

```bash
git add scripts/line/env.mjs scripts/line/state.mjs scripts/line/test/state.test.mjs package.json
git commit -m "Essay line: env, state and test scaffolding"
```

### Task 2: Mail module — send, find reply, parse reply

**Files:**
- Create: `scripts/line/mail.mjs`, `scripts/line/test/mail.test.mjs`, `scripts/line/test/fixtures/reply-ok.eml`

**Interfaces:**
- Consumes: `ENV`, `need`, `log` from `env.mjs`.
- Produces: `sendMail({ subject, text, attachments? }) → { messageId }` (always to `OWNER_EMAIL`, Reply-To alias); `findReply({ messageId, token = null, subjectNeedle = null }) → null | { verdict, text, date, from }` (matches on subject token); `parseReply(rawEml) → { text, headers }`; `classify(text) → 'no'|'hold'|'publish'|'ok'|'text'`.

- [ ] **Step 1: Write the fixture and failing test**

`scripts/line/test/fixtures/reply-ok.eml` (copy of the real reply shape observed 9 Sep):

```
In-Reply-To: <line-abc123-1788961685@signal-to-noise.co>
From: himanshu.kher@gmail.com
Date: Wed, 9 Sep 2026 14:48:31 +0100
Subject: Re: [S2N abc123] test
To: Signal to Noise <essay-line@signal-to-noise.co>
Content-Type: multipart/alternative; boundary="000000000000abcd"

--000000000000abcd
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

  Publish, but change the second heading to =E2=80=9CTwo clocks=E2=80=9D.

On Wed, Sep 9, 2026 at 2:48=E2=80=AFPM Signal to Noise <himanshu@signal-to-=
noise.co> wrote:
> original
--000000000000abcd
Content-Type: text/html; charset="UTF-8"

<div>html</div>
--000000000000abcd--
```

```js
// scripts/line/test/mail.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseReply, classify, buildMime } from '../mail.mjs';

const raw = fs.readFileSync(new URL('./fixtures/reply-ok.eml', import.meta.url), 'utf8');

test('parseReply extracts the plain-text reply above the quote and decodes QP', () => {
  const r = parseReply(raw);
  assert.equal(r.headers['in-reply-to'], '<line-abc123-1788961685@signal-to-noise.co>');
  assert.equal(r.text, 'Publish, but change the second heading to “Two clocks”.');
});

test('classify recognises the keywords and treats anything else as text', () => {
  assert.equal(classify('ok'), 'ok');
  assert.equal(classify(' Publish '), 'publish');
  assert.equal(classify('HOLD'), 'hold');
  assert.equal(classify('no'), 'no');
  assert.equal(classify('Publish, but change the heading'), 'text');
});

test('buildMime sets Reply-To to the alias and embeds an attachment', () => {
  const mime = buildMime({
    from: 'a@x.co', to: 'b@y.com', replyTo: 'essay-line@x.co', subject: 'S', messageId: '<m@x.co>',
    text: 'hello', attachments: [{ name: 'c.webp', type: 'image/webp', data: Buffer.from('xyz') }],
  });
  assert.match(mime, /^Reply-To: essay-line@x\.co$/m);
  assert.match(mime, /Content-Disposition: attachment; filename="c\.webp"/);
  assert.match(mime, /eHl6/); // base64 of xyz
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/line/test/mail.test.mjs`
Expected: FAIL with "Cannot find module '../mail.mjs'"

- [ ] **Step 3: Write mail.mjs**

```js
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
    `From: Signal to Noise <${from}>`, `To: ${to}`, `Reply-To: Signal to Noise <${replyTo}>`,
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
```

- [ ] **Step 4: Run tests**

Run: `node --test scripts/line/test/mail.test.mjs`
Expected: `# pass 3`

- [ ] **Step 5: Live smoke test (one real round trip)**

Run:
```bash
node -e "import('./scripts/line/mail.mjs').then(m => console.log(JSON.stringify(m.sendMail({ subject: 'Mail module smoke test — reply ok', text: 'Reply with: ok' }))))"
```
Expected: `{"messageId":"<line-XXXX-...@signal-to-noise.co>","token":"XXXX"}` and the email arrives in Gmail. Reply "ok" from Gmail, then:
```bash
node -e "import('./scripts/line/mail.mjs').then(m => console.log(m.findReply({ messageId: '<PASTE-MESSAGE-ID>' })))"
```
Expected within a minute: `{ verdict: 'ok', text: 'ok', date: '...', from: 'himanshu.kher@gmail.com' }`

- [ ] **Step 6: Commit**

```bash
git add scripts/line/mail.mjs scripts/line/test/mail.test.mjs scripts/line/test/fixtures/reply-ok.eml
git commit -m "Essay line: mail module (Zoho SMTP/IMAP via curl, alias reply-to, reply parsing)"
```

### Task 3: Headless Claude wrapper

**Files:**
- Create: `scripts/line/claude.mjs`, `scripts/line/test/claude.test.mjs`

**Interfaces:**
- Produces: `runSkill({ skill, input, tools = [], schema = null, maxTurns = 30, model = null }) → { result, json, cost_usd, session_id }`. `skill` is a directory name under `.claude/skills/essay-line/`; its `SKILL.md` becomes the prompt prefix. When `schema` is given, `json` is the parsed structured output.

- [ ] **Step 1: Write the failing test**

```js
// scripts/line/test/claude.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArgs, parseOutput } from '../claude.mjs';

test('buildArgs composes a headless invocation', () => {
  const a = buildArgs({ prompt: 'P', tools: ['WebSearch', 'Read'], schema: { type: 'object' }, maxTurns: 5, model: 'claude-fable-5-1' });
  assert.deepEqual(a.slice(0, 4), ['-p', 'P', '--output-format', 'json']);
  assert.ok(a.includes('--allowedTools') && a.includes('WebSearch,Read'));
  assert.ok(a.includes('--json-schema'));
  assert.ok(a.includes('--max-turns') && a.includes('5'));
  assert.ok(a.includes('--model') && a.includes('claude-fable-5-1'));
});

test('parseOutput reads the trailing result message', () => {
  const out = JSON.stringify([{ type: 'system' }, { type: 'result', result: '{"a":1}', total_cost_usd: 0.12, session_id: 's', is_error: false }]);
  const r = parseOutput(out, true);
  assert.equal(r.cost_usd, 0.12);
  assert.deepEqual(r.json, { a: 1 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/line/test/claude.test.mjs`
Expected: FAIL with "Cannot find module '../claude.mjs'"

- [ ] **Step 3: Write claude.mjs**

```js
// scripts/line/claude.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, log } from './env.mjs';

export const SKILLS = path.join(ROOT, '.claude', 'skills', 'essay-line');

export function buildArgs({ prompt, tools = [], schema = null, maxTurns = 30, model = null }) {
  const a = ['-p', prompt, '--output-format', 'json', '--max-turns', String(maxTurns), '--permission-mode', 'acceptEdits'];
  if (tools.length) a.push('--allowedTools', tools.join(','));
  if (schema) a.push('--json-schema', JSON.stringify(schema));
  if (model) a.push('--model', model);
  return a;
}

export function parseOutput(stdout, wantJson) {
  const arr = JSON.parse(stdout);
  const last = (Array.isArray(arr) ? arr : [arr]).findLast((m) => m.type === 'result');
  if (!last) throw new Error('no result message from claude');
  if (last.is_error) throw new Error(`claude error: ${String(last.result).slice(0, 300)}`);
  let json = null;
  if (wantJson) {
    const raw = typeof last.result === 'string' ? last.result : JSON.stringify(last.result);
    json = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));
  }
  return { result: last.result, json, cost_usd: last.total_cost_usd ?? 0, session_id: last.session_id };
}

export function runSkill({ skill, input, tools = [], schema = null, maxTurns = 30, model = null, cwd = ROOT }) {
  const skillMd = fs.readFileSync(path.join(SKILLS, skill, 'SKILL.md'), 'utf8');
  const prompt = `${skillMd}\n\n---\n\n# Input\n\n${input}`;
  const started = Date.now();
  const r = spawnSync('claude', buildArgs({ prompt, tools, schema, maxTurns, model }), { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`claude ${skill} exited ${r.status}: ${(r.stderr || r.stdout).slice(0, 400)}`);
  const out = parseOutput(r.stdout, Boolean(schema));
  log('claude', `${skill} done in ${Math.round((Date.now() - started) / 1000)}s, $${out.cost_usd.toFixed(3)}`);
  return out;
}
```

- [ ] **Step 4: Run tests**

Run: `node --test scripts/line/test/claude.test.mjs`
Expected: `# pass 2`

- [ ] **Step 5: Commit**

```bash
git add scripts/line/claude.mjs scripts/line/test/claude.test.mjs
git commit -m "Essay line: headless Claude skill runner"
```

---

## Phase 2 — Scanner and peg board

### Task 4: Config, themes, queue and never-list scaffolding

**Files:**
- Create: `distribution/line/config.json`, `distribution/line/themes.md`, `distribution/line/queue.md`, `distribution/line/ledger.json`, `_sources/NEVER-LIST.md` (local only; add `_sources/` is already gitignored), `scripts/line/queue.mjs`, `scripts/line/test/queue.test.mjs`

**Interfaces:**
- Produces: `loadConfig()`, `loadQueue() → [{ title, family, trigger|null, status }]`, `loadNeverList() → string[]`, `neverListHits(text) → string[]`, `loadLedger()`, `appendLedger(entry)`.

- [ ] **Step 1: Write the data files**

`distribution/line/config.json`:
```json
{
  "calibration_until": "2026-10-07",
  "preempt": false,
  "thresholds": { "log": 0, "native_post": 50, "preempt": 70, "fast_piece": 85, "min_fit_to_preempt": 8 },
  "weights": { "corpus_fit": 0.35, "magnitude": 0.25, "velocity": 0.20, "number": 0.20 },
  "brief_hour_local": 7, "veto_hour_local": 19, "final_hour_local": 18, "publish_hour_uk": 8,
  "min_age_hours_substack": 48
}
```

`distribution/line/themes.md`:
```markdown
# Scanner themes

## Families
- metered cognition: AI as a metered input, model pricing, token economics, verification cost, model retirements, vendor dependency, the cognitive supply chain
- Buffett: capital allocation, buybacks, moats, fortress balance sheets, owner earnings
- CFO mandate: budgeting, cost vs growth, finance transformation, alignment, cyber as insurance, talent
- capital allocation: bank returns, TSR, dividends, IPO pricing, valuation of AI companies
- leadership: trade-offs, incentives, culture, constraints

## Watch-list (events)
- hyperscaler earnings (Microsoft, Alphabet, Amazon, Meta) — GPU depreciation schedules, capex
- NVIDIA earnings
- JPMorgan and Citi quarterly results
- IPO filings or pricing: SpaceX, Anthropic, OpenAI, any AI lab
- model retirement or deprecation notices from OpenAI, Anthropic, Google
- Gartner / Conference Board CFO and CEO priority surveys
- large corporate breach disclosures with a stated cost
```

`distribution/line/queue.md` (copy spec §3.4 and §3.3 verbatim as two tables, columns `title | family | trigger | status`, status `queued` or `pen`).

`distribution/line/ledger.json`: `{ "published": [] }`

`_sources/NEVER-LIST.md` (owner completes; ship with):
```markdown
# Never-list — local only, never committed
Axi
```

- [ ] **Step 2: Write the failing test**

```js
// scripts/line/test/queue.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQueue, neverListHits } from '../queue.mjs';

test('parseQueue reads title, family, trigger, status', () => {
  const q = parseQueue(`| title | family | trigger | status |\n|---|---|---|---|\n| A | metered cognition | | queued |\n| B | capital allocation | Bank Q3 results | pen |`);
  assert.deepEqual(q, [
    { title: 'A', family: 'metered cognition', trigger: null, status: 'queued' },
    { title: 'B', family: 'capital allocation', trigger: 'Bank Q3 results', status: 'pen' },
  ]);
});

test('neverListHits is case-insensitive and whole-word', () => {
  assert.deepEqual(neverListHits('We spoke to AXI about taxis.', ['Axi']), ['Axi']);
  assert.deepEqual(neverListHits('Taxis only.', ['Axi']), []);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test scripts/line/test/queue.test.mjs`
Expected: FAIL with "Cannot find module '../queue.mjs'"

- [ ] **Step 4: Write queue.mjs**

```js
// scripts/line/queue.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.mjs';

const LINE = path.join(ROOT, 'distribution', 'line');
export const CONFIG = path.join(LINE, 'config.json');
export const QUEUE = path.join(LINE, 'queue.md');
export const LEDGER = path.join(LINE, 'ledger.json');
export const NEVER = path.join(ROOT, '_sources', 'NEVER-LIST.md');

export const loadConfig = () => JSON.parse(fs.readFileSync(CONFIG, 'utf8'));

export function parseQueue(md) {
  return md.split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*-|title\s*\|/i.test(l)).map((l) => {
    const c = l.split('|').slice(1, -1).map((s) => s.trim());
    return { title: c[0], family: c[1], trigger: c[2] || null, status: c[3] || 'queued' };
  }).filter((r) => r.title);
}
export const loadQueue = () => parseQueue(fs.readFileSync(QUEUE, 'utf8'));

export function loadNeverList() {
  try {
    return fs.readFileSync(NEVER, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  } catch { return ['Axi']; }
}
export function neverListHits(text, list = loadNeverList()) {
  // Lookaround boundaries, not \b: entries like "Acme Inc." end in punctuation and \b would never match.
  return list.filter((w) => {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<!\\w)${esc}(?!\\w)`, 'i').test(text);
  });
}

export const loadLedger = () => { try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch { return { published: [] }; } };
export function appendLedger(entry) {
  const l = loadLedger(); l.published.push(entry);
  fs.writeFileSync(LEDGER, JSON.stringify(l, null, 2) + '\n');
}
export function markQueue(title, status) {
  const md = fs.readFileSync(QUEUE, 'utf8').split('\n').map((l) => {
    if (!l.startsWith('|') || !l.includes(`| ${title} |`)) return l;
    const c = l.split('|'); c[4] = ` ${status} `; return c.join('|');
  }).join('\n');
  fs.writeFileSync(QUEUE, md);
}
```

- [ ] **Step 5: Run tests and commit**

Run: `npm run test:line` — Expected: all pass.

```bash
git add distribution/line scripts/line/queue.mjs scripts/line/test/queue.test.mjs
git commit -m "Essay line: config, themes, seed queue, ledger, never-list loader"
```

### Task 5: Scanner skill and script

**Files:**
- Create: `.claude/skills/essay-line/scan/SKILL.md`, `scripts/line/scan.mjs`, `scripts/line/test/scan.test.mjs`

**Interfaces:**
- Consumes: `runSkill`, `loadConfig`, `loadQueue`, `loadNeverList`, `neverListHits`, `log`.
- Produces: `score(item, weights) → number`, `actionFor(score, fit, cfg) → 'log'|'native_post'|'preempt'|'fast_piece'`, `distribution/line/peg-board.json` `{ date, items: [{ headline, url, source, date, corpus_fit, magnitude, velocity, number, maps_to, note, score, action }] }` and `peg-board.md`.

- [ ] **Step 1: Write the skill**

`.claude/skills/essay-line/scan/SKILL.md`:
```markdown
# Essay line — daily scanner

You scan the last 24 hours of finance and AI news for stories that give a
signal-to-noise.co essay a hook. You are a research assistant, not a writer.

Rules
- Use WebSearch to find candidate stories, WebFetch to open each source you
  score. Score only stories you opened. Never invent a headline or a figure.
- Score each story 0–10 on four dimensions, using the rubric exactly:
  corpus_fit (does it instantiate a named idea or published essay? 10 = yes,
  directly; 5 = touches a family; 0 = generic), magnitude (10 = FT/WSJ front
  page or mega-cap earnings; 5 = one major outlet; 0 = trade press),
  velocity (10 = breaking, 2–3 day window; 5 = a week; 0 = slow structural),
  number (10 = a dollar amount, valuation, ratio or dated deadline; 5 = a
  percentage or survey figure; 0 = opinion only).
- `maps_to` is the exact title from the queue, the holding pen, or a
  published essay, or "" if none. If the story maps to nothing but scores
  ≥ 7 on magnitude and number, propose a working title in `proposed_title`.
- Drop any story mentioning a name on the never-list.
- British English in every field.
- Return only the JSON described by the schema. Eight items at most.
```

- [ ] **Step 2: Write the failing test**

```js
// scripts/line/test/scan.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { score, actionFor, renderBoard } from '../scan.mjs';

const cfg = { thresholds: { native_post: 50, preempt: 70, fast_piece: 85, min_fit_to_preempt: 8 }, weights: { corpus_fit: 0.35, magnitude: 0.25, velocity: 0.20, number: 0.20 } };

test('score is the weighted sum scaled to 100', () => {
  assert.equal(score({ corpus_fit: 10, magnitude: 10, velocity: 10, number: 10 }, cfg.weights), 100);
  assert.equal(score({ corpus_fit: 10, magnitude: 5, velocity: 0, number: 10 }, cfg.weights), 67.5);
});

test('actionFor applies thresholds and the fit rule', () => {
  assert.equal(actionFor(40, 10, cfg), 'log');
  assert.equal(actionFor(60, 10, cfg), 'native_post');
  assert.equal(actionFor(75, 8, cfg), 'preempt');
  assert.equal(actionFor(75, 6, cfg), 'native_post');
  assert.equal(actionFor(90, 9, cfg), 'fast_piece');
});

test('renderBoard produces a markdown table sorted by score', () => {
  const md = renderBoard({ date: '2026-09-10', items: [{ headline: 'B', score: 40, action: 'log', maps_to: '', url: 'u' }, { headline: 'A', score: 80, action: 'preempt', maps_to: 'X', url: 'v' }] });
  assert.ok(md.indexOf('| A |') < md.indexOf('| B |'));
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test scripts/line/test/scan.test.mjs` — Expected: FAIL, module not found.

- [ ] **Step 4: Write scan.mjs**

```js
// scripts/line/scan.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, log, paused } from './env.mjs';
import { runSkill } from './claude.mjs';
import { loadConfig, loadQueue, loadNeverList, neverListHits, loadLedger } from './queue.mjs';

const LINE = path.join(ROOT, 'distribution', 'line');
export const BOARD_JSON = path.join(LINE, 'peg-board.json');
export const BOARD_MD = path.join(LINE, 'peg-board.md');

const SCHEMA = {
  type: 'object', required: ['items'],
  properties: { items: { type: 'array', maxItems: 8, items: {
    type: 'object', required: ['headline', 'url', 'source', 'date', 'corpus_fit', 'magnitude', 'velocity', 'number', 'maps_to', 'note'],
    properties: {
      headline: { type: 'string' }, url: { type: 'string' }, source: { type: 'string' }, date: { type: 'string' },
      corpus_fit: { type: 'integer', minimum: 0, maximum: 10 }, magnitude: { type: 'integer', minimum: 0, maximum: 10 },
      velocity: { type: 'integer', minimum: 0, maximum: 10 }, number: { type: 'integer', minimum: 0, maximum: 10 },
      maps_to: { type: 'string' }, proposed_title: { type: 'string' }, note: { type: 'string' },
    } } } },
};

export const score = (it, w) => Math.round((it.corpus_fit * w.corpus_fit + it.magnitude * w.magnitude + it.velocity * w.velocity + it.number * w.number) * 100) / 10;

export function actionFor(s, fit, cfg) {
  const t = cfg.thresholds;
  if (s >= t.fast_piece && fit >= t.min_fit_to_preempt) return 'fast_piece';
  if (s >= t.preempt && fit >= t.min_fit_to_preempt) return 'preempt';
  if (s >= t.native_post) return 'native_post';
  return 'log';
}

export function renderBoard(board) {
  const rows = [...board.items].sort((a, b) => b.score - a.score)
    .map((i) => `| ${i.headline} | ${i.score} | ${i.action} | ${i.maps_to || i.proposed_title || ''} | [source](${i.url}) |`);
  return `# Peg board — ${board.date}\n\n| Story | Score | Action | Maps to | Link |\n|---|---|---|---|---|\n${rows.join('\n')}\n`;
}

export async function scan({ dry = false } = {}) {
  if (paused()) { log('scan', 'PAUSE present'); return null; }
  const cfg = loadConfig();
  const queue = loadQueue();
  const published = fs.readdirSync(path.join(ROOT, 'src', 'content', 'insights')).map((f) => f.replace(/\.md$/, ''));
  const never = loadNeverList();
  const input = [
    `Today: ${new Date().toISOString().slice(0, 10)}`,
    `Themes:\n${fs.readFileSync(path.join(LINE, 'themes.md'), 'utf8')}`,
    `Queue and holding pen:\n${queue.map((q) => `- ${q.title} [${q.family}]${q.trigger ? ` trigger: ${q.trigger}` : ''}`).join('\n')}`,
    `Published essay slugs:\n${published.join(', ')}`,
    `Never-list:\n${never.join(', ')}`,
  ].join('\n\n');
  const out = runSkill({ skill: 'scan', input, tools: ['WebSearch', 'WebFetch'], schema: SCHEMA, maxTurns: 40 });
  const items = out.json.items
    .filter((i) => neverListHits(`${i.headline} ${i.note}`, never).length === 0)
    .map((i) => ({ ...i, score: score(i, cfg.weights) }))
    .map((i) => ({ ...i, action: actionFor(i.score, i.corpus_fit, cfg) }));
  const board = { date: new Date().toISOString().slice(0, 10), cost_usd: out.cost_usd, items };
  if (!dry) {
    fs.writeFileSync(BOARD_JSON, JSON.stringify(board, null, 2) + '\n');
    fs.writeFileSync(BOARD_MD, renderBoard(board));
  }
  log('scan', `${items.length} items, top ${items[0]?.score ?? 0}, $${out.cost_usd.toFixed(3)}`);
  return board;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const board = await scan({ dry: process.argv.includes('--dry') });
  if (board) console.log(renderBoard(board));
}
```

- [ ] **Step 5: Run unit tests, then one live scan**

Run: `node --test scripts/line/test/scan.test.mjs` — Expected: `# pass 3`.
Run: `node scripts/line/scan.mjs` — Expected: a markdown table of up to eight scored stories printed, `distribution/line/peg-board.md` written, log line with cost. Read the board and sanity-check two scores by hand.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/essay-line/scan scripts/line/scan.mjs scripts/line/test/scan.test.mjs distribution/line/peg-board.md distribution/line/peg-board.json
git commit -m "Essay line: daily scanner and peg board (score-only)"
```

---

## Phase 3 — The gate

### Task 6: Layer B via Codex

**Files:**
- Create: `scripts/line/layerb.mjs`, `scripts/line/test/layerb.test.mjs`, `scripts/line/md.mjs` (frontmatter helpers), `scripts/line/test/md.test.mjs`

**Interfaces:**
- Produces (md.mjs): `splitFrontmatter(md) → { meta: {k: v}, body, raw: [line] }` (preserve-unknown: nested blocks and unknown lines live only in `raw`), `joinFrontmatter(meta, body, raw)`; `SHIPPING_FIELDS = ['title','excerpt','seoDescription','coverImageAlt']`.
- Produces (layerb.mjs): `layerBText(text, { kind }) → string` (Codex rewrite), `layerBEssay(inPath, outPath) → { changed: number }`, `codexArgs()`.

- [ ] **Step 1: Write failing tests**

```js
// scripts/line/test/md.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { splitFrontmatter, joinFrontmatter } from '../md.mjs';

test('frontmatter round-trips including quoted values and arrays', () => {
  const src = `---\ntitle: "A: b"\ndate: 2026-09-16\ntags: ["cfo", "ai"]\ndraft: false\n---\n\nBody **x**.\n`;
  const { meta, body, order } = splitFrontmatter(src);
  assert.equal(meta.title, 'A: b');
  assert.deepEqual(meta.tags, ['cfo', 'ai']);
  assert.equal(body, 'Body **x**.');
  assert.equal(joinFrontmatter(meta, body, order), src);
});
```

```js
// scripts/line/test/layerb.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { codexArgs, buildPrompt } from '../layerb.mjs';

test('codexArgs runs read-only, non-interactive, writing the last message to a file', () => {
  const a = codexArgs('/tmp/out.md');
  assert.ok(a.includes('exec') && a.includes('--sandbox') && a.includes('read-only'));
  assert.ok(a.includes('-o') && a.includes('/tmp/out.md'));
});

test('buildPrompt forbids meaning changes and demands British English', () => {
  const p = buildPrompt('body');
  assert.match(p, /British English/);
  assert.match(p, /do not change (the )?meaning/i);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/line/test/md.test.mjs scripts/line/test/layerb.test.mjs` — Expected: FAIL, modules not found.

- [ ] **Step 3: Write md.mjs and layerb.mjs**

```js
// scripts/line/md.mjs
export const SHIPPING_FIELDS = ['title', 'excerpt', 'seoDescription', 'coverImageAlt'];

export function splitFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: md.trim(), order: [] };
  const meta = {}, order = [];
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('[')) v = JSON.parse(v);
    else if (v === 'true' || v === 'false') v = v === 'true';
    else v = v.replace(/^"(.*)"$/, '$1');
    meta[kv[1]] = v; order.push(kv[1]);
  }
  return { meta, body: m[2].replace(/\n$/, ''), order };
}

export function joinFrontmatter(meta, body, order = Object.keys(meta)) {
  const fm = order.filter((k) => k in meta).map((k) => {
    const v = meta[k];
    if (Array.isArray(v)) return `${k}: ${JSON.stringify(v)}`;
    if (typeof v === 'boolean' || /^\d{4}-\d{2}-\d{2}$/.test(String(v)) || k.startsWith('cover') && k !== 'coverImageAlt') return `${k}: ${v}`;
    return `${k}: "${String(v).replace(/"/g, '\\"')}"`;
  });
  return `---\n${fm.join('\n')}\n---\n\n${body}\n`;
}
```

```js
// scripts/line/layerb.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { log } from './env.mjs';
import { splitFrontmatter, joinFrontmatter, SHIPPING_FIELDS } from './md.mjs';

export const codexArgs = (outFile) => ['exec', '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral', '-o', outFile];

export function buildPrompt(text, kind = 'body') {
  return [
    `Rewrite the ${kind === 'body' ? 'markdown essay' : 'string'} below so that its statistical fingerprint changes while its meaning, structure, facts, figures, quotations, links and citations stay exactly the same.`,
    'Rules: British English spelling and idiom throughout; keep every heading, list, link URL, blockquote and number verbatim; do not change meaning, do not add or remove claims, do not shorten or lengthen by more than 10%; vary sentence openings, clause order and word choice; keep the author\'s voice (plain, direct, CFO-to-CFO); no preamble and no commentary, output only the rewritten text.',
    '', '<<<', text, '>>>',
  ].join('\n');
}

export function layerBText(text, { kind = 'body' } = {}) {
  const out = path.join(os.tmpdir(), `layerb-${Date.now()}.md`);
  const r = spawnSync('codex', codexArgs(out), { input: buildPrompt(text, kind), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0 || !fs.existsSync(out)) throw new Error(`codex failed (${r.status}): ${(r.stderr || r.stdout).slice(0, 300)}`);
  const result = fs.readFileSync(out, 'utf8').replace(/^<<<\n?|\n?>>>$/g, '').trim();
  fs.unlinkSync(out);
  if (!result || result.length < text.length * 0.6) throw new Error('codex output implausibly short');
  return result;
}

export function layerBEssay(inPath, outPath) {
  const { meta, body, order } = splitFrontmatter(fs.readFileSync(inPath, 'utf8'));
  const newBody = layerBText(body, { kind: 'body' });
  let changed = newBody !== body ? 1 : 0;
  for (const k of SHIPPING_FIELDS) {
    if (typeof meta[k] === 'string' && meta[k].length > 0) {
      const v = layerBText(meta[k], { kind: `frontmatter ${k}` }).replace(/\s+/g, ' ');
      if (v !== meta[k]) { meta[k] = v; changed++; }
    }
  }
  fs.writeFileSync(outPath, joinFrontmatter(meta, newBody, order));
  log('layerb', `${path.basename(inPath)} → ${path.basename(outPath)}, ${changed} strings changed`);
  return { changed };
}
```

- [ ] **Step 4: Run unit tests, then one live rewrite**

Run: `node --test scripts/line/test/md.test.mjs scripts/line/test/layerb.test.mjs` — Expected: `# pass 3`.
Run: `node -e "import('./scripts/line/layerb.mjs').then(m => console.log(m.layerBText('The CFO is the same; so is the Monday. At ten, she must unveil the cost programme.', { kind: 'body' })))"`
Expected: a rewritten sentence, same meaning, British spelling, no preamble.

- [ ] **Step 5: Commit**

```bash
git add scripts/line/md.mjs scripts/line/layerb.mjs scripts/line/test/md.test.mjs scripts/line/test/layerb.test.mjs
git commit -m "Essay line: Layer B rewrite via codex exec, frontmatter helpers"
```

### Task 7: British English scan

**Files:**
- Create: `scripts/line/bre.mjs`, `scripts/line/test/bre.test.mjs`

**Interfaces:**
- Produces: `scanBrE(text) → [{ word, line, fix|null }]`, `applySpellingFixes(text) → { text, fixed: [string] }`, `AMERICAN` map.

- [ ] **Step 1: Write the failing test**

```js
// scripts/line/test/bre.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { scanBrE, applySpellingFixes } from '../bre.mjs';

test('scanBrE flags American forms with line numbers and suggests fixes', () => {
  const f = scanBrE('Line one.\nThe behavior of the program is gray.\nWe optimize and analyze.');
  assert.deepEqual(f.map((x) => [x.word, x.line, x.fix]), [
    ['behavior', 2, 'behaviour'], ['program', 2, 'programme'], ['gray', 2, 'grey'], ['optimize', 3, 'optimise'], ['analyze', 3, 'analyse'],
  ]);
});

test('scanBrE ignores allowlisted words and code/URLs', () => {
  assert.deepEqual(scanBrE('We learned the terms at https://x.com/color?theme=center and used `color: red`.'), []);
});

test('applySpellingFixes replaces only whole words, preserving case', () => {
  const r = applySpellingFixes('Behavior matters; behavior always did.');
  assert.equal(r.text, 'Behaviour matters; behaviour always did.');
  assert.deepEqual(r.fixed, ['Behavior', 'behavior']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/line/test/bre.test.mjs` — Expected: FAIL, module not found.

- [ ] **Step 3: Write bre.mjs**

```js
// scripts/line/bre.mjs
export const AMERICAN = {
  behavior: 'behaviour', behaviors: 'behaviours', color: 'colour', colors: 'colours', favor: 'favour', favorite: 'favourite',
  honor: 'honour', labor: 'labour', neighbor: 'neighbour', rumor: 'rumour', humor: 'humour', harbor: 'harbour',
  center: 'centre', centers: 'centres', meter: 'metre', meters: 'metres', theater: 'theatre', fiber: 'fibre', liter: 'litre',
  defense: 'defence', offense: 'offence', pretense: 'pretence', license: 'licence',
  analyze: 'analyse', analyzed: 'analysed', analyzing: 'analysing', paralyze: 'paralyse', catalyze: 'catalyse',
  optimize: 'optimise', optimized: 'optimised', optimizing: 'optimising', optimization: 'optimisation',
  organize: 'organise', organized: 'organised', organization: 'organisation', organizations: 'organisations',
  realize: 'realise', realized: 'realised', recognize: 'recognise', recognized: 'recognised', prioritize: 'prioritise',
  capitalize: 'capitalise', capitalized: 'capitalised', monetize: 'monetise', monetized: 'monetised', minimize: 'minimise',
  maximize: 'maximise', standardize: 'standardise', summarize: 'summarise', emphasize: 'emphasise', criticize: 'criticise',
  program: 'programme', programs: 'programmes', catalog: 'catalogue', dialog: 'dialogue', gray: 'grey', mold: 'mould',
  traveled: 'travelled', traveling: 'travelling', canceled: 'cancelled', modeling: 'modelling', modeled: 'modelled',
  labeled: 'labelled', fulfill: 'fulfil', enroll: 'enrol', skillful: 'skilful', artifact: 'artefact', artifacts: 'artefacts',
  aluminum: 'aluminium', jewelry: 'jewellery', pajamas: 'pyjamas',
};
// House style: "learned" (not "learnt") is correct and is deliberately absent from the map.

function stripCodeAndUrls(line) {
  return line.replace(/`[^`]*`/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/\]\([^)]*\)/g, ']');
}

export function scanBrE(text) {
  const flags = [];
  text.split('\n').forEach((raw, i) => {
    const line = stripCodeAndUrls(raw);
    for (const m of line.matchAll(/[A-Za-z]+/g)) {
      const w = m[0], lw = w.toLowerCase();
      if (lw in AMERICAN && !(lw === 'license' && /license (to|the|a|it)/i.test(line))) {
        if (lw === 'program' && /\b(software|computer) program/i.test(line)) continue;
        flags.push({ word: w, line: i + 1, fix: AMERICAN[lw] });
      }
    }
  });
  return flags;
}

export function applySpellingFixes(text) {
  const fixed = [];
  const out = text.split('\n').map((raw) => {
    const protectedLine = stripCodeAndUrls(raw);
    if (protectedLine !== raw && /`|https?:/.test(raw)) return raw; // leave lines with code/urls untouched
    return raw.replace(/[A-Za-z]+/g, (w) => {
      const fix = AMERICAN[w.toLowerCase()];
      if (!fix) return w;
      fixed.push(w);
      return w[0] === w[0].toUpperCase() ? fix[0].toUpperCase() + fix.slice(1) : fix;
    });
  }).join('\n');
  return { text: out, fixed };
}
```

- [ ] **Step 4: Run tests**

Run: `node --test scripts/line/test/bre.test.mjs` — Expected: `# pass 3`. Adjust the ALLOW/`license` heuristics only if the second test fails on the URL case.

- [ ] **Step 5: Commit**

```bash
git add scripts/line/bre.mjs scripts/line/test/bre.test.mjs
git commit -m "Essay line: British English scan with spelling fixes"
```

### Task 8: Layer A via the watermarks service

**Files:**
- Create: `scripts/line/layera.mjs`, `scripts/line/test/layera.test.mjs`

**Interfaces:**
- Produces: `inspectFile(path) → { suspicious: boolean, report }`, `cleanFile(path) → { changed: boolean, report }` (rewrites in place), `serviceUp() → boolean`.

- [ ] **Step 1: Write the failing test**

```js
// scripts/line/test/layera.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectFile, cleanFile, serviceUp } from '../layera.mjs';

const tmp = path.join(os.tmpdir(), `layera-${Date.now()}.md`);
fs.writeFileSync(tmp, 'Clean text​ with a zero-width space.\n');

test('inspect flags the planted zero-width space and clean removes it', { skip: !serviceUp() && 'watermarks service not running' }, () => {
  assert.equal(inspectFile(tmp).suspicious, true);
  const c = cleanFile(tmp);
  assert.equal(c.changed, true);
  assert.equal(fs.readFileSync(tmp, 'utf8').includes('​'), false);
  assert.equal(inspectFile(tmp).suspicious, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/line/test/layera.test.mjs` — Expected: FAIL, module not found.

- [ ] **Step 3: Write layera.mjs**

```js
// scripts/line/layera.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ENV, log } from './env.mjs';

const WM = ENV.WATERMARKS_SERVICE_URL ?? 'http://127.0.0.1:8765';

function post(route, payload) {
  const r = spawnSync('curl', ['-s', '-m', '60', '-X', 'POST', `${WM}${route}`, '-H', 'Content-Type: application/json', '--data-binary', '@-'], { input: JSON.stringify(payload), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`watermarks service unreachable at ${WM}`);
  const j = JSON.parse(r.stdout);
  if (j.ok === false) throw new Error(`watermarks ${route}: ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}

export function serviceUp() {
  const r = spawnSync('curl', ['-s', '-m', '5', '-o', '/dev/null', '-w', '%{http_code}', `${WM}/inspect`], { encoding: 'utf8' });
  return r.status === 0 && /^(200|404|405)$/.test(r.stdout.trim());
}

export function inspectFile(file) {
  const j = post('/inspect', { file: fs.readFileSync(file).toString('base64'), name: path.basename(file) });
  return { suspicious: Boolean(j.suspicious), report: j.report ?? null, kind: j.kind };
}

export function cleanFile(file) {
  const before = fs.readFileSync(file);
  const j = post('/clean', { file: before.toString('base64'), name: path.basename(file), options: { nfkc: false } });
  const after = Buffer.from(j.cleaned, 'base64');
  const changed = !before.equals(after);
  if (changed) fs.writeFileSync(file, after);
  log('layera', `${path.basename(file)} ${changed ? 'cleaned' : 'already clean'}`);
  return { changed, report: j.report ?? null };
}
```

- [ ] **Step 4: Run test**

Run: `node --test scripts/line/test/layera.test.mjs` — Expected: `# pass 1` (service is up on :8765; if skipped, start it with `make serve` in `~/Documents/devProjects/watermarks-remover`).

- [ ] **Step 5: Commit**

```bash
git add scripts/line/layera.mjs scripts/line/test/layera.test.mjs
git commit -m "Essay line: Layer A inspect/clean via the watermarks service"
```

### Task 9: Plagiarism and provenance check

**Files:**
- Create: `.claude/skills/essay-line/plagiarism/SKILL.md`, `scripts/line/plagiarism.mjs`, `scripts/line/test/plagiarism.test.mjs`

**Interfaces:**
- Consumes: `runSkill`, `splitFrontmatter`.
- Produces: `pickSentences(body, n = 8) → string[]` (longest, most distinctive), `extractQuotes(body) → [{ quote, url|null }]`, `checkPlagiarism(mdPath) → { verdict: 'pass'|'fail', sentences: [{ text, hit: boolean, url }], citations: [{ quote, url, verified: boolean, note }], cost_usd }`.

- [ ] **Step 1: Write the skill**

`.claude/skills/essay-line/plagiarism/SKILL.md`:
```markdown
# Essay line — plagiarism and provenance check

You verify that an essay is original and that its quotations are real.

For each sentence in `sentences`: run WebSearch with the sentence as an exact
quoted string. `hit` is true only if a result reproduces the sentence
verbatim (ignoring quotation marks and trailing punctuation). Record the URL.

For each item in `citations`: open `url` with WebFetch (if `url` is null,
search for the quote and open the best source). `verified` is true only if
the quoted words appear verbatim at that source. Note the originator of any
borrowed term in `note` if the essay does not credit it.

Never guess. If a source cannot be opened, `verified` is false and `note`
says why. Return only the JSON described by the schema.
```

- [ ] **Step 2: Write the failing test**

```js
// scripts/line/test/plagiarism.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickSentences, extractQuotes, verdictFrom } from '../plagiarism.mjs';

test('pickSentences returns the n longest prose sentences without links or headings', () => {
  const body = '## H\n\nShort. This is a considerably longer sentence with distinctive wording about budgets. Another long sentence that mentions [a link](http://x) inside it.\n\n> quoted line\n';
  const s = pickSentences(body, 2);
  assert.equal(s.length, 2);
  assert.ok(s.every((x) => !x.includes('](') && !x.startsWith('#')));
});

test('extractQuotes finds blockquotes and inline quotes with their nearest link', () => {
  const q = extractQuotes('He said "cash is king" ([source](https://a.b/c)).\n\n> Price is what you pay\n>\n> — Buffett, [2008 letter](https://berkshire/2008)');
  assert.deepEqual(q, [{ quote: 'cash is king', url: 'https://a.b/c' }, { quote: 'Price is what you pay', url: 'https://berkshire/2008' }]);
});

test('verdictFrom fails on any hit or unverified citation', () => {
  assert.equal(verdictFrom({ sentences: [{ hit: false }], citations: [{ verified: true }] }), 'pass');
  assert.equal(verdictFrom({ sentences: [{ hit: true }], citations: [] }), 'fail');
  assert.equal(verdictFrom({ sentences: [], citations: [{ verified: false }] }), 'fail');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test scripts/line/test/plagiarism.test.mjs` — Expected: FAIL, module not found.

- [ ] **Step 4: Write plagiarism.mjs**

```js
// scripts/line/plagiarism.mjs
import fs from 'node:fs';
import { runSkill } from './claude.mjs';
import { splitFrontmatter } from './md.mjs';

const SCHEMA = {
  type: 'object', required: ['sentences', 'citations'],
  properties: {
    sentences: { type: 'array', items: { type: 'object', required: ['text', 'hit', 'url'], properties: { text: { type: 'string' }, hit: { type: 'boolean' }, url: { type: 'string' } } } },
    citations: { type: 'array', items: { type: 'object', required: ['quote', 'url', 'verified', 'note'], properties: { quote: { type: 'string' }, url: { type: 'string' }, verified: { type: 'boolean' }, note: { type: 'string' } } } },
  },
};

export function pickSentences(body, n = 8) {
  const prose = body.split('\n').filter((l) => l.trim() && !/^(#|>|-|\d+\.|!\[|\|)/.test(l.trim())).join(' ');
  return prose.replace(/\*\*?|_/g, '').split(/(?<=[.!?])\s+/)
    .map((s) => s.trim()).filter((s) => s.length >= 60 && !s.includes(']('))
    .sort((a, b) => b.length - a.length).slice(0, n);
}

export function extractQuotes(body) {
  const out = [];
  for (const m of body.matchAll(/"([^"]{12,})"(?:\s*\(\[[^\]]*\]\((https?:[^)]+)\))?/g)) out.push({ quote: m[1], url: m[2] ?? null });
  for (const m of body.matchAll(/^> ([^\n>][^\n]+)\n(?:>\s*\n)?(?:> — [^\n]*?\[[^\]]*\]\((https?:[^)]+)\))?/gm)) out.push({ quote: m[1].trim(), url: m[2] ?? null });
  return out;
}

export const verdictFrom = (r) => (r.sentences.some((s) => s.hit) || r.citations.some((c) => !c.verified)) ? 'fail' : 'pass';

export function checkPlagiarism(mdPath) {
  const { body } = splitFrontmatter(fs.readFileSync(mdPath, 'utf8'));
  const sentences = pickSentences(body), citations = extractQuotes(body);
  const out = runSkill({ skill: 'plagiarism', input: JSON.stringify({ sentences, citations }, null, 2), tools: ['WebSearch', 'WebFetch'], schema: SCHEMA, maxTurns: 60 });
  return { verdict: verdictFrom(out.json), ...out.json, cost_usd: out.cost_usd };
}
```

- [ ] **Step 5: Run tests and commit**

Run: `node --test scripts/line/test/plagiarism.test.mjs` — Expected: `# pass 3`.

```bash
git add .claude/skills/essay-line/plagiarism scripts/line/plagiarism.mjs scripts/line/test/plagiarism.test.mjs
git commit -m "Essay line: plagiarism and provenance check via headless Claude"
```

### Task 10: Gate orchestrator with planted fixture

**Files:**
- Create: `scripts/line/gate.mjs`, `scripts/line/fixtures/planted.md`, `scripts/line/test/gate.test.mjs`

**Interfaces:**
- Consumes: `layerBEssay`, `checkPlagiarism`, `scanBrE`, `applySpellingFixes`, `inspectFile`, `cleanFile`, `splitFrontmatter`.
- Produces: `runGate({ inPath, outPath, reportPath, skipLayerB = false }) → { verdict: 'pass'|'fail', report: string, checks }`; CLI `node scripts/line/gate.mjs <in.md> <out.md> [--report r.md] [--skip-layerb]`, exit 0 pass / 1 fail.

- [ ] **Step 1: Write the fixture**

`scripts/line/fixtures/planted.md`:
```markdown
---
title: "A planted fixture"
date: 2026-01-01
excerpt: "The behavior of this fixture is deliberately wrong."
seoDescription: "Fixture."
tags: ["test"]
draft: true
---

It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief.

This second sentence carries a zero-width space right here​ and nothing else of note, which is enough for the scan to have something to find.

Finance teams that analyze variance every month rarely optimize the thing that produced it.
```
(The second paragraph contains U+200B after "here". Insert it with `printf` if the editor strips it: `python3 -c "p='scripts/line/fixtures/planted.md';s=open(p).read().replace('right here ','right here​ ');open(p,'w').write(s)"`.)

- [ ] **Step 2: Write the failing test**

```js
// scripts/line/test/gate.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runGate } from '../gate.mjs';
import { serviceUp } from '../layera.mjs';

test('gate catches the three planted faults on the fixture', { skip: !serviceUp() && 'watermarks service not running', timeout: 600000 }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
  const out = path.join(dir, 'out.md'), rep = path.join(dir, 'report.md');
  const r = runGate({ inPath: new URL('../fixtures/planted.md', import.meta.url).pathname, outPath: out, reportPath: rep, skipLayerB: true });
  assert.equal(r.verdict, 'fail');
  assert.equal(r.checks.plagiarism.verdict, 'fail');            // Dickens sentence found verbatim
  assert.ok(r.checks.bre.flags.length >= 3);                      // behavior, analyze, optimize
  assert.equal(r.checks.layera.before.suspicious, true);          // zero-width space seen
  assert.equal(r.checks.layera.after.suspicious, false);          // and removed
  assert.ok(fs.readFileSync(rep, 'utf8').includes('## Verdict: FAIL'));
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test scripts/line/test/gate.test.mjs` — Expected: FAIL, module not found.

- [ ] **Step 4: Write gate.mjs**

```js
// scripts/line/gate.mjs
import fs from 'node:fs';
import path from 'node:path';
import { log } from './env.mjs';
import { layerBEssay, layerBText } from './layerb.mjs';
import { checkPlagiarism } from './plagiarism.mjs';
import { scanBrE, applySpellingFixes, scanAmbiguous } from './bre.mjs';
import { inspectFile, cleanFile } from './layera.mjs';
import { splitFrontmatter, joinFrontmatter, SHIPPING_FIELDS } from './md.mjs';

export function runGate({ inPath, outPath, reportPath, skipLayerB = false }) {
  const checks = {};
  // 1. Layer B
  if (skipLayerB) fs.copyFileSync(inPath, outPath); else checks.layerb = layerBEssay(inPath, outPath);
  // 2. Plagiarism + provenance (on the text that ships)
  checks.plagiarism = checkPlagiarism(outPath);
  // 3. British English: scan, fix spellings, re-scan; any non-spelling fix re-enters Layer B for that string
  let md = fs.readFileSync(outPath, 'utf8');
  const flagsBefore = scanBrE(md);
  const fixed = applySpellingFixes(md);
  md = fixed.text;
  const { meta, body, raw } = splitFrontmatter(md);
  for (const k of SHIPPING_FIELDS) if (typeof meta[k] === 'string') meta[k] = applySpellingFixes(meta[k]).text;
  md = joinFrontmatter(meta, body, raw);
  fs.writeFileSync(outPath, md);
  const flagsAfter = scanBrE(md);
  checks.bre = { flags: flagsBefore, fixed: fixed.fixed, remaining: flagsAfter, warnings: scanAmbiguous(md) };
  // 4. Layer A last
  const before = inspectFile(outPath);
  if (before.suspicious) cleanFile(outPath);
  const after = inspectFile(outPath);
  checks.layera = { before, after };

  const fails = [];
  if (checks.plagiarism.verdict === 'fail') fails.push('plagiarism/provenance');
  if (checks.bre.remaining.length) fails.push('British English (unresolved)');
  if (checks.layera.after.suspicious) fails.push('Layer A (still suspicious after clean)');
  const verdict = fails.length ? 'fail' : 'pass';
  const report = renderReport({ inPath, outPath, checks, verdict, fails });
  if (reportPath) fs.writeFileSync(reportPath, report);
  log('gate', `${path.basename(inPath)} → ${verdict.toUpperCase()}${fails.length ? ': ' + fails.join('; ') : ''}`);
  return { verdict, report, checks };
}

function renderReport({ inPath, outPath, checks, verdict, fails }) {
  const L = [`# Gate report — ${path.basename(inPath)}`, '', `## Verdict: ${verdict.toUpperCase()}`, fails.length ? `Failing: ${fails.join('; ')}` : 'All four checks clean.', ''];
  L.push('## 1. Layer B (Codex rewrite)', checks.layerb ? `${checks.layerb.changed} strings rewritten → ${path.basename(outPath)}` : 'skipped (fixture / corrections-only run)', '');
  L.push('## 2. Plagiarism and provenance', `Verdict: ${checks.plagiarism.verdict}`, ...checks.plagiarism.sentences.map((s) => `- ${s.hit ? '❌ HIT' : '✅ clean'} — "${s.text.slice(0, 90)}…"${s.hit ? ` (${s.url})` : ''}`),
    ...checks.plagiarism.citations.map((c) => `- ${c.verified ? '✅' : '❌'} quote "${c.quote.slice(0, 60)}…" — ${c.url || 'no url'}${c.note ? ` — ${c.note}` : ''}`), '');
  L.push('## 3. British English', `Flagged ${checks.bre.flags.length}, fixed ${checks.bre.fixed.length}, unresolved ${checks.bre.remaining.length}`,
    ...checks.bre.flags.map((f) => `- line ${f.line}: ${f.word} → ${f.fix}`),
    ...(checks.bre.warnings.length ? ['Ambiguous (not auto-fixed, check by eye):', ...checks.bre.warnings.map((w) => `- line ${w.line}: ${w.word} — ${w.note}`)] : []), '');
  L.push('## 4. Layer A (invisible Unicode)', `Before: ${checks.layera.before.suspicious ? 'SUSPICIOUS' : 'clean'} · After: ${checks.layera.after.suspicious ? 'SUSPICIOUS' : 'clean'}`, '');
  return L.join('\n');
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const [inPath, outPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const ri = process.argv.indexOf('--report');
  const r = runGate({ inPath, outPath, reportPath: ri > 0 ? process.argv[ri + 1] : null, skipLayerB: process.argv.includes('--skip-layerb') });
  console.log(r.report);
  process.exit(r.verdict === 'pass' ? 0 : 1);
}
```

- [ ] **Step 5: Run the fixture test, then the gate on a real essay**

Run: `node --test scripts/line/test/gate.test.mjs` — Expected: `# pass 1` (takes a few minutes: live web searches).
Run: `node scripts/line/gate.mjs _sources/staging-articles/two-banks-one-start-line.md /tmp/two-banks-gated.md --report /tmp/two-banks-gate.md; echo exit=$?`
Expected: `## Verdict: PASS` and `exit=0` (if a citation fails verification, read the report; that is a real finding on the essay, fix the essay, not the gate).

- [ ] **Step 6: Commit**

```bash
git add scripts/line/gate.mjs scripts/line/fixtures/planted.md scripts/line/test/gate.test.mjs
git commit -m "Essay line: gate orchestrator (Layer B → plagiarism → BrE → Layer A) with planted fixture"
```

---

## Phase 4 — Cover

### Task 11: Cover skill and stage

**Files:**
- Create: `.claude/skills/essay-line/cover/SKILL.md`, `scripts/line/cover.mjs`, `scripts/line/test/cover.test.mjs`
- Modify: `src/covers/_lib.ts:36-46` (add optional `motionPx?: number` to `Cover`)

**Interfaces:**
- Consumes: `runSkill`, `render-cover.mjs`, `make-og-images.mjs`.
- Produces: `nextFig() → string` ("51"…), `makeCover({ slug, finalPath }) → { fig, caption, alt, motionPx, webp, cost_usd }`, `checkMotion(slug) → number` (declared px at 2400 wide; must be ≥ 60 ⇒ ≥ 17 px at 700 wide).

- [ ] **Step 1: Add `motionPx` to the Cover interface**

In `src/covers/_lib.ts`, inside `export interface Cover { … }` add:
```ts
  /** Largest displacement any element makes during motion, in canvas px (2400 wide). Must be ≥ 60 so it reads at 700 px. */
  motionPx?: number;
```

- [ ] **Step 2: Write the skill**

`.claude/skills/essay-line/cover/SKILL.md`:
```markdown
# Essay line — cover

Design and write the animated cover module for one essay, in the existing
system. Read `src/covers/_lib.ts` (header comments are the rules) and two
recent modules (`src/covers/the-ambidextrous-budget.ts`,
`src/covers/the-cognitive-supply-chain.ts`) before writing anything.

Rules
- Design from the argument of the essay (given in Input), not from the title.
  One abstract mechanism that embodies the essay's central move.
- Write `src/covers/<slug>.ts` exporting a `Cover` with `slug`, `fig`,
  `caption` in the form "NOUN, ADJECTIVE" (capitals), `still(alt)` built as a
  pure string (it runs in Node), `motion(svg)` returning Animations that loop
  over PERIOD and rest on the still (use `hold`), and `motionPx` = the largest
  displacement in canvas pixels; it must be at least 60.
- Cream on near-black only, using the palette constants. No text beyond the
  FIG mark and caption block.
- Write a `coverImageAlt` (British English, one paragraph, describes the
  still, ends with the caption in single quotes) to
  `_sources/staging-articles/<slug>/cover-alt.txt`.
- Do not touch any other file. Do not run the renderer; the stage does that.
```

- [ ] **Step 3: Write the failing test**

```js
// scripts/line/test/cover.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFig, checkMotionDeclared } from '../cover.mjs';

test('nextFig is one above the highest fig in src/covers', () => {
  assert.match(nextFig(), /^\d{2}$/);
  assert.ok(Number(nextFig()) >= 51);
});

test('checkMotionDeclared reads motionPx from a module source', () => {
  assert.equal(checkMotionDeclared('export const cover = { motionPx: 84, slug: "x" }'), 84);
  assert.equal(checkMotionDeclared('no field'), 0);
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `node --test scripts/line/test/cover.test.mjs` — Expected: FAIL, module not found.

- [ ] **Step 5: Write cover.mjs**

```js
// scripts/line/cover.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, log } from './env.mjs';
import { runSkill } from './claude.mjs';
import { essayDir } from './state.mjs';
import { splitFrontmatter } from './md.mjs';

const COVERS = path.join(ROOT, 'src', 'covers');

export function nextFig() {
  let max = 0;
  for (const f of fs.readdirSync(COVERS)) {
    if (!f.endsWith('.ts') || f.startsWith('_')) continue;
    const m = fs.readFileSync(path.join(COVERS, f), 'utf8').match(/fig:\s*['"](\d+)['"]/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return String(max + 1).padStart(2, '0');
}

export const checkMotionDeclared = (src) => Number(src.match(/motionPx:\s*(\d+)/)?.[1] ?? 0);

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed: ${(r.stderr || r.stdout).slice(0, 400)}`);
  return r.stdout;
}

export function makeCover({ slug, finalPath }) {
  const { meta, body } = splitFrontmatter(fs.readFileSync(finalPath, 'utf8'));
  const fig = nextFig();
  const modulePath = path.join(COVERS, `${slug}.ts`);
  const altPath = path.join(essayDir(slug), 'cover-alt.txt');
  const input = `slug: ${slug}\nfig: ${fig}\ntitle: ${meta.title}\nexcerpt: ${meta.excerpt}\n\nEssay:\n\n${body}`;
  const out = runSkill({ skill: 'cover', input, tools: ['Read', 'Write', 'Glob'], maxTurns: 40 });
  if (!fs.existsSync(modulePath)) throw new Error('cover skill did not write the module');
  const src = fs.readFileSync(modulePath, 'utf8');
  const motionPx = checkMotionDeclared(src);
  if (motionPx < 60) throw new Error(`cover motionPx ${motionPx} < 60 (would not read at 700 px)`);
  const caption = src.match(/caption:\s*['"]([^'"]+)['"]/)?.[1] ?? '';
  if (!/^[A-Z][A-Z ]+, [A-Z][A-Z ]+$/.test(caption)) throw new Error(`caption "${caption}" is not NOUN, ADJECTIVE`);
  run('node', ['scripts/render-cover.mjs', slug]);
  const webp = path.join(ROOT, 'public', 'img', `${slug}.webp`);
  if (!fs.existsSync(webp)) throw new Error('render-cover produced no webp');
  const alt = fs.readFileSync(altPath, 'utf8').trim();
  log('cover', `${slug} FIG. ${fig} "${caption}" motion ${motionPx}px, $${out.cost_usd.toFixed(3)}`);
  return { fig, caption, alt, motionPx, webp, cost_usd: out.cost_usd };
}
```

- [ ] **Step 6: Run tests, then a real cover on the staged two-banks essay in a throwaway branch**

Run: `node --test scripts/line/test/cover.test.mjs` — Expected: `# pass 2`.
Run (throwaway; two-banks already has a cover, so use a temporary slug):
```bash
git stash list >/dev/null; cp _sources/staging-articles/two-banks-one-start-line.md /tmp/tb.md
node -e "import('./scripts/line/cover.mjs').then(m => console.log(m.makeCover({ slug: 'line-cover-test', finalPath: '/tmp/tb.md' })))"
open public/img/line-cover-test.webp
```
Expected: a module at `src/covers/line-cover-test.ts`, a rendered webp that reads as the house fabric, motionPx ≥ 60. Compare visually with `public/img/two-banks-one-start-line.webp`. Then remove the test artefacts: `rm src/covers/line-cover-test.ts public/img/line-cover-test.webp` and the OG file if created.

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/essay-line/cover scripts/line/cover.mjs scripts/line/test/cover.test.mjs src/covers/_lib.ts
git commit -m "Essay line: cover stage (skill → module → render, motion floor 60px)"
```

---

## Phase 5 — Brief and draft

### Task 12: Brief stage

**Files:**
- Create: `.claude/skills/essay-line/brief/SKILL.md`, `scripts/line/brief.mjs`, `scripts/line/test/brief.test.mjs`

**Interfaces:**
- Consumes: `loadConfig`, `loadQueue`, `loadLedger`, `neverListHits`, `runSkill`, `sendMail`, `saveState`, peg-board.json.
- Produces: `pickTopic({ queue, ledger, board, cfg, today }) → { title, family, source: 'peg'|'queue', peg|null }`, `slugify(title)`, `runBrief({ dry }) → { slug, brief, messageId }`.

- [ ] **Step 1: Write the skill**

`.claude/skills/essay-line/brief/SKILL.md`:
```markdown
# Essay line — Monday brief

Write the one-screen brief for this week's essay. The owner reads it on a
phone and replies "no", "hold", or nothing.

Use WebSearch and WebFetch to find three to five sources you can open now
(reports, filings, letters, primary data). List only sources you opened.
Never a number from memory.

Output markdown with exactly these headings:
## Topic — the working title
## Angle — three sentences: the claim, the mechanism, the reader's takeaway
## Why now — one paragraph; name the peg if there is one, else say "evergreen"
## Sources — bullet list, each: title, URL, the one figure or quote we will use
## Family — one of the five families
## Number in the hook — the figure the LinkedIn post will lead with

British English. No preamble. Do not mention the never-list names.
```

- [ ] **Step 2: Write the failing test**

```js
// scripts/line/test/brief.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickTopic, slugify } from '../brief.mjs';

const cfg = { preempt: true, calibration_until: '2000-01-01', thresholds: { preempt: 70, min_fit_to_preempt: 8 } };
const queue = [
  { title: 'The verification premium', family: 'metered cognition', trigger: null, status: 'queued' },
  { title: 'Alignment is a capital-allocation problem', family: 'CFO mandate', trigger: null, status: 'queued' },
  { title: 'Two banks, one start line', family: 'capital allocation', trigger: 'Bank Q3 results', status: 'pen' },
];

test('takes the top queued item and never a pen item without a peg', () => {
  const t = pickTopic({ queue, ledger: { published: [] }, board: { items: [] }, cfg });
  assert.equal(t.title, 'The verification premium');
});

test('series balance skips the family published last week', () => {
  const t = pickTopic({ queue, ledger: { published: [{ family: 'metered cognition', date: '2026-09-09' }] }, board: { items: [] }, cfg, today: '2026-09-14' });
  assert.equal(t.title, 'Alignment is a capital-allocation problem');
});

test('a preempt-level peg mapping to a pen item fires it', () => {
  const board = { items: [{ headline: 'JPM beats', score: 78, action: 'preempt', corpus_fit: 9, maps_to: 'Two banks, one start line', url: 'u' }] };
  const t = pickTopic({ queue, ledger: { published: [] }, board, cfg });
  assert.equal(t.title, 'Two banks, one start line');
  assert.equal(t.source, 'peg');
});

test('no preempt during calibration', () => {
  const board = { items: [{ headline: 'x', score: 90, action: 'preempt', corpus_fit: 10, maps_to: 'Two banks, one start line', url: 'u' }] };
  const t = pickTopic({ queue, ledger: { published: [] }, board, cfg: { ...cfg, preempt: false } });
  assert.equal(t.source, 'queue');
});

test('slugify', () => assert.equal(slugify('The 90-day notice: what it means'), 'the-90-day-notice-what-it-means'));
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test scripts/line/test/brief.test.mjs` — Expected: FAIL, module not found.

- [ ] **Step 4: Write brief.mjs**

```js
// scripts/line/brief.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, log, paused } from './env.mjs';
import { runSkill } from './claude.mjs';
import { sendMail } from './mail.mjs';
import { saveState, essayDir, listEssays } from './state.mjs';
import { loadConfig, loadQueue, loadLedger, loadNeverList, neverListHits, markQueue } from './queue.mjs';
import { BOARD_JSON } from './scan.mjs';

export const slugify = (t) => t.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function pickTopic({ queue, ledger, board, cfg, today = new Date().toISOString().slice(0, 10) }) {
  const preemptOn = cfg.preempt && today >= cfg.calibration_until;
  const lastFamily = [...ledger.published].sort((a, b) => (a.date < b.date ? 1 : -1))[0]?.family ?? null;
  if (preemptOn) {
    const peg = board.items.filter((i) => (i.action === 'preempt' || i.action === 'fast_piece') && i.corpus_fit >= cfg.thresholds.min_fit_to_preempt)
      .sort((a, b) => b.score - a.score)[0];
    if (peg) {
      const q = queue.find((x) => x.title === peg.maps_to) ?? (peg.proposed_title ? { title: peg.proposed_title, family: 'CFO mandate', trigger: null, status: 'proposed' } : null);
      if (q) return { ...q, source: 'peg', peg };
    }
  }
  const eligible = queue.filter((q) => q.status === 'queued');
  const pick = eligible.find((q) => q.family !== lastFamily) ?? eligible[0];
  if (!pick) throw new Error('queue empty');
  return { ...pick, source: 'queue', peg: null };
}

export function runBrief({ dry = false } = {}) {
  if (paused()) { log('brief', 'PAUSE present'); return null; }
  if (listEssays().some((e) => !['published'].includes(e.stage) && !e.killed)) { log('brief', 'an essay is already in flight; no new brief'); return null; }
  const cfg = loadConfig();
  const board = fs.existsSync(BOARD_JSON) ? JSON.parse(fs.readFileSync(BOARD_JSON, 'utf8')) : { items: [] };
  const topic = pickTopic({ queue: loadQueue(), ledger: loadLedger(), board, cfg });
  const slug = slugify(topic.title);
  const never = loadNeverList();
  const input = `Working title: ${topic.title}\nFamily: ${topic.family}\n${topic.peg ? `Peg: ${topic.peg.headline} — ${topic.peg.url} (score ${topic.peg.score})` : 'Peg: none (evergreen)'}\nNever-list: ${never.join(', ')}\nIdeas file context:\n${fs.readFileSync(path.join(ROOT, 'distribution', 'ARTICLE-IDEAS.md'), 'utf8')}`;
  const out = runSkill({ skill: 'brief', input, tools: ['WebSearch', 'WebFetch'], maxTurns: 40 });
  const brief = String(out.result).trim();
  const hits = neverListHits(brief, never);
  if (hits.length) throw new Error(`brief mentions never-list: ${hits.join(', ')}`);
  fs.mkdirSync(essayDir(slug), { recursive: true });
  fs.writeFileSync(path.join(essayDir(slug), 'brief.md'), brief + '\n');
  const vetoAt = new Date(); vetoAt.setHours(cfg.veto_hour_local, 0, 0, 0);
  if (dry) { log('brief', `DRY would email brief for ${slug}`); return { slug, brief, messageId: null }; }
  const { messageId, token } = sendMail({ subject: `Brief: ${topic.title}`, text: `${brief}\n\nReply "no" to kill, "hold" to park, or nothing to proceed. Veto closes ${vetoAt.toLocaleString('en-GB')}.` });
  saveState(slug, { stage: 'briefed', title: topic.title, family: topic.family, source: topic.source, peg: topic.peg ?? null, brief_message_id: messageId, brief_token: token, veto_deadline: vetoAt.toISOString(), cost_usd: out.cost_usd });
  if (topic.source === 'queue') markQueue(topic.title, 'briefed');
  log('brief', `${slug} briefed, veto until ${vetoAt.toISOString()}`);
  return { slug, brief, messageId };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const r = runBrief({ dry: process.argv.includes('--dry') });
  if (r) console.log(r.brief);
}
```

- [ ] **Step 5: Run tests, then a dry brief**

Run: `node --test scripts/line/test/brief.test.mjs` — Expected: `# pass 5`.
Run: `node scripts/line/brief.mjs --dry` — Expected: a brief for "The verification premium" printed with the six headings and real, opened sources; `_sources/staging-articles/the-verification-premium/brief.md` written; no email, no state change.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/essay-line/brief scripts/line/brief.mjs scripts/line/test/brief.test.mjs
git commit -m "Essay line: brief stage (topic pick, never-list check, Monday email)"
```

### Task 13: Draft stage

**Files:**
- Create: `.claude/skills/essay-line/write-essay/SKILL.md`, `scripts/line/draft.mjs`, `scripts/line/test/draft.test.mjs`

**Interfaces:**
- Consumes: `runSkill`, `essayDir`, `saveState`, `neverListHits`, `docs/specs/article-formatting.md`, last four essays as exemplars.
- Produces: `exemplars(n = 4) → string` (titles + first 600 words of the four most recent essays), `runDraft(slug) → { outlinePath, draftPath, cost_usd }`, `validateFrontmatter(md) → string[]` (missing keys).

- [ ] **Step 1: Write the skill**

`.claude/skills/essay-line/write-essay/SKILL.md`:
```markdown
# Essay line — write the essay

You write a signal-to-noise.co essay from the brief, in the owner's voice.

Voice (learned from the exemplars in Input): plain, direct, CFO to CFO; short
declarative sentences beside one long one; concrete numbers with their
sources; one named mechanism per essay; no listicle padding; no "in today's
fast-paced world"; British English throughout ("learned", not "learnt";
-ise, -our, -re). 1,300 to 1,800 words. Sentence-case headings (`##`), no
trailing punctuation in headings. Bullet labels bold with the colon inside.

Facts: use only the sources in the brief plus anything you open with
WebFetch now. Every figure carries its source as a markdown link at first
use. Quote verbatim or not at all, with the source linked. Credit borrowed
terms to their originator. Never a name from the never-list.

Step 1 — write `OUTLINE.md`: title, the claim in one sentence, five to seven
section headings each with the one point it makes and the figure it uses.
Step 2 — write `draft.md` with this frontmatter exactly:
---
title: "…"                       (sentence case)
date: YYYY-MM-DD                 (given in Input)
excerpt: "…"                     (two sentences, the hook, ≤ 320 chars)
seoDescription: "…"              (≤ 160 chars, no colon-lists)
tags: ["cfo", …]                 (3–5 lowercase tags)
draft: false
coverImage: /img/<slug>.webp
coverImageAlt: ""                (leave empty; the cover stage fills it)
coverAnimation: <slug>
---
then the body. Internal links to other essays use absolute
`https://signal-to-noise.co/insights/<slug>/` URLs.

Write both files into the directory given in Input and nothing else.
```

- [ ] **Step 2: Write the failing test**

```js
// scripts/line/test/draft.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { exemplars, validateFrontmatter } from '../draft.mjs';

test('exemplars returns four recent essays trimmed', () => {
  const e = exemplars(4);
  assert.equal((e.match(/^### /gm) ?? []).length, 4);
  assert.ok(e.length < 4 * 5000);
});

test('validateFrontmatter lists missing keys', () => {
  const missing = validateFrontmatter('---\ntitle: "T"\ndate: 2026-09-16\n---\n\nbody');
  assert.deepEqual(missing, ['excerpt', 'seoDescription', 'tags', 'draft', 'coverImage', 'coverImageAlt', 'coverAnimation']);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test scripts/line/test/draft.test.mjs` — Expected: FAIL, module not found.

- [ ] **Step 4: Write draft.mjs**

```js
// scripts/line/draft.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, log } from './env.mjs';
import { runSkill } from './claude.mjs';
import { essayDir, loadState, saveState, addCost } from './state.mjs';
import { loadNeverList, neverListHits } from './queue.mjs';
import { splitFrontmatter } from './md.mjs';

const INSIGHTS = path.join(ROOT, 'src', 'content', 'insights');
export const REQUIRED = ['title', 'date', 'excerpt', 'seoDescription', 'tags', 'draft', 'coverImage', 'coverImageAlt', 'coverAnimation'];

export function exemplars(n = 4) {
  const essays = fs.readdirSync(INSIGHTS).filter((f) => f.endsWith('.md')).map((f) => {
    const { meta, body } = splitFrontmatter(fs.readFileSync(path.join(INSIGHTS, f), 'utf8'));
    return { title: meta.title, date: String(meta.date), body };
  }).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, n);
  return essays.map((e) => `### ${e.title} (${e.date})\n\n${e.body.split(/\s+/).slice(0, 600).join(' ')}\n`).join('\n');
}

export const validateFrontmatter = (md) => { const { meta } = splitFrontmatter(md); return REQUIRED.filter((k) => !(k in meta)); };

export function nextWednesday(from = new Date()) {
  const d = new Date(from); d.setDate(d.getDate() + ((3 - d.getDay() + 7) % 7 || 7)); return d.toISOString().slice(0, 10);
}

export function runDraft(slug) {
  const dir = essayDir(slug), st = loadState(slug);
  const brief = fs.readFileSync(path.join(dir, 'brief.md'), 'utf8');
  const never = loadNeverList();
  const input = [
    `Output directory: ${dir}`, `Slug: ${slug}`, `Publish date: ${nextWednesday()}`,
    `Never-list: ${never.join(', ')}`, `Formatting rules:\n${fs.readFileSync(path.join(ROOT, 'docs', 'specs', 'article-formatting.md'), 'utf8').slice(0, 6000)}`,
    `Brief:\n${brief}`, `Exemplars of the voice:\n${exemplars(4)}`,
  ].join('\n\n');
  const out = runSkill({ skill: 'write-essay', input, tools: ['WebSearch', 'WebFetch', 'Read', 'Write'], maxTurns: 60 });
  const outlinePath = path.join(dir, 'OUTLINE.md'), draftPath = path.join(dir, 'draft.md');
  if (!fs.existsSync(outlinePath) || !fs.existsSync(draftPath)) throw new Error('write-essay skill did not produce OUTLINE.md and draft.md');
  const md = fs.readFileSync(draftPath, 'utf8');
  const missing = validateFrontmatter(md);
  if (missing.length) throw new Error(`draft frontmatter missing: ${missing.join(', ')}`);
  const hits = neverListHits(md, never);
  if (hits.length) throw new Error(`draft mentions never-list: ${hits.join(', ')}`);
  const words = splitFrontmatter(md).body.split(/\s+/).length;
  if (words < 1100 || words > 2100) throw new Error(`draft is ${words} words, outside 1,100–2,100`);
  addCost(slug, out.cost_usd);
  saveState(slug, { stage: 'drafted', words });
  log('draft', `${slug} drafted, ${words} words, $${out.cost_usd.toFixed(3)}`);
  return { outlinePath, draftPath, cost_usd: out.cost_usd };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  console.log(runDraft(process.argv[2]));
}
```

- [ ] **Step 5: Run tests, then one real draft by hand**

Run: `node --test scripts/line/test/draft.test.mjs` — Expected: `# pass 2`.
Run: `node scripts/line/draft.mjs the-verification-premium` (uses the brief from Task 12's dry run).
Expected: `OUTLINE.md` and `draft.md` in the essay folder, 1,300–1,800 words, valid frontmatter. Read the draft against the last four essays for voice; note anything off in the skill file and re-run once.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/essay-line/write-essay scripts/line/draft.mjs scripts/line/test/draft.test.mjs
git commit -m "Essay line: draft stage (outline + essay via write-essay skill)"
```

---

## Phase 6 — Final email, publish, runner, schedule

### Task 14: Final email and corrections

**Files:**
- Create: `scripts/line/final.mjs`, `scripts/line/test/final.test.mjs`

**Interfaces:**
- Consumes: `sendMail`, `findReply`, `runGate`, `layerBText`, `essayDir`, `loadState`, `saveState`.
- Produces: `buildFinal(slug) → finalPath` (gated markdown + cover alt merged), `sendFinal(slug) → { messageId }`, `applyCorrections(slug, text) → { changed }` (headless Claude edits `final.md` per the correction text, then re-gate with `skipLayerB=false` on changed strings only — implemented as full re-gate for simplicity), `readFinalReply(slug) → null | { verdict, text }`.

- [ ] **Step 1: Write the failing test**

```js
// scripts/line/test/final.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { finalEmailText } from '../final.mjs';

test('finalEmailText carries the instructions, the text and the report', () => {
  const t = finalEmailText({ title: 'T', final: '---\ntitle: "T"\n---\n\nBody', report: '# Gate report\n\n## Verdict: PASS' });
  assert.match(t, /Reply "publish" to ship/);
  assert.match(t, /No reply means hold/);
  assert.ok(t.indexOf('Body') < t.indexOf('# Gate report'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/line/test/final.test.mjs` — Expected: FAIL, module not found.

- [ ] **Step 3: Write final.mjs**

```js
// scripts/line/final.mjs
import fs from 'node:fs';
import path from 'node:path';
import { log } from './env.mjs';
import { sendMail, findReply } from './mail.mjs';
import { runGate } from './gate.mjs';
import { runSkill } from './claude.mjs';
import { essayDir, loadState, saveState, addCost } from './state.mjs';
import { splitFrontmatter, joinFrontmatter } from './md.mjs';
import { loadConfig } from './queue.mjs';

export function finalEmailText({ title, final, report }) {
  return [
    `FINAL FOR APPROVAL — ${title}`, '',
    'Reply "publish" to ship Wednesday 08:00 UK. Reply "hold" to park. Reply with corrections in plain prose and I will apply them, re-run the gate and send a fresh final.',
    'No reply means hold. Nothing ships on silence.', '', '────────', '', final, '', '────────', '', report, '',
  ].join('\n');
}

export function buildFinal(slug) {
  const dir = essayDir(slug);
  const st = loadState(slug);
  const { meta, body, raw } = splitFrontmatter(fs.readFileSync(path.join(dir, 'gated.md'), 'utf8'));
  meta.coverImageAlt = fs.readFileSync(path.join(dir, 'cover-alt.txt'), 'utf8').trim();
  const finalPath = path.join(dir, 'final.md');
  fs.writeFileSync(finalPath, joinFrontmatter(meta, body, raw));
  return finalPath;
}

export function sendFinal(slug) {
  const dir = essayDir(slug), st = loadState(slug);
  const finalPath = buildFinal(slug);
  const report = fs.readFileSync(path.join(dir, 'gate-report.md'), 'utf8');
  const webp = path.join(dir, '..', '..', '..', 'public', 'img', `${slug}.webp`);
  const attachments = fs.existsSync(webp) ? [{ name: `${slug}.webp`, type: 'image/webp', data: fs.readFileSync(webp) }] : [];
  const { messageId, token } = sendMail({ subject: `Final for approval: ${st.title}`, text: finalEmailText({ title: st.title, final: fs.readFileSync(finalPath, 'utf8'), report }), attachments });
  const cfg = loadConfig();
  const pub = new Date(); pub.setDate(pub.getDate() + ((3 - pub.getDay() + 7) % 7)); pub.setHours(cfg.publish_hour_uk, 0, 0, 0);
  saveState(slug, { stage: 'final-sent', final_message_id: messageId, final_token: token, final_sent_at: new Date().toISOString(), publish_not_before: pub.toISOString(), approved: false });
  log('final', `${slug} final sent`);
  return { messageId };
}

export function readFinalReply(slug) {
  const st = loadState(slug);
  if (!st.final_message_id) return null;
  return findReply({ messageId: st.final_message_id });
}

export function applyCorrections(slug, text) {
  const dir = essayDir(slug), finalPath = path.join(dir, 'final.md');
  const input = `File to edit: ${finalPath}\n\nOwner's corrections (apply exactly these, change nothing else, keep frontmatter keys):\n\n${text}`;
  const out = runSkill({ skill: 'write-essay', input: `CORRECTIONS MODE. ${input}`, tools: ['Read', 'Edit'], maxTurns: 20 });
  addCost(slug, out.cost_usd);
  // Re-gate the corrected file in full (Layer B on everything is the safe default; cost is one Codex pass).
  const gated = path.join(dir, 'gated.md');
  const r = runGate({ inPath: finalPath, outPath: gated, reportPath: path.join(dir, 'gate-report.md') });
  saveState(slug, { corrections: [...(loadState(slug).corrections ?? []), { text, at: new Date().toISOString(), gate: r.verdict }] });
  return { changed: true, verdict: r.verdict };
}
```

- [ ] **Step 4: Run test and commit**

Run: `node --test scripts/line/test/final.test.mjs` — Expected: `# pass 1`.

```bash
git add scripts/line/final.mjs scripts/line/test/final.test.mjs
git commit -m "Essay line: final-for-approval email, reply reading, corrections re-gate"
```

### Task 15: Publish stage

**Files:**
- Create: `scripts/line/publish.mjs`, `scripts/line/test/publish.test.mjs`

**Interfaces:**
- Consumes: `final.md`, `deploy.sh`, `make-og-images.mjs`, `appendLedger`, `distribution/metrics/linkedin-posts.json`.
- Produces: `publish(slug, { dry }) → { url, commit }`; `verifyLive(slug) → { page, og, cover }` (HTTP codes).

- [ ] **Step 1: Write the failing test**

```js
// scripts/line/test/publish.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { registryEntry, commitMessage } from '../publish.mjs';

test('registryEntry shape', () => {
  assert.deepEqual(registryEntry({ slug: 's', title: 'T', date: '2026-09-16' }), { label: 'T (native post, pending)', posted: '', activity: '', essay: 's', added: '2026-09-16' });
});

test('commitMessage carries the gate summary', () => {
  const m = commitMessage({ title: 'T', slug: 's', report: '# Gate report\n\n## Verdict: PASS\nAll four checks clean.' });
  assert.match(m, /^Essay: T \(s\)/);
  assert.match(m, /Gate: PASS/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/line/test/publish.test.mjs` — Expected: FAIL, module not found.

- [ ] **Step 3: Write publish.mjs**

```js
// scripts/line/publish.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, log } from './env.mjs';
import { essayDir, loadState, saveState } from './state.mjs';
import { appendLedger, markQueue } from './queue.mjs';
import { splitFrontmatter } from './md.mjs';

const SITE = 'https://signal-to-noise.co';
const REGISTRY = path.join(ROOT, 'distribution', 'metrics', 'linkedin-posts.json');

export const registryEntry = ({ slug, title, date }) => ({ label: `${title} (native post, pending)`, posted: '', activity: '', essay: slug, added: date });
export const commitMessage = ({ title, slug, report }) => `Essay: ${title} (${slug})\n\nGate: ${report.match(/## Verdict: (\w+)/)?.[1] ?? 'UNKNOWN'} — ${report.split('\n').find((l) => /clean|Failing/.test(l)) ?? ''}\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`;

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (${r.status}): ${(r.stderr || r.stdout).slice(-600)}`);
  return r.stdout;
}
const code = (url) => spawnSync('curl', ['-s', '-o', '/dev/null', '-m', '20', '-w', '%{http_code}', url], { encoding: 'utf8' }).stdout.trim();

export function verifyLive(slug) {
  return { page: code(`${SITE}/insights/${slug}/`), og: code(`${SITE}/og/${slug}.jpg`), cover: code(`${SITE}/img/${slug}.webp`) };
}

export function publish(slug, { dry = false } = {}) {
  const dir = essayDir(slug), st = loadState(slug);
  const finalPath = path.join(dir, 'final.md');
  const { meta } = splitFrontmatter(fs.readFileSync(finalPath, 'utf8'));
  const dest = path.join(ROOT, 'src', 'content', 'insights', `${slug}.md`);
  if (fs.existsSync(dest)) throw new Error(`${dest} already exists`);
  if (verifyLive(slug).page === '200') throw new Error('already live');
  if (dry) { log('publish', `DRY would publish ${slug}`); return { url: `${SITE}/insights/${slug}/`, commit: null }; }
  fs.copyFileSync(finalPath, dest);
  sh('node', ['scripts/make-og-images.mjs']);
  sh('npm', ['run', 'build']);
  sh('bash', ['deploy.sh']);
  const live = verifyLive(slug);
  if (live.page !== '200' || live.cover !== '200') throw new Error(`live check failed: ${JSON.stringify(live)}`);
  const reg = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  reg.posts.push(registryEntry({ slug, title: meta.title, date: String(meta.date) }));
  fs.writeFileSync(REGISTRY, JSON.stringify(reg, null, 2) + '\n');
  appendLedger({ slug, title: meta.title, family: st.family, date: String(meta.date), url: `${SITE}/insights/${slug}/`, cost_usd: st.cost_usd });
  markQueue(st.title, `published ${meta.date}`);
  sh('git', ['add', dest, `src/covers/${slug}.ts`, `public/img/${slug}.webp`, 'public/og', REGISTRY, 'distribution/line']);
  sh('git', ['commit', '-q', '-m', commitMessage({ title: meta.title, slug, report: fs.readFileSync(path.join(dir, 'gate-report.md'), 'utf8') })]);
  sh('git', ['push', '-q', 'origin', 'main']);
  const commit = sh('git', ['rev-parse', '--short', 'HEAD']).trim();
  saveState(slug, { stage: 'published', published_at: new Date().toISOString(), commit, url: `${SITE}/insights/${slug}/` });
  log('publish', `${slug} live at ${SITE}/insights/${slug}/ (${commit})`);
  return { url: `${SITE}/insights/${slug}/`, commit };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  console.log(publish(process.argv[2], { dry: process.argv.includes('--dry') }));
}
```

- [ ] **Step 4: Run test; dry-run publish on a staged essay**

Run: `node --test scripts/line/test/publish.test.mjs` — Expected: `# pass 2`.
Run: `node scripts/line/publish.mjs the-verification-premium --dry` — Expected: `DRY would publish …` (requires `final.md` from Task 14's `buildFinal`; if absent, create it by running the gate on `draft.md` to `gated.md` and copying `cover-alt.txt`).

- [ ] **Step 5: Commit**

```bash
git add scripts/line/publish.mjs scripts/line/test/publish.test.mjs
git commit -m "Essay line: publish stage (content, OG, build, deploy, verify, ledger, registry, commit)"
```

### Task 16: Runner state machine

**Files:**
- Create: `scripts/line/runner.mjs`, `scripts/line/test/runner.test.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces: `nextAction(state, now, cfg) → null | 'check-veto' | 'draft' | 'gate' | 'cover' | 'send-final' | 'check-final' | 'publish'`; `advance(slug, now) → string` (action taken); CLI `node scripts/line/runner.mjs [--dry] [--now ISO]`.

- [ ] **Step 1: Write the failing test**

```js
// scripts/line/test/runner.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextAction } from '../runner.mjs';

const cfg = { veto_hour_local: 19, final_hour_local: 18, publish_hour_uk: 8 };
const at = (s) => new Date(s);

test('briefed waits for the veto deadline then checks', () => {
  const st = { stage: 'briefed', veto_deadline: '2026-09-14T18:00:00.000Z' };
  assert.equal(nextAction(st, at('2026-09-14T17:00:00Z'), cfg), null);
  assert.equal(nextAction(st, at('2026-09-14T18:05:00Z'), cfg), 'check-veto');
});

test('approved → draft → gate → cover → send-final in order', () => {
  assert.equal(nextAction({ stage: 'approved' }, at('2026-09-14T20:00:00Z'), cfg), 'draft');
  assert.equal(nextAction({ stage: 'drafted' }, at('2026-09-15T01:00:00Z'), cfg), 'gate');
  assert.equal(nextAction({ stage: 'gated', gate_verdict: 'pass' }, at('2026-09-15T02:00:00Z'), cfg), 'cover');
  assert.equal(nextAction({ stage: 'gated', gate_verdict: 'fail' }, at('2026-09-15T02:00:00Z'), cfg), null);
  assert.equal(nextAction({ stage: 'covered' }, at('2026-09-15T03:00:00Z'), cfg), 'send-final');
});

test('final-sent polls for a reply; publishes only when approved and after the slot', () => {
  const st = { stage: 'final-sent', approved: false, publish_not_before: '2026-09-16T07:00:00.000Z' };
  assert.equal(nextAction(st, at('2026-09-15T20:00:00Z'), cfg), 'check-final');
  assert.equal(nextAction({ ...st, approved: true }, at('2026-09-16T06:00:00Z'), cfg), null);
  assert.equal(nextAction({ ...st, approved: true }, at('2026-09-16T07:30:00Z'), cfg), 'publish');
});

test('hold, killed and published do nothing', () => {
  assert.equal(nextAction({ stage: 'approved', hold: true }, at('2026-09-14T20:00:00Z'), cfg), null);
  assert.equal(nextAction({ stage: 'approved', killed: true }, at('2026-09-14T20:00:00Z'), cfg), null);
  assert.equal(nextAction({ stage: 'published' }, at('2026-09-14T20:00:00Z'), cfg), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/line/test/runner.test.mjs` — Expected: FAIL, module not found.

- [ ] **Step 3: Write runner.mjs**

```js
// scripts/line/runner.mjs
import fs from 'node:fs';
import path from 'node:path';
import { log, paused } from './env.mjs';
import { listEssays, loadState, saveState, essayDir, addCost } from './state.mjs';
import { loadConfig } from './queue.mjs';
import { sendMail, findReply } from './mail.mjs';
import { scan } from './scan.mjs';
import { runBrief } from './brief.mjs';
import { runDraft } from './draft.mjs';
import { runGate } from './gate.mjs';
import { makeCover } from './cover.mjs';
import { sendFinal, readFinalReply, applyCorrections } from './final.mjs';
import { publish } from './publish.mjs';

export function nextAction(st, now, cfg) {
  if (st.hold || st.killed) return null;
  switch (st.stage) {
    case 'briefed': return now >= new Date(st.veto_deadline) ? 'check-veto' : null;
    case 'approved': return 'draft';
    case 'drafted': return 'gate';
    case 'gated': return st.gate_verdict === 'pass' ? 'cover' : null;
    case 'covered': return 'send-final';
    case 'final-sent':
      if (st.approved) return now >= new Date(st.publish_not_before) ? 'publish' : null;
      return 'check-final';
    default: return null;
  }
}

function notify(subject, text) { try { sendMail({ subject, text }); } catch (e) { log('runner', `notify failed: ${e.message}`); } }

export function advance(slug, now = new Date(), { dry = false } = {}) {
  const cfg = loadConfig();
  const st = loadState(slug);
  const action = nextAction(st, now, cfg);
  if (!action) return 'idle';
  if (dry) { log('runner', `DRY ${slug}: would ${action}`); return action; }
  const dir = essayDir(slug);
  try {
    switch (action) {
      case 'check-veto': {
        const r = findReply({ messageId: st.brief_message_id });
        if (r?.verdict === 'no') { saveState(slug, { killed: true, stage: 'briefed', veto: r.text }); log('runner', `${slug} killed by owner`); }
        else if (r?.verdict === 'hold') { saveState(slug, { hold: true, veto: r.text }); log('runner', `${slug} held by owner`); }
        else saveState(slug, { stage: 'approved', veto: r?.text ?? null });
        break;
      }
      case 'draft': runDraft(slug); break;
      case 'gate': {
        const r = runGate({ inPath: path.join(dir, 'draft.md'), outPath: path.join(dir, 'gated.md'), reportPath: path.join(dir, 'gate-report.md') });
        saveState(slug, { stage: 'gated', gate_verdict: r.verdict });
        if (r.verdict === 'fail') notify(`Held at gate: ${st.title}`, r.report);
        break;
      }
      case 'cover': {
        const c = makeCover({ slug, finalPath: path.join(dir, 'gated.md') });
        addCost(slug, c.cost_usd);
        saveState(slug, { stage: 'covered', fig: c.fig, caption: c.caption });
        break;
      }
      case 'send-final': sendFinal(slug); break;
      case 'check-final': {
        const r = readFinalReply(slug);
        if (!r) break;
        if (r.verdict === 'publish') saveState(slug, { approved: true, approved_at: now.toISOString() });
        else if (r.verdict === 'hold' || r.verdict === 'no') saveState(slug, { hold: true, killed: r.verdict === 'no' });
        else if (r.verdict === 'text') {
          const c = applyCorrections(slug, r.text);
          if (c.verdict === 'pass') { saveState(slug, { stage: 'covered' }); } // → send-final again on next wake
          else { saveState(slug, { stage: 'gated', gate_verdict: 'fail' }); notify(`Held at gate after corrections: ${st.title}`, fs.readFileSync(path.join(dir, 'gate-report.md'), 'utf8')); }
        }
        break;
      }
      case 'publish': {
        const p = publish(slug);
        notify(`Published: ${st.title}`, `${p.url}\n\nCommit ${p.commit}. Substack mirror follows automatically after 48 h. LinkedIn edition and native post are on Monday's session.`);
        break;
      }
    }
    log('runner', `${slug}: ${action} done`);
    return action;
  } catch (e) {
    saveState(slug, { last_error: { action, message: String(e.message).slice(0, 500), at: now.toISOString() } });
    log('runner', `${slug}: ${action} FAILED — ${e.message}`);
    notify(`Essay line failed at ${action}: ${st.title ?? slug}`, String(e.message).slice(0, 2000));
    return `error:${action}`;
  }
}

export async function tick({ now = new Date(), dry = false } = {}) {
  if (paused()) { log('runner', 'PAUSE present'); return; }
  const cfg = loadConfig();
  const hour = now.getHours(), day = now.getDay();
  if (hour === 6 && !dry) { try { await scan(); } catch (e) { log('runner', `scan failed: ${e.message}`); } }
  if (day === 1 && hour === cfg.brief_hour_local) { try { runBrief({ dry }); } catch (e) { log('runner', `brief failed: ${e.message}`); notify('Essay line: brief failed', e.message); } }
  for (const e of listEssays()) advance(e.slug, now, { dry });
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const ni = process.argv.indexOf('--now');
  await tick({ now: ni > 0 ? new Date(process.argv[ni + 1]) : new Date(), dry: process.argv.includes('--dry') });
}
```

- [ ] **Step 4: Run tests and a dry tick**

Run: `node --test scripts/line/test/runner.test.mjs` — Expected: `# pass 4`.
Run: `node scripts/line/runner.mjs --dry --now 2026-09-14T07:00:00` — Expected: log lines showing what would run for the state files present (brief would email; an in-flight essay reports its would-be action).

- [ ] **Step 5: Commit**

```bash
git add scripts/line/runner.mjs scripts/line/test/runner.test.mjs
git commit -m "Essay line: runner state machine (one advance per wake, veto/final polling, corrections)"
```

### Task 17: launchd schedule, Monday skill, docs

**Files:**
- Create: `infra/co.signal-to-noise.essay-line.plist`, `.claude/skills/essay-line/monday/SKILL.md`, `distribution/line/README.md`
- Modify: `distribution/README.md` (daily loop: add the line), `docs/specs/2026-09-09-weekly-essay-line-design.md` status line.

- [ ] **Step 1: Write the plist**

`infra/co.signal-to-noise.essay-line.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>co.signal-to-noise.essay-line</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/node</string>
    <string>/Users/himanshu.kher/Documents/devProjects/signal2noise/scripts/line/runner.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>/Users/himanshu.kher/Documents/devProjects/signal2noise</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>6</integer><key>Minute</key><integer>30</integer></dict>
    <dict><key>Hour</key><integer>12</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>19</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>22</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>StandardOutPath</key><string>/Users/himanshu.kher/Library/Logs/signal2noise-essay-line-launchd.log</string>
  <key>StandardErrorPath</key><string>/Users/himanshu.kher/Library/Logs/signal2noise-essay-line-launchd.log</string>
</dict>
</plist>
```

Note: `tick()` keys the brief on `hour === 7` but the job fires at 06:30; set `brief_hour_local` to `6` in `distribution/line/config.json` so the 06:30 Monday wake sends the brief. The 19:00 wake performs the veto check (deadline 19:00 local).

- [ ] **Step 2: Write the Monday skill**

`.claude/skills/essay-line/monday/SKILL.md`:
```markdown
---
name: essay-line-monday
description: The attended Monday session — health line, readout, peg board, then the LinkedIn edition and native post in Chrome with the owner watching. Trigger when the user says "Monday".
---
1. Health: tail ~/Library/Logs/signal2noise-*.log; report last run and last success of essay-line, metrics, substack-mirror; list any state.json with last_error or hold.
2. Readout: run `node scripts/metrics-pull.mjs --linkedin`; pull LinkedIn figures via the Chrome extension for every post in distribution/metrics/linkedin-posts.json with an activity id; fill the LEARNING-LOG week entry; commit.
3. Peg board: show distribution/line/peg-board.md; ask which native_post items to use.
4. Edition: draft the LinkedIn newsletter edition for the most recently published essay (distribution/linkedin-newsletter/), topical intro from the peg board, run the gate on it (`node scripts/line/gate.mjs`), then publish it in Chrome with the owner confirming.
5. Native post: number in the hook; gate it; schedule for 08:00 UK next Monday in Chrome; record its activity id in linkedin-posts.json.
6. British English everywhere; never Axi.
```

- [ ] **Step 3: Write the README and install the job**

`distribution/line/README.md`: one page — rhythm table from spec §2, the two-email rules, kill switch, where state and logs live, how to run each stage by hand (`node scripts/line/<stage>.mjs <slug>`), how to run tests (`npm run test:line`), and the calibration note.

Install:
```bash
cp infra/co.signal-to-noise.essay-line.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/co.signal-to-noise.essay-line.plist
launchctl kickstart gui/$(id -u)/co.signal-to-noise.essay-line
sleep 20; tail -5 ~/Library/Logs/signal2noise-essay-line-launchd.log
```
Expected: a tick log line; with no essays in flight and not a Monday morning, `idle` for each and nothing else.

- [ ] **Step 4: Full dry cycle**

Simulate a week with `--dry --now` at each wake: Mon 06:30 (brief), Mon 19:00 (check-veto), Mon 22:00 (draft), Tue 06:30 (gate), Tue 12:00 (cover), Tue 19:00 (send-final), Wed 06:30 (check-final), Wed 12:00 (publish). Expected: each dry log line names the right action for the essay's stage. Fix any transition that misfires before going live.

- [ ] **Step 5: Update docs and commit**

Add to `distribution/README.md` daily loop after item 1: "0. **Essay** — automated by the weekly essay line (`distribution/line/README.md`)." Change the spec's status line to "Implemented <date>; first supervised cycle <date>".

```bash
git add infra/co.signal-to-noise.essay-line.plist .claude/skills/essay-line/monday distribution/line/README.md distribution/README.md docs/specs/2026-09-09-weekly-essay-line-design.md distribution/line/config.json
git commit -m "Essay line: launchd schedule, Monday session skill, docs"
git push origin main
```

### Task 18: First supervised live cycle

No new files. Checklist, run with Claude in session on the first Monday after Task 17:

- [ ] Owner has filled `_sources/NEVER-LIST.md`.
- [ ] Mon 06:30: brief email arrives; owner replies nothing (or "no" to test the kill path once, then re-run `runBrief` by hand).
- [ ] Mon 19:00: state → approved. Mon 22:00: draft written; read it.
- [ ] Tue 06:30: gate report clean (if held, fix the essay by hand, set stage back to `drafted`, let it re-run).
- [ ] Tue 12:00: cover rendered; open the webp.
- [ ] Tue 19:00: final email with attachment and report arrives.
- [ ] Owner replies "publish". Wed 06:30 marks approved; Wed 12:00 wake publishes (first slot after 08:00 UK); verify the live URL, OG and cover; check the commit and push.
- [ ] Fri 09:15: Substack mirror picks the essay up on its own.
- [ ] Following Monday: run the `monday` skill end to end.
- [ ] Record the cycle's total cost from `state.json` in LEARNING-LOG.

---

## Self-review

**Spec coverage.** §2 rhythm → Tasks 16–17 (wake times, veto/final deadlines, publish slot). §3.1–3.4 topic engine, holding pen, seed queue → Tasks 4, 12. §3.5 scanner rubric, thresholds, calibration → Tasks 4–5, 12. §4 stages, per-essay folder, runner, skills → Tasks 1, 3, 12–17. §5 gate order with Layer A last, binary verdict, held-at-gate email, cover rules incl. 700 px floor → Tasks 6–11, 16. §6 publish, mail (alias reply-to, In-Reply-To matching), Monday session, failure emails, kill switch, per-essay hold, cost logging → Tasks 2, 14–17. §7 rollout order and fixtures → task order and Tasks 10, 18. §8 out of scope respected. One deliberate simplification vs spec §4.2: corrections re-run Layer B on the whole file rather than only changed strings (Task 14) — safe, one Codex pass.

**Placeholder scan.** None. Every step has code or an exact command with expected output.

**Type consistency.** `runSkill` returns `{ result, json, cost_usd, session_id }` and is consumed that way in scan, plagiarism, brief, draft, cover, final. `saveState`/`loadState`/`addCost`/`essayDir` signatures match across Tasks 1, 12–16. `splitFrontmatter`/`joinFrontmatter` return/take `{ meta, body, order }` consistently. `runGate` returns `{ verdict, report, checks }` and is called with `{ inPath, outPath, reportPath, skipLayerB }` in Tasks 10, 14, 16. Stage names match `STAGES`.
