#!/usr/bin/env bash
# Builds a submission-ready zip for addons.mozilla.org (AMO).
# Only includes files the extension actually loads at runtime -
# dev tooling, tests, docs, and unused source assets are left out.
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -e "console.log(require('./manifest.json').version)")
OUT_DIR="dist"
OUT_FILE="$OUT_DIR/referer-by-domain-$VERSION.zip"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
rm -f "$OUT_FILE"

zip -r -X "$OUT_FILE" \
  manifest.json \
  _locales \
  icons/logo.png \
  icons/logo-16x16.png \
  icons/logo-32x32.png \
  icons/logo-48x48.png \
  icons/logo-128x128.png \
  src/assets \
  src/background \
  src/lib \
  src/options \
  src/popup \
  -x "*.map" "src/assets/screenshots/*"

echo "Created $OUT_FILE"
unzip -l "$OUT_FILE"
