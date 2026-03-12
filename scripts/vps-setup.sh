#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   sudo apt update && sudo apt install -y git
#   git clone <YOUR_REPO_URL> && cd <repo>
#   bash scripts/vps-setup.sh
#
# Optional environment variables (recommended for non-interactive setup):
#   DOMAIN=yourdomain.com
#   PORT=3000
#   BASE_URL=https://yourdomain.com
#   ENABLE_SSL=1                  # uses certbot nginx plugin
#   GMAIL_USER=you@gmail.com
#   GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"
#
# Notes:
# - Gmail App Password must be created in Google Account (2FA required).
# - If SMTP is configured via web UI, it is stored in data/smtp.json (not committed).

PROJECT_NAME="gmail-sender"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf "\n\033[1m%s\033[0m\n" "$*"; }

get_public_ip() {
  # Best-effort. If it fails, user can set BASE_URL manually.
  curl -fsS --max-time 5 https://checkip.amazonaws.com 2>/dev/null | tr -d '\n' || true
}

if [[ "$(id -u)" -eq 0 ]]; then
  log "Please run as a normal user (not root). This script uses sudo when needed."
  exit 1
fi

if ! command -v sudo >/dev/null 2>&1; then
  echo "sudo is required."
  exit 1
fi

log "Installing system packages (nginx, ufw, curl)..."
sudo apt update -y
sudo apt install -y nginx ufw curl ca-certificates

log "Configuring firewall (UFW)..."
sudo ufw allow OpenSSH >/dev/null || true
sudo ufw allow 'Nginx Full' >/dev/null || true
sudo ufw --force enable >/dev/null || true

if ! command -v node >/dev/null 2>&1; then
  log "Installing Node.js LTS..."
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt install -y nodejs
fi

log "Node version: $(node -v)"
log "npm version: $(npm -v)"

log "Installing npm dependencies..."
cd "$APP_DIR"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

log "Preparing .env..."
if [[ ! -f .env ]]; then
  cp .env.example .env
fi

# Append/overwrite key-values if env vars provided
set_kv () {
  local key="$1"; local val="$2"
  if grep -qE "^${key}=" .env; then
    sed -i "s#^${key}=.*#${key}=${val}#g" .env
  else
    printf "\n%s=%s\n" "$key" "$val" >> .env
  fi
}

[[ -n "${PORT:-}" ]] && set_kv "PORT" "${PORT}"
[[ -n "${BASE_URL:-}" ]] && set_kv "BASE_URL" "${BASE_URL}"
[[ -n "${GMAIL_USER:-}" ]] && set_kv "GMAIL_USER" "${GMAIL_USER}"
[[ -n "${GMAIL_APP_PASSWORD:-}" ]] && set_kv "GMAIL_APP_PASSWORD" "${GMAIL_APP_PASSWORD}"

log "Installing PM2..."
sudo npm i -g pm2

log "Starting app with PM2..."
pm2 start "$APP_DIR/server.js" --name "$PROJECT_NAME"
pm2 save

log "Enabling PM2 startup on boot..."
pm2 startup systemd -u "$USER" --hp "$HOME" | tail -n 1 | bash || true

APP_PORT="${PORT:-3000}"

if [[ -n "${DOMAIN:-}" ]]; then
  log "Configuring Nginx for domain: ${DOMAIN}"
  sudo tee "/etc/nginx/sites-available/${PROJECT_NAME}" >/dev/null <<EOF
server {
  listen 80;
  server_name ${DOMAIN};

  location / {
    proxy_pass http://127.0.0.1:${APP_PORT};
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host \$host;
    proxy_cache_bypass \$http_upgrade;
  }
}
EOF
  sudo ln -sf "/etc/nginx/sites-available/${PROJECT_NAME}" "/etc/nginx/sites-enabled/${PROJECT_NAME}"
  sudo nginx -t
  sudo systemctl reload nginx

  if [[ "${ENABLE_SSL:-0}" == "1" ]]; then
    log "Installing Certbot and enabling HTTPS..."
    sudo apt install -y certbot python3-certbot-nginx
    sudo certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${CERTBOT_EMAIL:-admin@${DOMAIN}}" || true
  fi
else
  log "DOMAIN not set. Using VPS IP access (http://<VPS_IP>:${APP_PORT})."
  log "Opening firewall port ${APP_PORT}/tcp..."
  sudo ufw allow "${APP_PORT}/tcp" >/dev/null || true

  # Auto-set BASE_URL if not provided and not already present in .env
  if ! grep -qE '^BASE_URL=' .env; then
    PUB_IP="$(get_public_ip)"
    if [[ -n "$PUB_IP" ]]; then
      set_kv "BASE_URL" "http://${PUB_IP}:${APP_PORT}"
      log "BASE_URL set to http://${PUB_IP}:${APP_PORT}"
    else
      log "Could not detect public IP. Set BASE_URL manually in .env for unsubscribe links."
    fi
  fi
fi

log "Done."
echo "App should be running via PM2."
echo "- Local: http://127.0.0.1:${APP_PORT}"
if [[ -n "${DOMAIN:-}" ]]; then
  echo "- Domain: http://${DOMAIN}  (or https://${DOMAIN} if SSL enabled)"
  echo "Important: set BASE_URL in .env to https://${DOMAIN} so unsubscribe links work."
else
  echo "- IP: http://<VPS_IP>:${APP_PORT}"
fi
