import test from 'node:test';
import assert from 'node:assert/strict';
import { score, actionFor, renderBoard, topScore, filterNeverList, scan, mergeProposals, PROPOSALS_HEADING } from '../scan.mjs';

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

test('topScore is the maximum regardless of order', () => {
  assert.equal(topScore([{ score: 40 }, { score: 85.5 }, { score: 70 }]), 85.5);
  assert.equal(topScore([]), 0);
});

test('filterNeverList checks every string field, with word boundaries', () => {
  const items = [
    { headline: 'A', note: 'n', maps_to: '', proposed_title: 'Axi and the CFO', source: 'x', url: 'u' },
    { headline: 'B', note: 'n', maps_to: '', proposed_title: '', source: 'Axios', url: 'u' },
  ];
  assert.deepEqual(filterNeverList(items, ['Axi']).map((i) => i.headline), ['B']);
});

test('scan({ dry: true }) returns null and never calls the model (no spend)', async () => {
  const board = await scan({ dry: true });
  assert.equal(board, null);
});

const IDEAS = '# Article ideas\n\n## Sequels\n\n| Idea | Angle | Axes | Status |\n|---|---|---|---|\n| The broken rung | Apprenticeships | B E | idea |\n';

test('mergeProposals creates the section and adds only items above the threshold with a proposed title', () => {
  const items = [
    { proposed_title: 'Two banks, one start line', headline: 'JPM beats', url: 'https://x/1', score: 78 },
    { proposed_title: 'Too quiet to matter', headline: 'Small story', url: 'https://x/2', score: 40 },
    { proposed_title: '', headline: 'No title', url: 'https://x/3', score: 90 },
    { headline: 'No field at all', url: 'https://x/4', score: 95 },
  ];
  const out = mergeProposals(IDEAS, items, 70);
  assert.ok(out.includes(PROPOSALS_HEADING));
  assert.match(out, /^\| Two banks, one start line \| JPM beats — https:\/\/x\/1 \| scanner \| idea \|$/m);
  assert.doesNotMatch(out, /Too quiet to matter/);
  assert.doesNotMatch(out, /No title|No field at all/);
  assert.ok(out.startsWith('# Article ideas'), 'the existing file is preserved ahead of the new section');
  assert.match(out, /\| The broken rung \|/, 'existing rows survive');
});

test('mergeProposals is a no-op when nothing clears the bar', () => {
  assert.equal(mergeProposals(IDEAS, [{ proposed_title: 'Low', headline: 'h', url: 'u', score: 12 }], 70), IDEAS);
  assert.equal(mergeProposals(IDEAS, [], 70), IDEAS);
});

test('mergeProposals dedupes by title — against the backlog and within one board', () => {
  const first = mergeProposals(IDEAS, [{ proposed_title: 'Two banks, one start line', headline: 'JPM beats', url: 'https://x/1', score: 78 }], 70);
  const again = mergeProposals(first, [{ proposed_title: 'Two banks, one start line', headline: 'Citi misses', url: 'https://x/9', score: 88 }], 70);
  assert.equal(again, first, 'a title already proposed is never added twice');
  assert.equal(mergeProposals(IDEAS, [{ proposed_title: 'The broken rung', headline: 'h', url: 'u', score: 90 }], 70), IDEAS,
    'a title already in the backlog is never proposed');
  const twice = mergeProposals(IDEAS, [
    { proposed_title: 'One idea', headline: 'a', url: 'https://x/a', score: 90 },
    { proposed_title: 'one idea', headline: 'b', url: 'https://x/b', score: 91 },
  ], 70);
  assert.equal(twice.match(/\| One idea \|/gi).length, 1, 'case-insensitive within a single board too');
});

// A headline is scraped from the wild and a proposed title is model output; a
// literal pipe in either would split the row into phantom columns and silently
// corrupt every row below it in the rendered backlog.
test('mergeProposals escapes a pipe in the title and the headline so the table survives', () => {
  const out = mergeProposals(IDEAS, [
    { proposed_title: 'Cost | benefit', headline: 'Bank posts £2bn | analysts split', url: 'https://x/1', score: 90 },
  ], 70);
  assert.match(out, /^\| Cost \\\| benefit \| Bank posts £2bn \\\| analysts split — https:\/\/x\/1 \| scanner \| idea \|$/m);
  const row = out.split('\n').find((l) => l.includes('Cost'));
  assert.equal(row.split(/(?<!\\)\|/).length - 1, 5, 'four columns and the two end pipes, not seven');
});

test('mergeProposals dedupes a pipe-bearing title against the row it already wrote', () => {
  const item = { proposed_title: 'Cost | benefit', headline: 'h', url: 'https://x/1', score: 90 };
  const first = mergeProposals(IDEAS, [item], 70);
  assert.equal(mergeProposals(first, [{ ...item, headline: 'different' }], 70), first,
    'the escaped row must still be recognised as already listed');
});

test('mergeProposals inserts the table header when the section exists without one', () => {
  const headless = `${IDEAS}\n${PROPOSALS_HEADING}\n\nSome prose and no table at all.\n\n## Later section\n\nKeep me.\n`;
  const out = mergeProposals(headless, [{ proposed_title: 'Newer proposal', headline: 'h2', url: 'https://x/2', score: 90 }], 70);
  assert.match(out, /\| Idea \| Angle \| Axes \| Status \|\n\|---\|---\|---\|---\|\n\| Newer proposal \|/,
    'the row is never orphaned under a headerless section');
  assert.ok(out.indexOf('Some prose and no table at all.') < out.lastIndexOf('| Idea | Angle | Axes | Status |'),
    'the inserted header sits below the prose the section already had');
  assert.ok(out.indexOf('| Newer proposal |') < out.indexOf('## Later section'));
  assert.match(out, /Keep me\.\n$/);
});

test('mergeProposals adds no second header when the section already has one', () => {
  const first = mergeProposals(IDEAS, [{ proposed_title: 'One idea', headline: 'a', url: 'https://x/a', score: 90 }], 70);
  const again = mergeProposals(first, [{ proposed_title: 'Two idea', headline: 'b', url: 'https://x/b', score: 90 }], 70);
  assert.equal(again.match(/\| Idea \| Angle \| Axes \| Status \|/g).length, 2,
    'one header in the Sequels table, one in the proposals table — the round trip adds none');
  assert.ok(again.indexOf('| One idea |') < again.indexOf('| Two idea |'));
});

test('mergeProposals appends into an existing section and leaves later sections alone', () => {
  const withSection = `${IDEAS}\n${PROPOSALS_HEADING}\n\n| Idea | Angle | Axes | Status |\n|---|---|---|---|\n| Older proposal | h — u | scanner | idea |\n\n## Later section\n\nKeep me.\n`;
  const out = mergeProposals(withSection, [{ proposed_title: 'Newer proposal', headline: 'h2', url: 'https://x/2', score: 90 }], 70);
  assert.equal(out.match(new RegExp(PROPOSALS_HEADING, 'g')).length, 1, 'one section, not two');
  assert.ok(out.indexOf('| Older proposal |') < out.indexOf('| Newer proposal |'));
  assert.ok(out.indexOf('| Newer proposal |') < out.indexOf('## Later section'));
  assert.match(out, /Keep me\.\n$/);
});
