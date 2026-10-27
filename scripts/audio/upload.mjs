// Upload narrated m4a files to the web VM. Never deletes anything.
// VM, ZONE and project mirror deploy.sh.
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

const PROJECT = 'signal2noise-prod';
const ZONE = 'us-central1-a';
const VM = 's2n-web';
const DEST = '/var/www/signal-to-noise/audio/';
const env = { ...process.env, CLOUDSDK_CORE_PROJECT: PROJECT };
const run = (args) => execFileSync('gcloud', args, { stdio: 'inherit', env });

export async function uploadFiles(paths) {
  for (const p of paths) {
    const name = basename(p);
    run(['compute', 'scp', `--zone=${ZONE}`, '--tunnel-through-iap', p, `${VM}:/tmp/${name}`]);
    run([
      'compute', 'ssh', VM, `--zone=${ZONE}`, '--tunnel-through-iap',
      `--command=sudo install -m 644 -t ${DEST} /tmp/${name} && rm /tmp/${name}`,
    ]);
  }
}
