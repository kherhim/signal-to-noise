import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  sentences, alignSentences, describeChange, unpublishedShingles, leaks, per1k,
  vetItems, appendTells, applyRegister, runLearn, OWNER_MAX_PER_1K,
} from '../humaniser-learn.mjs';

// All text here is synthetic. Fixtures in this public repo never carry real
// gated drafting.

test('sentences drop frontmatter, headings, quotations and HTML', () => {
  const md = '---\ntitle: "T"\ndate: 2026-10-21\n---\n\n## A heading here\n\nThe firm spent money. It bought a mill in May.\n\n<svg><text>Chart label words</text></svg>\n\n> A quoted block from someone.\n\n- A list item with words.';
  assert.deepEqual(sentences(md), ['The firm spent money.', 'It bought a mill in May.', 'A list item with words.']);
});

test('the aligner anchors identical sentences and pairs edited ones in order', () => {
  const before = ['The firm spent money on mills.', 'The company acquired a rival in May.', 'This sentence was cut entirely by the owner.', 'Profit rose by a third.'];
  const after = ['The firm spent money on mills.', 'The company bought a rival in May.', 'Profit rose by a third.', 'A wholly new closing line appears.'];
  const a = alignSentences(before, after);
  assert.equal(a.same, 2);
  assert.deepEqual(a.changed.map((c) => [c.before, c.after]), [['The company acquired a rival in May.', 'The company bought a rival in May.']]);
  assert.deepEqual(a.removed, ['This sentence was cut entirely by the owner.']);
  assert.deepEqual(a.added, ['A wholly new closing line appears.']);
});

test('typography alone is not an edit', () => {
  const a = alignSentences(['It’s the “same” sentence, really.'], ["It's the \"same\" sentence really."]);
  assert.equal(a.same, 1);
  assert.equal(a.changed.length, 0);
});

test('describeChange shows changed words only, or describes a large rewrite', () => {
  assert.equal(describeChange('The company acquired a rival in May.', 'The company bought a rival in May.'), 'acquired → bought');
  assert.match(describeChange('Every single word of this draft sentence is entirely different now.', 'Nothing matches at all.'), /^sentence rewritten \(\d+ of \d+ words changed\)$/);
});

test('register rates are per 1,000 words, plurals included', () => {
  const corpus = ['expenditure '.repeat(1) + 'word '.repeat(999), 'expenditures ' + 'word '.repeat(999)];
  assert.equal(per1k('expenditure', corpus), 1);
  assert.equal(per1k('outlay', corpus), 0);
});

test('vetItems keeps only register pairs the owner actually made', () => {
  const pairs = [{ before: 'The company acquired a rival.', after: 'The company bought a rival.' }];
  const v = vetItems([{ pair: 0, class: 'tell', register: [{ formal: 'acquired', plain: 'bought' }, { formal: 'purchased', plain: 'bought' }] }, { pair: 9, class: 'tell' }], pairs);
  assert.deepEqual(v.register.map((r) => r.formal), ['acquired']);
  assert.equal(v.dropped.length, 2);
});

test('applyRegister adds learned pairs and drops the named ones', () => {
  const reg = { updated: '2026-10-01', note: 'n', pairs: [{ formal: 'utilise', plain: 'use', owner_per_1k: 0, line_per_1k: 1, source: 'seed' }, { formal: 'commence', plain: 'start', owner_per_1k: 0, line_per_1k: 1, source: 'seed' }] };
  const out = applyRegister(reg, { add: [{ formal: 'acquire', plain: 'buy', owner_per_1k: 0.1, line_per_1k: 2 }], drop: [{ formal: 'commence' }], today: '2026-10-26' });
  assert.deepEqual(out.pairs.map((p) => [p.formal, p.source]), [['utilise', 'seed'], ['acquire', 'learned']]);
  assert.equal(out.updated, '2026-10-26');
});

