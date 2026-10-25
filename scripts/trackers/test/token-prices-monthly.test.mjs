import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMonthly, prBody } from '../token-prices-monthly.mjs';

const fakeDeps = (over = {}) => {
  const calls = [], notes = [];
  return {
    calls, notes,
    deps: {
      now: () => new Date('2026-11-01T08:00:00Z'),
      notify: (m) => notes.push(m),
      sh: (cmd, args) => {
        calls.push([cmd, ...args].join(' '));
        if (over.sh) { const r = over.sh(cmd, args); if (r !== undefined) return r; }
        if (cmd === 'gh') return 'https://github.com/x/y/pull/9\n';
        if (cmd === 'node') return 'OpenAI  flagship $2/$10 ($4.00)\n\nwrote snapshots/2026-11.json\n';
        return '';
      },
    },
  };
};

test('opens a PR for the month and never merges', () => {
  const f = fakeDeps();
  const r = runMonthly({ root: '/repo', deps: f.deps });
  assert.equal(r.pr, 'https://github.com/x/y/pull/9');
  assert.ok(f.calls.some((c) => c.includes('worktree add -q -b token-prices-2026-11')));
  assert.ok(f.calls.some((c) => c.startsWith('git') && c.includes('snapshots/2026-11.json')));
  assert.ok(!f.calls.some((c) => c.includes('pr merge')));
  assert.ok(f.calls.at(-2).includes('worktree remove'));
  assert.match(f.notes[0], /pull\/9/);
});

test('refuses a second run in the same month', () => {
  const f = fakeDeps({ sh: (cmd, args) => (args.includes('ls-remote') ? 'abc refs/heads/token-prices-2026-11' : undefined) });
  assert.throws(() => runMonthly({ root: '/repo', deps: f.deps }), /already exists/);
  assert.match(f.notes[0], /failed/);
});

test('PR body asks for a lineup review only when the run warned', () => {
  assert.match(prBody('2026-11', 'x\n'), /No lineup warnings/);
  assert.match(prBody('2026-11', 'Newer than the lineup (review lineup.json):\n  OpenAI: openai/gpt-7\n'), /Lineup review needed/);
});
