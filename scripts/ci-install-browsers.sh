#!/usr/bin/env bash
set -euo pipefail

# Ubuntu hosted runners use an APT mirror list. If the default archive is
# unreachable, use a reachable mirror of the same Ubuntu-signed packages.
mirror_list=/etc/apt/apt-mirrors.txt
if [[ -f "$mirror_list" ]] && ! curl -fsSL --max-time 8 -o /dev/null https://azure.archive.ubuntu.com/ubuntu/dists/noble/InRelease; then
  for mirror in https://mirrors.edge.kernel.org/ubuntu https://mirrors.mit.edu/ubuntu; do
    if curl -fsSL --max-time 8 -o /dev/null "$mirror/dists/noble-security/InRelease"; then
      echo "Using reachable Ubuntu archive: $mirror"
      echo "$mirror/" | sudo tee "$mirror_list" >/dev/null
      break
    fi
  done
fi

pnpm exec playwright install --with-deps chromium webkit
