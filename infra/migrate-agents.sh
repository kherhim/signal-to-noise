#!/usr/bin/env bash
# Install the scheduled jobs on THIS Mac, with this Mac's home, repo path and node.
# Live: the weekly metrics pull and the weekly humaniser learn (proposals PR, never
# merges). The essay line (killed 12 Oct 2026) and the watermarks container
# (retired 12 Oct 2026) are deliberately not installed.
#
#   infra/migrate-agents.sh            install and load the live agents
#   infra/migrate-agents.sh --stop     unload every signal2noise agent (run on the OLD Mac first)

set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
AGENTS="$HOME/Library/LaunchAgents"
DOMAIN="gui/$(id -u)"

if [ "${1:-}" = "--stop" ]; then
  for plist in "$AGENTS"/co.signal-to-noise.*.plist; do
    [ -e "$plist" ] || continue
    label="$(basename "$plist" .plist)"
    launchctl bootout "$DOMAIN/$label" 2>/dev/null && echo "stopped $label" || echo "$label was not loaded"
    mv "$plist" "$plist.disabled"
  done
  echo "All signal2noise agents unloaded here (plists renamed *.disabled)."
  exit 0
fi

NODE="$(command -v node || true)"
[ -n "$NODE" ] || { echo "node is not on PATH; install it first (brew install node)" >&2; exit 1; }
[ -f "$REPO/.env" ] || { echo "No .env in $REPO; run infra/migrate-import.sh first" >&2; exit 1; }

mkdir -p "$AGENTS" "$HOME/Library/Logs"
# label suffix and when it runs, for the closing message
for job in "metrics:Mondays 07:30" "humaniser-learn:Mondays 07:45"; do
  label="co.signal-to-noise.${job%%:*}"
  # The repo copy names the old Mac's paths; rewrite them for this one.
  sed -e "s#/Users/himanshu.kher/Documents/devProjects/signal2noise#$REPO#g" \
      -e "s#/opt/homebrew/bin/node#$NODE#g" \
      -e "s#/Users/himanshu.kher#$HOME#g" \
      "$REPO/infra/$label.plist" > "$AGENTS/$label.plist"
  plutil -lint "$AGENTS/$label.plist" >/dev/null
  launchctl bootout "$DOMAIN/$label" 2>/dev/null || true
  launchctl bootstrap "$DOMAIN" "$AGENTS/$label.plist"
  echo "Loaded $label (${job#*:}) using $NODE"
  launchctl print "$DOMAIN/$label" | grep -E 'state|program' | head -3
done
