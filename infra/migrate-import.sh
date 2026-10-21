#!/usr/bin/env bash
# Unpack a bundle made by infra/migrate-export.sh into a fresh clone on the new Mac.
# Never overwrites an existing file: anything already present is left alone and reported.
# Does NOT install any LaunchAgent; that is infra/migrate-agents.sh, run last.
#
#   cd ~/Documents/devProjects/signal2noise && infra/migrate-import.sh ~/Downloads/s2n-bundle-YYYYMMDD.tar.gz.enc
#
# Run it in Terminal.app: it asks for the passphrase.

set -euo pipefail

BUNDLE="${1:?usage: $0 BUNDLE_FILE}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
MEMKEY="$(printf '%s' "$REPO" | sed 's/[^A-Za-z0-9]/-/g')"
MEMDIR="$HOME/.claude/projects/$MEMKEY/memory"

[ -f "$BUNDLE" ] || { echo "No such bundle: $BUNDLE" >&2; exit 1; }
git -C "$REPO" rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "$REPO is not a git clone" >&2; exit 1; }

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "==> Decrypting"
PASSARG=()
if [ -n "${S2N_BUNDLE_PASS:-}" ]; then PASSARG=(-pass env:S2N_BUNDLE_PASS); fi
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 ${PASSARG[@]+"${PASSARG[@]}"} -in "$BUNDLE" -out "$STAGE/bundle.tgz" 2>/dev/null \
  || { echo "Could not decrypt: wrong passphrase, or not a signal2noise bundle" >&2; exit 1; }
tar -xzf "$STAGE/bundle.tgz" -C "$STAGE" && rm "$STAGE/bundle.tgz"

echo "==> Verifying contents"
(cd "$STAGE" && shasum -a 256 -c -s MANIFEST.sha256) || { echo "Checksum mismatch: bundle is damaged" >&2; exit 1; }
cat "$STAGE/BUNDLE-INFO" | sed 's/^/    /'
OLDKEY="$(sed -n 's/^memory_key=//p' "$STAGE/BUNDLE-INFO")"
if [ "$OLDKEY" != "$MEMKEY" ]; then
  echo "NOTE: the repo path differs from the old Mac. Memory goes under the new path's key;"
  echo "      absolute paths inside the memory notes will still name the old location."
fi

SKIPPED=0
# Copy every file from $1 to $2, never replacing a file that already exists.
place() {
  local src="$1" dest="$2"
  (cd "$src" && find . -type f) | while read -r f; do
    f="${f#./}"
    if [ -e "$dest/$f" ]; then
      echo "    = $f (already present, left alone)"
      echo x >> "$STAGE/.skipped"
    else
      mkdir -p "$dest/$(dirname "$f")"
      cp -p "$src/$f" "$dest/$f"
    fi
  done
}

echo "==> Restoring repo files git does not carry"
place "$STAGE/repo" "$REPO"
[ -f "$REPO/.env" ] && chmod 600 "$REPO/.env"
echo "    done ($(cd "$STAGE/repo" && find . -type f | wc -l | tr -d ' ') files in bundle)"

# The essay line must arrive switched off whatever the bundle says.
mkdir -p "$REPO/distribution/autopilot"
[ -f "$REPO/distribution/autopilot/PAUSE" ] || : > "$REPO/distribution/autopilot/PAUSE"
echo "    PAUSE present: the essay line stays off"

if [ -d "$STAGE/home/claude-memory" ]; then
  echo "==> Restoring Claude Code project memory to $MEMDIR"
  mkdir -p "$MEMDIR"
  place "$STAGE/home/claude-memory" "$MEMDIR"
fi

if [ -f "$STAGE/home/codex-config.toml" ]; then
  mkdir -p "$HOME/.codex"
  if [ -e "$HOME/.codex/config.toml" ]; then
    cp -p "$STAGE/home/codex-config.toml" "$HOME/.codex/config.toml.from-old-mac"
    echo "==> ~/.codex/config.toml exists; old settings saved beside it as config.toml.from-old-mac"
  else
    cp -p "$STAGE/home/codex-config.toml" "$HOME/.codex/config.toml"
    echo "==> Restored ~/.codex/config.toml"
  fi
fi

[ -f "$STAGE/.skipped" ] && SKIPPED="$(wc -l < "$STAGE/.skipped" | tr -d ' ')"
echo
echo "Import finished. Files left alone because they already existed: $SKIPPED"
echo "Next: the sign-ins and checks in infra/MIGRATION.md, then infra/migrate-agents.sh last."
