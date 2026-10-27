import { narrationScript, scriptHash } from './narration.mjs';
import pron from '../../scripts/audio/pronunciations.json' with { type: 'json' };

/* Returns the narration entry for a slug only while it still matches the
   published text; a stale entry hides the player until re-narrated. */
export function audioFor(slug, body, all, warn = console.warn) {
  const entry = all[slug];
  if (!entry) return null;
  if (entry.hash !== scriptHash(narrationScript(body, pron).items)) {
    warn(`[audio] ${slug}: text changed since narration; player hidden until re-narrated`);
    return null;
  }
  return entry;
}
