#!/usr/bin/env bash
# =====================================================================
# FLOTA SEGURA GPS — instalación de Traccar en un VPS Ubuntu 24.04
# Normalmente se ejecuta solo, mediante cloud-init.yaml al crear el servidor.
# Manual (como root, con compose.yaml, Caddyfile y backup.sh en /opt/flota-traccar):
#   bash /opt/flota-traccar/install.sh
# Variables opcionales:
#   TRACCAR_DOMAIN=auto (por defecto: <ip>.sslip.io, HTTPS sin comprar dominio) o su dominio
#   TRACCAR_ADMIN_EMAIL=admin@flota.local (usuario interno de Traccar)
# Idempotente: puede ejecutarse de nuevo sin perder datos.
# =====================================================================
set -euo pipefail

REPO_RAW="${REPO_RAW:-}"
APP_DIR=/opt/flota-traccar
DATA_DIR=/opt/traccar
TRACCAR_DOMAIN="${TRACCAR_DOMAIN:-auto}"
TRACCAR_ADMIN_EMAIL="${TRACCAR_ADMIN_EMAIL:-admin@flota.local}"
GPS_PORTS_TCP="5055 5011 5027 5023 5004"
GPS_PORTS_UDP="5011 5027 5023 5004"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
[ "$(id -u)" -eq 0 ] || { echo "Ejecute como root"; exit 1; }

log "Actualizando el sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg ufw fail2ban unattended-upgrades openssl

log "Instalando Docker (repositorio oficial)"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
# Recomendación oficial de Traccar: sin userland-proxy al publicar varios puertos
if [ ! -f /etc/docker/daemon.json ]; then
  echo '{ "userland-proxy": false, "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "5" } }' > /etc/docker/daemon.json
  systemctl restart docker
fi

log "Configurando firewall (solo SSH, HTTPS y puertos GPS)"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
for p in $GPS_PORTS_TCP; do ufw allow "$p/tcp"; done
for p in $GPS_PORTS_UDP; do ufw allow "$p/udp"; done
ufw --force enable
# Nota: Docker publica puertos con iptables propias; PostgreSQL y 8082 no se publican a internet en compose.yaml

log "Preparando directorios"
mkdir -p "$APP_DIR" "$DATA_DIR"/{db,logs,caddy/data,caddy/config} /opt/backups/traccar
cd "$APP_DIR"
if [ -n "$REPO_RAW" ]; then
  curl -fsSL "$REPO_RAW/infra/traccar/compose.yaml" -o compose.yaml
  curl -fsSL "$REPO_RAW/infra/traccar/Caddyfile" -o Caddyfile
  curl -fsSL "$REPO_RAW/infra/traccar/backup.sh" -o backup.sh
fi
[ -f compose.yaml ] && [ -f Caddyfile ] || { echo "Faltan compose.yaml/Caddyfile en $APP_DIR (defina REPO_RAW)"; exit 1; }

PUBLIC_IP=$(curl -4 -fs https://api.ipify.org || hostname -I | awk '{print $1}')
if [ "$TRACCAR_DOMAIN" = "auto" ]; then
  # sslip.io resuelve <ip-con-guiones>.sslip.io a la propia IP: permite certificado HTTPS sin dominio propio
  TRACCAR_DOMAIN="$(echo "$PUBLIC_IP" | tr . -).sslip.io"
fi

if [ ! -f .env ]; then
  log "Generando secretos (se guardan solo en este servidor)"
  cat > .env <<ENV
TRACCAR_DOMAIN=$TRACCAR_DOMAIN
TRACCAR_DB_PASSWORD=$(openssl rand -hex 24)
TRACCAR_PROXY_SECRET=$(openssl rand -hex 32)
TRACCAR_PROTOCOLS=osmand,suntech,teltonika,gt06,gl200
TRACCAR_ADMIN_EMAIL=$TRACCAR_ADMIN_EMAIL
TRACCAR_ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)
ENV
  chmod 600 .env
fi
set -a; . ./.env; set +a

log "Iniciando contenedores"
docker compose pull
docker compose up -d

log "Esperando a Traccar (puede tardar 1-3 minutos la primera vez)"
for i in $(seq 1 60); do
  curl -fs http://127.0.0.1:8082/api/health >/dev/null 2>&1 && break
  sleep 5
done
curl -fs http://127.0.0.1:8082/api/health >/dev/null || { echo "Traccar no respondió. Revise: docker compose logs traccar"; exit 1; }

log "Creando administrador de Traccar y cerrando el registro público"
# El primer usuario registrado en Traccar es administrador.
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:8082/api/users \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Flota Segura\",\"email\":\"$TRACCAR_ADMIN_EMAIL\",\"password\":\"$TRACCAR_ADMIN_PASSWORD\"}")
echo "Alta de administrador: HTTP $code (400/401 si ya existía)"
server=$(curl -s -u "$TRACCAR_ADMIN_EMAIL:$TRACCAR_ADMIN_PASSWORD" http://127.0.0.1:8082/api/server)
if echo "$server" | grep -q '"registration":true'; then
  echo "$server" | sed 's/"registration":true/"registration":false/' | \
    curl -s -o /dev/null -w 'Registro deshabilitado: HTTP %{http_code}\n' -u "$TRACCAR_ADMIN_EMAIL:$TRACCAR_ADMIN_PASSWORD" \
      -X PUT http://127.0.0.1:8082/api/server -H 'Content-Type: application/json' --data-binary @-
fi

chmod 600 "$APP_DIR/RAILWAY.txt" 2>/dev/null || true
log "Programando respaldo diario (03:15) con retención de 14 días"
chmod +x backup.sh
( crontab -l 2>/dev/null | grep -v flota-traccar/backup.sh ; echo "15 3 * * * $APP_DIR/backup.sh >> /var/log/flota-traccar-backup.log 2>&1" ) | crontab -

IP=$PUBLIC_IP
cat <<MSG | tee "$APP_DIR/RAILWAY.txt"

=====================================================================
 Traccar instalado.
 Copie estos valores en Railway → servicio "api" → Variables:

   TRACCAR_URL=https://$TRACCAR_DOMAIN
   TRACCAR_ADMIN_EMAIL=$TRACCAR_ADMIN_EMAIL
   TRACCAR_ADMIN_PASSWORD=$TRACCAR_ADMIN_PASSWORD
   TRACCAR_PROXY_SECRET=$TRACCAR_PROXY_SECRET
   TRACCAR_PUBLIC_HOST=$IP

 Para volver a verlos:  cat $APP_DIR/RAILWAY.txt
 Panel de Traccar (solo por túnel SSH):
   ssh -L 8082:127.0.0.1:8082 root@$IP   y abra http://localhost:8082
=====================================================================
MSG
chmod 600 "$APP_DIR/RAILWAY.txt"
