#!/usr/bin/env bash
# Genera cloud-init.yaml (para pegar en Hetzner → Crear servidor → "Cloud config")
# a partir de compose.yaml, Caddyfile, backup.sh e install.sh, para que se mantengan sincronizados.
set -euo pipefail
cd "$(dirname "$0")"
indent() { sed 's/^/      /' "$1"; }
{
  echo "#cloud-config"
  echo "# FLOTA SEGURA GPS — instalación automática de Traccar 6.16.0 (Ubuntu 24.04)."
  echo "# Archivo generado por build-cloud-init.sh. Pegue TODO este contenido en el campo Cloud config."
  echo "write_files:"
  for f in compose.yaml Caddyfile backup.sh install.sh; do
    perm=0644; [[ $f == *.sh ]] && perm=0755
    echo "  - path: /opt/flota-traccar/$f"
    echo "    permissions: '$perm'"
    echo "    content: |"
    indent "$f"
  done
  echo "runcmd:"
  echo "  - [bash, /opt/flota-traccar/install.sh]"
} > cloud-init.yaml
echo "cloud-init.yaml generado ($(wc -c < cloud-init.yaml) bytes)"
