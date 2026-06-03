#!/bin/bash
# init-letsencrypt.sh
# One-time setup to obtain Let's Encrypt SSL certificates for nitti.tech.
# Run once on the server:  chmod +x init-letsencrypt.sh && ./init-letsencrypt.sh
#
# Adapted from https://github.com/wmnnd/nginx-certbot

set -e

domains=(nitti.tech www.nitti.tech)
email="monkholmama123@gmail.com"      # used by Let's Encrypt for renewal notices
data_path="./certbot"
rsa_key_size=4096
staging=0                            # set to 1 to test against the staging server first

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but not installed. Aborting."
  exit 1
fi

# ── 1. Download recommended TLS parameters ──────────────────────────
if [ ! -e "$data_path/conf/options-ssl-nginx.conf" ] || [ ! -e "$data_path/conf/ssl-dhparams.pem" ]; then
  echo "### Downloading recommended TLS parameters ..."
  mkdir -p "$data_path/conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"
fi

# ── 2. Create a dummy certificate so nginx can start ────────────────
echo "### Creating dummy certificate for ${domains[0]} ..."
path="/etc/letsencrypt/live/${domains[0]}"
mkdir -p "$data_path/conf/live/${domains[0]}"
docker compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1 \
    -keyout '$path/privkey.pem' \
    -out '$path/fullchain.pem' \
    -subj '/CN=localhost'" certbot

# ── 3. Start nginx (now it can load the dummy cert) ─────────────────
echo "### Starting nginx ..."
docker compose up --force-recreate -d frontend

# ── 4. Delete the dummy certificate ─────────────────────────────────
echo "### Deleting dummy certificate ..."
docker compose run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/${domains[0]} && \
  rm -Rf /etc/letsencrypt/archive/${domains[0]} && \
  rm -Rf /etc/letsencrypt/renewal/${domains[0]}.conf" certbot

# ── 5. Request the real certificate from Let's Encrypt ──────────────
echo "### Requesting Let's Encrypt certificate for ${domains[*]} ..."
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

email_arg="--email $email"
staging_arg=""
if [ $staging != "0" ]; then staging_arg="--staging"; fi

docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    $domain_args \
    --rsa-key-size $rsa_key_size \
    --agree-tos \
    --no-eff-email \
    --force-renewal" certbot

# ── 6. Reload nginx with the real certificate ───────────────────────
echo "### Reloading nginx ..."
docker compose exec frontend nginx -s reload

echo ""
echo "### DONE — https://nitti.tech should now be live."
