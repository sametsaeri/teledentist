#!/bin/bash
# Oracle Cloud Always Free - TeleDentist kurulumu (Ubuntu 24.04)
# 50GB block volume /data altına bağlı kabul edilir.
set -e

sudo apt update && sudo apt install -y docker.io docker-compose-plugin postgresql-client nginx certbot python3-certbot-nginx

# 50GB volume kontrolü
lsblk
echo "50GB volume /data altına mount edilmeli (ornek: sudo mount /dev/sdb1 /data)"

sudo mkdir -p /data/pgdata /data/images /var/www/ktuteledentist
sudo chown -R $USER:$USER /data /var/www/ktuteledentist

# Postgres + API (deploy/docker-compose.yml PGDATA yolunu /data/pgdata yapın)
# docker compose --project-directory deploy up -d

# Semayi yukle (supabase yerine oracle postgres):
# psql -h 127.0.0.1 -U telesaglik -d teledentist -f db/schema.sql

# Yedek (haftalik cron onerisi):
# pg_dump -h 127.0.0.1 -U telesaglik teledentist | gzip > /data/yedek-$(date +%F).sql.gz

echo "Oracle kurulum iskeleti hazir."
