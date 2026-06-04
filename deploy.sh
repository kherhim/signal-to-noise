#!/usr/bin/env bash
# Deploy signal-to-noise.co.
# Assumes a fresh `dist/` already built locally.
# All commands routed through IAP because the public SSH firewall is closed.

set -euo pipefail

ZONE="us-central1-a"
VM="s2n-web"
STAGE="/tmp/s2n-dist"
WEBROOT="/var/www/signal-to-noise/dist/"

echo "==> Step 0/3: scrub macOS detritus from local dist/"
# Finder drops .DS_Store into any browsed directory; Astro copies public/
# into dist/ verbatim, so these can hitchhike to production. Strip them
# locally before upload, and double-belt with --exclude on the final
# rsync in case any slip through the staging step.
find dist -name .DS_Store -type f -delete

echo "==> Step 1/3: reset staging dir on VM ($STAGE)"
gcloud compute ssh "$VM" --zone="$ZONE" --tunnel-through-iap \
  --command="rm -rf $STAGE && mkdir $STAGE && echo STAGED_OK"

echo "==> Step 2/3: copy local dist/ to VM staging"
gcloud compute scp --recurse --zone="$ZONE" --tunnel-through-iap \
  dist/* "$VM:$STAGE/"

echo "==> Step 3/3: rsync staging → webroot ($WEBROOT)"
gcloud compute ssh "$VM" --zone="$ZONE" --tunnel-through-iap \
  --command="sudo rsync -a --delete --delete-excluded --exclude=.DS_Store $STAGE/ $WEBROOT && echo DEPLOYED_OK"

echo "==> Done."
