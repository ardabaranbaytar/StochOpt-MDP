#!/usr/bin/env bash
# Deploy the latest main on the server:  sudo bash /opt/stochopt-mdp/deploy/update.sh
# Pulls, installs Python deps, rebuilds the frontend, restarts the API.
# `--no-pull` skips git (used by setup_vps.sh on the first install).
set -euo pipefail

APP=/opt/stochopt-mdp
USER_NAME=stochopt
[ "$(id -u)" -eq 0 ] || { echo "run as root (sudo)"; exit 1; }

# Run as the app user (owns the checkout); caches stay inside the git-ignored .cache.
as_app() {
  sudo -u "$USER_NAME" -H env XDG_CACHE_HOME="$APP/.cache" npm_config_cache="$APP/.cache/npm" \
    bash -c "cd $APP && $*"
}

if [ "${1:-}" != "--no-pull" ]; then
  as_app "git pull --ff-only"
fi

# Runtime dependencies only (pyproject main group); dev tools stay off the server.
as_app "[ -d .venv ] || python3 -m venv .venv"
as_app ".venv/bin/pip install -q --upgrade pip"
as_app ".venv/bin/pip install -q -e ."
as_app "cd frontend && npm ci --no-audit --no-fund && npm run build"

# The unit may have changed in the repo.
if [ -f /etc/systemd/system/stochopt-api.service ]; then
  cp "$APP/deploy/systemd/stochopt-api.service" /etc/systemd/system/
  systemctl daemon-reload
  systemctl restart stochopt-api.service
  sleep 2
  curl -fsS http://127.0.0.1:8100/health >/dev/null
  echo "API healthy at $(as_app "git log -1 --format='%h %s'")"
fi
