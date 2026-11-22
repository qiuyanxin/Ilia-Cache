#!/bin/zsh
cd "${0:A:h}"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
if /usr/bin/curl --noproxy '*' --silent --fail http://127.0.0.1:4317/api/status >/dev/null; then
  open http://127.0.0.1:4317
  exit 0
fi
node server.mjs &
library_server_pid=$!
trap 'kill "$library_server_pid" 2>/dev/null' EXIT INT TERM
for library_attempt in {1..50}; do
  if /usr/bin/curl --noproxy '*' --silent --fail http://127.0.0.1:4317/api/status >/dev/null; then
    open http://127.0.0.1:4317
    break
  fi
  sleep 0.1
done
wait "$library_server_pid"
