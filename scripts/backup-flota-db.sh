#!/usr/bin/env bash
# Respaldo de la base administrativa de Flota Segura (PostgreSQL en Railway).
# Uso: DATABASE_URL="postgresql://..." ./scripts/backup-flota-db.sh [directorio]
# Obtenga DATABASE_URL en Railway → servicio Postgres → Variables → DATABASE_PUBLIC_URL.
set -euo pipefail
: "${DATABASE_URL:?Defina DATABASE_URL}"
DEST="${1:-./backups}"
mkdir -p "$DEST"
FILE="$DEST/flota-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner "$DATABASE_URL" -f "$FILE"
echo "Respaldo creado: $FILE"
# Restaurar: pg_restore --clean --no-owner -d "$DATABASE_URL" "$FILE"
