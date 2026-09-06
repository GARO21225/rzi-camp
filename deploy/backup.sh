#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# Sauvegarde automatique de la base RZI Camp (PostgreSQL).
#
# Utilise pg_dump DANS le conteneur "db" (l'image postgres:15 officielle
# l'inclut déjà — contrairement au backend Django qui ne l'a pas, psycopg2
# binary n'embarque pas les outils CLI). Format "custom" (-Fc) : compressé,
# et restaurable sélectivement (table par table si besoin) avec pg_restore.
#
# Usage :
#   ./deploy/backup.sh
#
# Automatisation recommandée (crontab -e sur le serveur) — tous les jours
# à 2h du matin :
#   0 2 * * * cd /opt/stacks/rzi-camp && ./deploy/backup.sh >> /var/log/rzi-camp-backup.log 2>&1
# ─────────────────────────────────────────────────────────────────
set -e

cd "$(dirname "$0")/.."

BACKUP_DIR="./backups"
RETENTION_JOURS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FICHIER="$BACKUP_DIR/rzi_camp_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Démarrage sauvegarde -> $FICHIER"

docker compose exec -T db pg_dump -U rzi -Fc rzi_camp > "$FICHIER"

TAILLE=$(du -h "$FICHIER" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Sauvegarde base terminée ($TAILLE)"

# Sauvegarde aussi .env (SECRET_KEY) : sans lui, une restauration de la base
# sur un nouveau serveur ne suffit pas — tous les tokens de connexion
# deviendraient invalides. Fichier sensible : à traiter comme confidentiel,
# jamais à partager ni committer.
if [ -f .env ]; then
  cp .env "$BACKUP_DIR/env_${TIMESTAMP}.bak"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] .env sauvegardé (confidentiel — ne pas partager)"
fi

# Purge des sauvegardes de plus de $RETENTION_JOURS jours
find "$BACKUP_DIR" -name "rzi_camp_*.dump" -mtime "+${RETENTION_JOURS}" -print -delete
find "$BACKUP_DIR" -name "env_*.bak" -mtime "+${RETENTION_JOURS}" -print -delete

NB_RESTANTES=$(find "$BACKUP_DIR" -name "rzi_camp_*.dump" | wc -l)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] $NB_RESTANTES sauvegarde(s) conservée(s) (rétention ${RETENTION_JOURS}j)"
