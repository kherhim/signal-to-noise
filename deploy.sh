#!/usr/bin/env bash
# Deploy signal-to-noise.co.
# Assumes a fresh `dist/` already built locally.
# All commands routed through IAP because the public SSH firewall is closed.

set -euo pipefail

# Pin the project: the active gcloud config may point elsewhere
# (e.g. another project's work) and gcloud compute inherits it silently.
export CLOUDSDK_CORE_PROJECT="signal2noise-prod"
ZONE="us-central1-a"
VM="s2n-web"
STAGE="/tmp/s2n-dist"
WEBROOT="/var/www/signal-to-noise/dist/"

echo "==> Step 0/4: scrub macOS detritus from local dist/"
# Finder drops .DS_Store into any browsed directory; Astro copies public/
# into dist/ verbatim, so these can hitchhike to production. Strip them
# locally before upload, and double-belt with --exclude on the final
# rsync in case any slip through the staging step.
find dist -name .DS_Store -type f -delete

echo "==> Step 1/4: reset staging dir on VM ($STAGE)"
gcloud compute ssh "$VM" --zone="$ZONE" --tunnel-through-iap \
  --command="rm -rf $STAGE && mkdir $STAGE && echo STAGED_OK"

echo "==> Step 2/4: copy local dist/ to VM staging"
gcloud compute scp --recurse --zone="$ZONE" --tunnel-through-iap \
  dist/* "$VM:$STAGE/"

echo "==> Step 3/4: rsync staging → webroot ($WEBROOT)"
gcloud compute ssh "$VM" --zone="$ZONE" --tunnel-through-iap \
  --command="sudo rsync -a --delete --delete-excluded --exclude=.DS_Store $STAGE/ $WEBROOT && echo DEPLOYED_OK"

echo "==> Step 4/4: purge Cloudflare edge cache"
# CF caches static assets at the edge (HTML stays DYNAMIC); without a purge
# the edge can serve stale assets for hours after a deploy. Credentials live
# in the gitignored .env (token scoped to this zone, Cache Purge only).
# Non-fatal: a failed purge shouldn't mask an otherwise good deploy.
if [ -f .env ]; then set -a; source .env; set +a; fi
if [ -n "${CLOUDFLARE_ZONE_ID:-}" ] && [ -n "${CLOUDFLARE_PURGE_TOKEN:-}" ]; then
  curl -sf -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" \
    -H "Authorization: Bearer $CLOUDFLARE_PURGE_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"purge_everything":true}' >/dev/null \
    && echo PURGED_OK || echo "WARN: Cloudflare purge failed — purge manually in the dashboard"
else
  echo "WARN: CLOUDFLARE_ZONE_ID / CLOUDFLARE_PURGE_TOKEN not set in .env — skipping purge"
fi

echo "==> Done."
