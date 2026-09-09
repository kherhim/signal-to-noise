// scripts/line/proc.mjs
// One place where every child process the line spawns gets a wall-clock budget.
// A wedged `claude`, `codex`, `npm run build` or `git push` would otherwise hang
// a launchd wake for ever and stall the whole week silently.
import { spawnSync } from 'node:child_process';

const MS_PER_MINUTE = 60000;

// Minutes, per kind of child. Generous enough for the slowest honest run,
// short enough that a hung child is caught inside one wake.
export const TIMEOUTS = { claude: 25, codex: 15, publish: 20, cover: 10, git: 2 };

export const timeoutMessage = (label, timeoutMin) => `${label} timed out after ${timeoutMin} min`;

// spawnSync signals a timeout with error.code ETIMEDOUT (and status null,
// signal SIGTERM). Every caller checks `status !== 0`, which would report the
// kill as an ordinary non-zero exit; this turns it into an honest message.
export function runChild(cmd, args, opts = {}, { timeoutMin, label = cmd } = {}) {
  const r = spawnSync(cmd, args, { ...opts, timeout: Math.round(timeoutMin * MS_PER_MINUTE) });
  // ETIMEDOUT only: a child killed by something else (an OOM kill, a manual
  // SIGKILL) also comes back with status null and a signal, and calling that a
  // timeout would send the owner looking in the wrong place.
  if (r.error?.code === 'ETIMEDOUT') throw new Error(timeoutMessage(label, timeoutMin));
  return r;
}
