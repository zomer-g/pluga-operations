#!/bin/sh
# xhostd build step — runs once at build time, as root, with NO env injected.
# Installs dependencies and builds the SPA into dist/ (served by server/index.js).
set -eu
npm ci
npm run build
