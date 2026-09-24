#!/usr/bin/env bash
# One-time setup of StochOpt-MDP on an Ubuntu 24.04 server (e.g. Hetzner Cloud).
#
#   curl -fsSLO https://raw.githubusercontent.com/ardabaranbaytar/StochOpt-MDP/main/deploy/setup_vps.sh
#   sudo bash setup_vps.sh                              # stochopt.ardabaranbaytar.com
#   sudo bash setup_vps.sh stochopt.example.com         # another domain
#
# Shares the server with other apps: Caddy loads every file in /etc/caddy/sites/,
# and this app only adds its own (stochopt.caddy). The API listens on
# 127.0.0.1:8100; the React build is served as static files. Safe to re-run.
set -euo pipefail

DOMAIN="${1:-stochopt.ardabaranbaytar.com}"
REPO="${REPO:-https://github.com/ardabaranbaytar/StochOpt-MDP.git}"
APP=/opt/stochopt-mdp
USER_NAME=stochopt

[ "$(id -u)" -eq 0 ] || { echo "run as root (sudo)"; exit 1; }
. /etc/os-release
[ "${ID:-}" = ubuntu ] || echo "warning: tested on Ubuntu 24.04, this is ${PRETTY_NAME:-unknown}"
step() { echo; echo "==> $*"; }

step "System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q git python3-venv python3-dev build-essential caddy ufw curl ca-certificates sudo

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  step "Node.js 22 (NodeSource; only used to build the frontend)"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi

# Small plans: npm/vite builds like some headroom.
if [ "$(awk '/MemTotal/ {print $2}' /proc/meminfo)" -lt 3000000 ] && ! swapon --show | grep -q .; then
  step "2 GB swap file"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

step "Firewall: SSH, HTTP, HTTPS only"
ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null  # profile needs openssh-server
ufw allow 80,443/tcp >/dev/null
ufw --force enable

step "App user and code in $APP"
id "$USER_NAME" >/dev/null 2>&1 || useradd --system --home-dir "$APP" --shell /usr/sbin/nologin "$USER_NAME"
if [ ! -d "$APP/.git" ]; then
  git clone "$REPO" "$APP"
fi
mkdir -p "$APP/.cache"
chown -R "$USER_NAME:$USER_NAME" "$APP"

step "Python environment and frontend build"
bash "$APP/deploy/update.sh" --no-pull

step "systemd: API service"
cp "$APP/deploy/systemd/stochopt-api.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now stochopt-api.service

step "Caddy site $DOMAIN"
mkdir -p /etc/caddy/sites /var/log/caddy
grep -qs '^import sites/\*.caddy' /etc/caddy/Caddyfile || cat > /etc/caddy/Caddyfile <<'CADDY'
# Each app on this server drops its own site file into /etc/caddy/sites/.
import sites/*.caddy
CADDY
sed "s|{\$SITE}|$DOMAIN|" "$APP/deploy/caddy/stochopt.caddy" > /etc/caddy/sites/stochopt.caddy
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload-or-restart caddy

echo
echo "Done."
echo "  Dashboard:  https://$DOMAIN"
echo "  API docs:   https://$DOMAIN/docs"
echo "  Health:     curl -s https://$DOMAIN/health"
