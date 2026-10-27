# Moving signal2noise to a new Mac

The code comes from GitHub. Everything git deliberately does not carry travels as one
encrypted bundle: `.env`, `_sources/`, the essay-line `PAUSE` file and log, local-only
specs, Claude Code's project memory and the Codex settings. Never copy the repo folder
itself across, and never put the bundle's passphrase in Drive, mail or chat.

## Before you start (new Mac)

- Create the macOS account with the **same username** (`himanshu.kher`) if you can, and
  clone to the **same path** (`~/Documents/devProjects/signal2noise`). Claude Code files
  its project memory under the repo's absolute path, and the memory notes name paths.
- Install Homebrew, then `brew install node git gh google-cloud-sdk`.

## 1. Old Mac: make the bundle

```sh
cd ~/Documents/devProjects/signal2noise
git status && git push            # local must be level with GitHub
infra/migrate-export.sh           # asks for a passphrase twice
```

It writes `~/Desktop/s2n-bundle-YYYYMMDD.tar.gz.enc` and prints its SHA-256. Upload the
file to Google Drive and note the SHA-256.

## 2. New Mac: clone and sign in

```sh
gh auth login                     # GitHub; choose HTTPS, as this Mac uses
mkdir -p ~/Documents/devProjects && cd ~/Documents/devProjects
git clone https://github.com/kherhim/signal-to-noise.git signal2noise && cd signal2noise
npm ci
```

Sign in again (none of these logins travel in the bundle):

- Claude Code: `claude`, then log in with the same claude.ai account.
- Codex: `npm i -g @openai/codex`, then `codex login`.
- Google Cloud: `gcloud auth login`, then `gcloud config set project signal2noise-prod`.
- Chrome: install the Claude extension, sign it in to claude.ai, and sign in to LinkedIn.

## 3. New Mac: unpack the bundle

Download the bundle from Drive, check `shasum -a 256 <file>` matches, then:

```sh
infra/migrate-import.sh ~/Downloads/s2n-bundle-YYYYMMDD.tar.gz.enc
```

It never overwrites an existing file, restores `.env` as owner-only, and always leaves
`distribution/autopilot/PAUSE` in place so the essay line stays off.

## 4. New Mac: prove it works

```sh
npm run test:line                 # expect all pass, 1 skipped
npm run build                     # site builds, search index written
gcloud compute ssh s2n-web --zone=us-central1-a --tunnel-through-iap --command='echo OK'
```

The ssh test makes gcloud create and register this Mac's SSH key. Do not run
`./deploy.sh` until there is something to publish.

## 5. Cut over the scheduled jobs

Three jobs are live: the Monday 07:30 metrics pull, the Monday 07:45 humaniser
learn and the Tuesday 19:00 essay audio (run `scripts/audio/setup.sh` on the new
Mac first, to build the narration venv), which needs `claude`, `gh auth status` and git push working on the new Mac
(the essay line and the watermarks container were retired on 12 Oct 2026). Stop
them on the old Mac **first**, then start them on the new:

```sh
infra/migrate-agents.sh --stop    # on the OLD Mac
infra/migrate-agents.sh           # on the NEW Mac: rewrites paths for this Mac, then loads them
```

## 6. Afterwards

- Delete the bundle from Drive and from both Downloads and Desktop.
- Keep the old Mac's copy until one full publish week has run from the new one.
