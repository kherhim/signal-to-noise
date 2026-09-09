#!/usr/bin/env node
// One-shot: remove the autopilot PAUSE file, then wake the essay-line runner so
// a wake that fired in the same instant (Mac asleep through the schedule, both
// jobs fire together on wake) cannot have seen PAUSE and gone back to sleep.
// Afterwards unload and delete the LaunchAgent that ran this, so it fires once.
//
//   node infra/unpause.mjs          # do it
//   node infra/unpause.mjs --dry    # say what would happen
//
// Schedule: copy infra/co.signal-to-noise.unpause.plist to ~/Library/LaunchAgents
// and `launchctl bootstrap gui/$(id -u) <plist>`; the plist holds the date.
// Node, not /bin/sh, because launchd's system binaries are barred from ~/Documents.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const PAUSE = path.join(ROOT, 'distribution', 'autopilot', 'PAUSE');
const LABEL = 'co.signal-to-noise.unpause';
const PLIST = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const DRY = process.argv.includes('--dry');
const uid = process.getuid();
const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z';
const say = (m) => console.log(`${stamp()}  ${DRY ? 'DRY ' : ''}${m}`);
const run = (cmd, args) => (DRY ? say(`would run: ${cmd} ${args.join(' ')}`) : spawnSync(cmd, args, { stdio: 'ignore' }));

if (fs.existsSync(PAUSE)) {
  if (!DRY) fs.rmSync(PAUSE);
  say(`${DRY ? "would remove" : "removed"} ${path.relative(ROOT, PAUSE)} — the line is live`);
} else say('PAUSE already absent');

run('/bin/launchctl', ['kickstart', `gui/${uid}/co.signal-to-noise.essay-line`]);
say(`${DRY ? "would kick" : "kicked"} the essay-line runner`);

if (fs.existsSync(PLIST)) {
  if (!DRY) fs.rmSync(PLIST);
  say(`deleted ${PLIST} (one-shot)`);
}
// Unloading ourselves ends this process; everything above is already done.
run('/bin/launchctl', ['bootout', `gui/${uid}/${LABEL}`]);
