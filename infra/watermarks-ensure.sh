#!/bin/sh
# Keep the watermarks-remover service (Layer A) up without anyone touching it.
# Run by the co.signal-to-noise.watermarks LaunchAgent at login and every 30 min.
#  1. start Docker Desktop in the background if its daemon is not answering
#  2. start the wr-core container (restart: unless-stopped keeps it up after that);
#     if the container no longer exists, recreate it with docker compose
#  3. report the health endpoint the essay line probes
#
# INSTALL: launchd runs this through /bin/sh, and macOS denies system binaries
# access to ~/Documents, so the plist points at an installed copy:
#   mkdir -p ~/Library/Application\ Support/signal2noise
#   cp infra/watermarks-ensure.sh ~/Library/Application\ Support/signal2noise/
# Re-copy after editing this file.
set -u
PATH=/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin
PROJECT="$HOME/Documents/devProjects/watermarks-remover"
CONTAINER="watermarks-remover-wr-core-1"
HEALTH="http://127.0.0.1:8765/health"
stamp() { date -u '+%Y-%m-%d %H:%M:%SZ'; }
# Another process may hold the port (a stray `python -m http.server 8765` was
# seen answering 404s here), so a reply alone is not health: require the JSON.
healthy() { curl -sf -m 3 "$HEALTH" 2>/dev/null | grep -q '"ok": *true'; }

if healthy; then
  echo "$(stamp)  ok: service already answering"
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  echo "$(stamp)  docker daemon down; starting Docker Desktop"
  open -g -a Docker || { echo "$(stamp)  ERROR: could not open Docker Desktop"; exit 1; }
  i=0
  until docker info >/dev/null 2>&1; do
    i=$((i+1)); [ "$i" -ge 60 ] && { echo "$(stamp)  ERROR: docker daemon not up after 180s"; exit 1; }
    sleep 3
  done
fi

if docker start "$CONTAINER" >/dev/null 2>&1; then
  echo "$(stamp)  started container $CONTAINER"
else
  echo "$(stamp)  container $CONTAINER missing; recreating with docker compose"
  cd "$PROJECT" || { echo "$(stamp)  ERROR: missing $PROJECT"; exit 1; }
  if ! docker compose up -d --no-build wr-core >/dev/null 2>&1; then
    echo "$(stamp)  ERROR: docker compose up wr-core failed"; exit 1
  fi
fi

i=0
until healthy; do
  i=$((i+1)); [ "$i" -ge 20 ] && { echo "$(stamp)  ERROR: wr-core up but $HEALTH not answering after 60s"; exit 1; }
  sleep 3
done
echo "$(stamp)  ok: wr-core started, health answering"
