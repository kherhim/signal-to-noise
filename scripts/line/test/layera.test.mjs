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
