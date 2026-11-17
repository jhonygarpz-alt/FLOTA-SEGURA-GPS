#!/usr/bin/env bash
# Respaldo diario de la base de datos de Traccar (pg_dump comprimido), retención 14 días.
set -euo pipefail
cd /opt/flota-traccar
DEST=/opt/backups/traccar
mkdir -p "$DEST"
FILE="$DEST/traccar-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
docker compose exec -T database pg_dump -U traccar -d traccar --no-owner | gzip -9 > "$FILE"
find "$DEST" -name 'traccar-*.sql.gz' -mtime +14 -delete
echo "$(date -u +%FT%TZ) respaldo creado: $FILE ($(du -h "$FILE" | cut -f1))"
# Recomendado: copie $DEST a almacenamiento externo (p. ej. Hetzner Storage Box) con rsync.
