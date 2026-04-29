#!/bin/bash
# Install codeburn from fork (thompsonson/codeburn)
# Runs once per machine; re-runs if this file changes (e.g. version bump).

set -euo pipefail

if ! command -v npm >/dev/null 2>&1; then
  echo 'codeburn: npm not found, skipping'
  exit 0
fi

echo 'Installing codeburn from thompsonson/codeburn...'
npm install -g thompsonson/codeburn#v0.9.1-thompsonson.3
echo "codeburn installed: $(codeburn --version 2>/dev/null || echo 'unknown version')"
