#!/bin/zsh
# Double-click to run the smoker app locally. Close this window to stop it.
cd "$(dirname "$0")" || exit 1
PORT=8123
if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "The app is already running."
  open "http://localhost:$PORT/"
  exit 0
fi
echo "Smoker app running at http://localhost:$PORT/  (close this window to stop)"
(sleep 1; open "http://localhost:$PORT/") &
exec python3 -m http.server $PORT --bind 127.0.0.1
