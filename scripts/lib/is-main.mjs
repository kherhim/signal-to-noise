import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * True when the module at `importMetaUrl` is the process entry file.
 * Compares real paths, so a symlinked directory (macOS /var vs /private/var)
 * does not make a script exit 0 having done nothing.
 */
export function isMain(importMetaUrl, argv1) {
  if (!argv1) return false;
  try {
    return fs.realpathSync(argv1) === fs.realpathSync(fileURLToPath(importMetaUrl));
  } catch {
    return false;
  }
}
