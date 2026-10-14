#!/bin/bash
# KTU TeleDentist VPS kurulumu (Ubuntu 24.04)
set -e
DOMAIN="ktuteledentist.com"
APP_DIR="/var/www/ktuteledentist"

sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx nodejs npm
sudo mkdir -p $APP_DIR
# Projeyi sunucuya kopyaladıktan sonra:
# cd /var/www/ktuteledentist && npm install && npm run build
sudo cp deploy/nginx-ktuteledentist.conf /etc/nginx/sites-available/ktuteledentist
sudo ln -sf /etc/nginx/sites-available/ktuteledentist /etc/nginx/sites-enabled/ktuteledentist
sudo nginx -t && sudo systemctl reload nginx
# DNS A kaydı VPS IP'ye yönlendikten sonra:
# sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN
echo "Kurulum hazır. DNS yönlendirmesini kontrol edin."
