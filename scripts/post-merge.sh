#!/usr/bin/env bash
set -euo pipefail

echo "[post-merge] Installing dependencies"
npm install --no-audit --no-fund

echo "[post-merge] Running tests"
npm test

echo "[post-merge] Building application"
npm run build

echo "[post-merge] Complete"