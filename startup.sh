#!/bin/sh
set -eu
cd /workspace
# :8081 is QA-only — a revive must never inherit a stale built-output preview.
node scripts/preview.mjs stop || true
if ! curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  npm run dev >>/tmp/app-startup.log 2>&1 &
  i=0
  while [ "$i" -lt 40 ]; do
    if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
      break
    fi
    i=$((i + 1))
    sleep 0.25
  done
fi
# Prefetch SANSA so the first phone open hits a warm cache.
( curl -s --max-time 20 "http://127.0.0.1:8080/api/weather?site=hbk" >/dev/null || true
  curl -s --max-time 20 "http://127.0.0.1:8080/api/weather?site=mtj" >/dev/null || true ) >/dev/null 2>&1 &
exit 0
