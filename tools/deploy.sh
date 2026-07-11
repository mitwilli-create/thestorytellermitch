#!/usr/bin/env bash
# Deploy thestorytellermitch.com to Cloudflare Workers Static Assets.
# The site migrated from the Cloudflare Pages project to the
# "thestorytellermitch" Worker on 2026-07-10; wrangler.jsonc is the Worker
# config and .assetsignore controls what is uploaded/served.
#
# Why this script exists (2026-07-10):
#   1. Auth: the shared .env (symlink to ~/.secrets/api-keys.env) exports a
#      CLOUDFLARE_API_TOKEN without deploy permissions. wrangler prefers an env
#      token over the `wrangler login` OAuth session, so deploys fail with
#      "Authentication error [code: 10000]". Fix: unset the tokens here and
#      stage into a directory with no .env, so OAuth wins.
#   2. Hygiene: staging via `git archive HEAD` exports tracked files only, so
#      the gitignored multi-GB media/ and any untracked scratch never reach the
#      upload even if .assetsignore drifts.
#
# Deploys HEAD: commit first, or your edits silently stay behind (warned below).
# Usage: tools/deploy.sh
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if ! git diff-index --quiet HEAD --; then
  echo "warning: uncommitted changes detected; this deploys HEAD, so they will NOT ship." >&2
fi

# Let the wrangler login OAuth session win over the broken env token.
unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCESS_TOKEN CLOUDFLARE_ACCOUNT_ID CF_ACCOUNT_ID CF_API_TOKEN 2>/dev/null || true

HEAD_SHA=$(git rev-parse --short HEAD)
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
git archive HEAD | tar -x -C "$STAGE"

cd "$STAGE"
npx --yes wrangler@latest deploy

echo
echo "Deployed HEAD ($HEAD_SHA). Verify: https://thestorytellermitch.com"
