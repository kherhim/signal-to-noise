#!/usr/bin/env bash
# Export everything signal2noise needs that git does not carry, as ONE encrypted file,
# for moving to a new Mac via Google Drive. The repo itself is never in the bundle:
# the new Mac clones it from GitHub. See infra/MIGRATION.md.
#
#   infra/migrate-export.sh [-o OUTPUT_FILE]
#
# Run it in Terminal.app, not through an agent: it asks for a passphrase twice.
# S2N_BUNDLE_PASS in the environment skips the prompt (used by the self-test only).

set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d)"
OUT="$HOME/Desktop/s2n-bundle-$STAMP.tar.gz.enc"
while getopts "o:" opt; do
  case "$opt" in
    o) OUT="$OPTARG" ;;
    *) echo "usage: $0 [-o OUTPUT_FILE]" >&2; exit 2 ;;
  esac
done

# Claude Code keys its project memory by the repo's absolute path, every
# non-alphanumeric character replaced with "-".
MEMKEY="$(printf '%s' "$REPO" | sed 's/[^A-Za-z0-9]/-/g')"
MEMDIR="$HOME/.claude/projects/$MEMKEY/memory"

# Repo-relative paths that git ignores (or that are deliberately untracked).
REPO_ITEMS=(
  .env
  _sources
  distribution/autopilot/PAUSE
  distribution/autopilot/log.md
  docs/superpowers/specs/2026-09-21-typesafe-judgement-opportunities.md
  .claude/settings.local.json
  .superpowers
)

echo "==> Checking git is level with GitHub"
cd "$REPO"
git fetch -q origin
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "WARN: tracked files have uncommitted changes; commit and push them first, or they stay behind." >&2
fi
if [ "$(git rev-parse HEAD)" != "$(git rev-parse '@{u}')" ]; then
  echo "WARN: local $(git rev-parse --abbrev-ref HEAD) differs from GitHub; push before you clone on the new Mac." >&2
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/repo" "$STAGE/home"

echo "==> Collecting repo files git does not carry"
for item in "${REPO_ITEMS[@]}"; do
  if [ -e "$REPO/$item" ]; then
    mkdir -p "$STAGE/repo/$(dirname "$item")"
    cp -Rp "$REPO/$item" "$STAGE/repo/$item"
    echo "    + $item"
  else
    echo "    - $item (not present, skipped)"
  fi
done

echo "==> Collecting home-directory files"
if [ -d "$MEMDIR" ]; then
  mkdir -p "$STAGE/home/claude-memory"
  cp -Rp "$MEMDIR/." "$STAGE/home/claude-memory/"
  echo "    + Claude Code project memory ($(ls "$MEMDIR" | wc -l | tr -d ' ') files)"
fi
if [ -f "$HOME/.codex/config.toml" ]; then
  cp -p "$HOME/.codex/config.toml" "$STAGE/home/codex-config.toml"
  echo "    + ~/.codex/config.toml (settings only; sign in to Codex again on the new Mac)"
fi

{
  echo "created=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "source_repo=$REPO"
  echo "source_user=$(id -un)"
  echo "source_commit=$(git rev-parse HEAD)"
  echo "memory_key=$MEMKEY"
} > "$STAGE/BUNDLE-INFO"
find "$STAGE" -name .DS_Store -delete
(cd "$STAGE" && find repo home -type f -print0 | sort -z | xargs -0 shasum -a 256 > MANIFEST.sha256)

echo "==> Encrypting (AES-256-CBC, PBKDF2)"
mkdir -p "$(dirname "$OUT")"
PASSARG=()
if [ -n "${S2N_BUNDLE_PASS:-}" ]; then PASSARG=(-pass env:S2N_BUNDLE_PASS); fi
COPYFILE_DISABLE=1 tar --no-xattrs -czf - -C "$STAGE" . \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt ${PASSARG[@]+"${PASSARG[@]}"} -out "$OUT"
chmod 600 "$OUT"

echo
echo "Bundle: $OUT ($(du -h "$OUT" | cut -f1))"
echo "SHA-256: $(shasum -a 256 "$OUT" | cut -d' ' -f1)"
echo "Upload it to Google Drive. Keep the passphrase OUT of Drive, mail and chat."
