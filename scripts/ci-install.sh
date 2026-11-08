#!/usr/bin/env bash
# CI dependency install. ffmpeg-static downloads its binary from GitHub releases during npm ci;
# when that download fails, install without scripts and point the app at the system ffmpeg instead.
set -euo pipefail

if npm ci; then exit 0; fi

echo "::warning::npm ci failed; retrying without install scripts and using the system ffmpeg"
npm ci --ignore-scripts
# unrs-resolver is the only other package with an install script that runs on Linux.
npm rebuild unrs-resolver
if ! command -v ffmpeg >/dev/null; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq --no-install-recommends ffmpeg
fi
echo "FFMPEG_PATH=$(command -v ffmpeg)" >> "${GITHUB_ENV:-/dev/null}"