test('learned tells land before the closing JSON instruction', () => {
  const skill = '# Skill\n\n1. A tell.\n\nReturn only the JSON described by the schema.\n';
  const once = appendTells(skill, ['- **one**: rule one']);
  assert.ok(once.indexOf('## Learned tells') < once.indexOf('Return only the JSON'));
  const twice = appendTells(once, ['- **two**: rule two']);
  assert.equal(twice.match(/## Learned tells/g).length, 1);
  assert.ok(twice.indexOf('**two**') < twice.indexOf('Return only the JSON'));
  assert.ok(twice.indexOf('**one**') < twice.indexOf('**two**'));
});

test('the shingle filter catches a quoted draft run and passes published text', () => {
  const set = unpublishedShingles(['The quarterly expenditure envelope remains firmly under review.'], 'The firm spent money.');
  assert.equal(leaks('a rule that says the quarterly expenditure envelope remains firmly here', set), true);
  assert.equal(leaks('a rule about formal nouns standing in for verbs', set), false);
});

// ---------- the run, with git, gh, the model and notifications stubbed ----------

const SKILL = '# Essay line: humaniser read\n\n1. A tell.\n\nReturn only the JSON described by the schema.\n';
const SECRET = 'The quarterly expenditure envelope remains firmly under review by the board.';
const PUBLISHED = 'The quarterly spending remains under review by the board.';

function fixture({ ownerText = 'The owner writes plainly about money and mills. '.repeat(40), register = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'learn-root-'));
  const ins = path.join(root, 'src/content/insights');
  fs.mkdirSync(ins, { recursive: true });
  const shared = 'Cash came in late this year. Margins held up well enough.';
  fs.writeFileSync(path.join(ins, 'line-essay.md'), `---\ntitle: "Line"\ndate: 2026-10-21\ndraft: false\n---\n\n${shared} ${PUBLISHED} The company bought a rival in May.\n`);
  fs.writeFileSync(path.join(ins, 'owner-essay.md'), `---\ntitle: "Owner"\ndate: 2025-01-01\n---\n\n${ownerText}\n`);
  const staging = path.join(root, '_sources/staging-articles');
  fs.mkdirSync(path.join(staging, 'line-essay'), { recursive: true });
  fs.writeFileSync(path.join(staging, 'line-essay', 'gated.md'), `---\ntitle: "Line"\n---\n\n${shared} ${SECRET} The company acquired a rival in May.\n`);
  const base = { 'scripts/line/data/register.json': register ? JSON.stringify({ updated: '2026-10-01', note: 'n', pairs: [] }) : null, '.claude/skills/essay-line/humaniser/SKILL.md': SKILL };
  const calls = [];
  const sh = (cmd, args) => {
    calls.push([cmd, ...args]);
    if (args.includes('worktree') && args.includes('add')) {
      const wt = args[args.length - 2];
      for (const [rel, body] of Object.entries(base)) if (body !== null) { fs.mkdirSync(path.dirname(path.join(wt, rel)), { recursive: true }); fs.writeFileSync(path.join(wt, rel), body); }
      fs.cpSync(ins, path.join(wt, 'src/content/insights'), { recursive: true }); // origin/main has the essays
    }
    if (args.includes('worktree') && args.includes('remove')) fs.rmSync(args[args.length - 1], { recursive: true, force: true });
    if (cmd === 'gh') return 'https://github.com/example/repo/pull/7\n';
    return '';
  };
  const notes = [];
  const deps = (items) => ({
    sh, notify: (m) => notes.push(m), now: () => new Date('2026-10-26T07:45:00Z'),
    loadLedger: () => ({ published: [] }), loadNeverList: () => ['Axi'], loadConfig: () => ({ models: {} }),
    runSkill: () => ({ json: { items }, cost_usd: 0 }),
  });
  return { root, staging, calls, notes, deps };
}

const TELL_ITEMS = [
  // The model misbehaves: its rule quotes the unpublished draft.
  { pair: 0, class: 'tell', tell: 'Formal noun pile', rule: 'Flag phrases like the quarterly expenditure envelope remains firmly under review.' },
  { pair: 1, class: 'tell', register: [{ formal: 'acquired', plain: 'bought' }], tell: 'Deal-room verbs', rule: 'Flag formal deal verbs where a plain verb says the same thing.' },
];

function proposalsIn(calls, root) {
  const wtAdd = calls.find((c) => c.includes('worktree') && c.includes('add'));
  return { wt: wtAdd[wtAdd.length - 2], root };
}

test('privacy: unpublished before-text never reaches the proposals file, the PR or the skill', () => {
  const f = fixture();
  const r = runLearn({ root: f.root, staging: f.staging, deps: f.deps(TELL_ITEMS) });
  assert.equal(r.pr, 'https://github.com/example/repo/pull/7');
  const out = [r.md, ...f.calls.flat()].join('\n');
  assert.ok(!out.includes(SECRET));
  assert.equal(leaks(out, unpublishedShingles([SECRET], PUBLISHED)), false);
  assert.match(r.md, /withheld tell/);                       // the leaking tell was rejected
  assert.match(r.md, /Deal-room verbs/);                      // the clean one survives
  assert.ok(r.md.includes(`"${PUBLISHED}"`));                 // the published sentence may be quoted
  assert.ok(!/\bAxi\b/.test(out));
  // Applied on the branch, never merged, worktree cleaned up.
  const commit = f.calls.find((c) => c.includes('commit'));
  assert.ok(commit);
  assert.ok(!f.calls.some((c) => c.includes('merge')));
  assert.ok(f.calls.some((c) => c.includes('worktree') && c.includes('remove')));
  assert.equal(fs.existsSync(proposalsIn(f.calls).wt), false);
  assert.match(f.notes[0], /pull\/7/);
});

test('owner-rate rejection: a formal word the owner uses often is not proposed', () => {
  const f = fixture({ ownerText: 'We acquired a mill and acquired a fleet. '.repeat(40) });
  const r = runLearn({ root: f.root, staging: f.staging, deps: f.deps([TELL_ITEMS[1]]) });
  assert.match(r.md, /## Rejected candidates[\s\S]*acquired → bought: owner uses it/);
  assert.ok(!/### Register additions/.test(r.md));
  assert.ok(Number(r.md.match(/owner uses it ([\d.]+)/)[1]) > OWNER_MAX_PER_1K);
});

test('no proposals: the file says so, no branch is pushed and no PR opened', () => {
  const f = fixture();
  const r = runLearn({ root: f.root, staging: f.staging, deps: f.deps([{ pair: 0, class: 'taste' }, { pair: 1, class: 'fact' }]) });
  assert.equal(r.pr, null);
  assert.equal(r.count, 0);
  assert.ok(!f.calls.some((c) => c[0] === 'gh' || c.includes('push') || c.includes('commit')));
  assert.ok(f.calls.some((c) => c.includes('branch') && c.includes('-D')));
  const file = fs.readFileSync(path.join(f.root, 'distribution/line/humaniser-proposals/2026-10-26.md'), 'utf8');
  assert.match(file, /Nothing to propose\. No PR opened\./);
  assert.ok(!file.includes(SECRET));
  // A second run skips the essay it has already learned from.
  const again = runLearn({ root: f.root, staging: f.staging, deps: f.deps([]) });
  assert.match(again.md, /already learned from/);
});

test('a dry run calls no model, git or gh and writes nothing', () => {
  const f = fixture();
  let modelCalls = 0;
  const deps = { ...f.deps([]), runSkill: () => { modelCalls++; return { json: { items: [] } }; } };
  const r = runLearn({ dry: true, root: f.root, staging: f.staging, deps });
  assert.equal(modelCalls, 0);
  assert.equal(f.calls.length, 0);
  assert.match(r.md, /Dry run/);
  assert.equal(fs.existsSync(path.join(f.root, 'distribution/line/humaniser-proposals')), false);
  assert.ok(!r.md.includes(SECRET));
});

test('register.json missing on main: additions are listed but not applied', () => {
  const f = fixture({ register: false });
  const r = runLearn({ root: f.root, staging: f.staging, deps: f.deps([TELL_ITEMS[1]]) });
  assert.match(r.md, /NOT applied/);
  const add = f.calls.find((c) => c.includes('add') && !c.includes('worktree'));
  assert.ok(!add.includes('scripts/line/data/register.json'));
});

test('register words in base form match their regular inflections', () => {
  const pairs = [{ before: 'They purchased a rival and were utilising cash.', after: 'They bought a rival and were using cash.' }];
  const v = vetItems([{ pair: 0, class: 'tell', register: [{ formal: 'purchase', plain: 'bought' }, { formal: 'utilise', plain: 'use' }] }], pairs);
  assert.deepEqual(v.register.map((r) => r.formal), ['purchase', 'utilise']);
  assert.equal(per1k('purchase', ['purchases purchased purchasing ' + 'word '.repeat(997)]), 3);
  assert.equal(per1k('purchase', ['purchaser ' + 'word '.repeat(999)]), 0);
});
