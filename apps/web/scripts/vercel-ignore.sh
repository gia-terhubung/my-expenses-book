#!/bin/sh
# Vercel "Ignored Build Step" for apps/web (run from apps/web).
# Exit 0 = skip the build, exit 1 = build. Any other exit code fails the deployment, so every
# git error below falls through to "build".
#
# Vercel clones shallow (about 10 commits). When the last deployed commit is older than that,
# it is not in the clone: fetch it, and build if that fails too.

prev="${VERCEL_GIT_PREVIOUS_SHA:-}"

if [ -z "$prev" ]; then
  echo "No previous deployment: build."
  exit 1
fi

if ! git cat-file -e "$prev^{commit}" 2>/dev/null; then
  git fetch --quiet --depth=1 origin "$prev" 2>/dev/null
fi

if ! git cat-file -e "$prev^{commit}" 2>/dev/null; then
  echo "Previous deployment $prev not in the clone: build."
  exit 1
fi

if git diff --quiet "$prev" HEAD -- .; then
  echo "apps/web unchanged since $prev: skip."
  exit 0
fi

echo "apps/web changed since $prev: build."
exit 1
