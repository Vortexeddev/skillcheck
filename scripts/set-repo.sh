#!/usr/bin/env bash
# Repoints every placeholder GitHub slug in this repo at your own.
#
#   ./scripts/set-repo.sh your-username/skillcheck
#
# Run it once before your first push: the README badges, npm metadata and the
# `skillcheck badge` output all embed the repo URL, and a wrong link on launch
# day is a lost click.
#
# The current slug is discovered from package.json rather than hardcoded, so this
# is safe to run repeatedly and safe to run again after renaming.
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "usage: ./scripts/set-repo.sh <owner>/<repo>" >&2
  exit 64
fi

NEW="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! [[ "$NEW" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]]; then
  echo "error: '$NEW' does not look like <owner>/<repo>" >&2
  exit 64
fi

# Discover the slug currently baked into the package metadata.
OLD="$(sed -n 's#.*"homepage": *"https://github.com/\([^"#]*\).*#\1#p' "$ROOT/package.json" | head -1)"

if [ -z "$OLD" ]; then
  echo "error: could not find a homepage slug in package.json" >&2
  exit 1
fi

if [ "$NEW" = "$OLD" ]; then
  echo "already set to $OLD — nothing to do"
  exit 0
fi

echo "rewriting: $OLD  ->  $NEW"
echo

# Everything except build output, dependencies and git internals.
files="$(cd "$ROOT" && grep -rl --binary-files=without-match \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git \
  -F "$OLD" . || true)"

if [ -z "$files" ]; then
  echo "no occurrences of '$OLD' found"
  exit 0
fi

changed=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  # Never rewrite this script: its own text is matched by the grep and it would
  # end up editing itself mid-run.
  case "$f" in
    */scripts/set-repo.sh) echo "skipped: $f (this script)" ; continue ;;
  esac
  tmp="${f}.tmp"
  LC_ALL=C sed "s|${OLD}|${NEW}|g" "$ROOT/${f#./}" > "$tmp" && mv "$tmp" "$ROOT/${f#./}"
  echo "updated: $f"
  changed=$((changed + 1))
done <<< "$files"

echo
echo "$changed file(s) updated. Now rebuild and re-check:"
echo "  npm run build && npm test"
