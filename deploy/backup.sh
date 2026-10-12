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

# Vérification : fichier non vide ET lisible par pg_restore (sinon on supprime et on échoue bruyamment)
if [ ! -s "$FICHIER" ] || ! docker compose exec -T db pg_restore -l < "$FICHIER" > /dev/null 2>&1; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ SAUVEGARDE INVALIDE — $FICHIER supprimé"
  rm -f "$FICHIER"
  exit 1
fi

TAILLE=$(du -h "$FICHIER" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Sauvegarde base terminée ($TAILLE)"

# Fichiers uploadés (vidéos d'induction, photos...) : volume Docker "media_data" monté dans /app/media
FICHIER_MEDIA="$BACKUP_DIR/media_${TIMESTAMP}.tgz"
if docker compose exec -T backend tar czf - -C /app media > "$FICHIER_MEDIA" 2>/dev/null && [ -s "$FICHIER_MEDIA" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Médias sauvegardés ($(du -h "$FICHIER_MEDIA" | cut -f1))"
else
  rm -f "$FICHIER_MEDIA"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ Médias non sauvegardés (dossier vide ou backend arrêté)"
fi

# Sauvegarde aussi .env (SECRET_KEY) : sans lui, une restauration de la base
# sur un nouveau serveur ne suffit pas — tous les tokens de connexion
# deviendraient invalides. Fichier sensible : à traiter comme confidentiel,
# jamais à partager ni committer.
if [ -f .env ]; then
  cp .env "$BACKUP_DIR/env_${TIMESTAMP}.bak" && chmod 600 "$BACKUP_DIR/env_${TIMESTAMP}.bak"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] .env sauvegardé (confidentiel — ne pas partager)"
fi

# Purge des sauvegardes de plus de $RETENTION_JOURS jours
find "$BACKUP_DIR" -name "rzi_camp_*.dump" -mtime "+${RETENTION_JOURS}" -print -delete
find "$BACKUP_DIR" -name "env_*.bak" -mtime "+${RETENTION_JOURS}" -print -delete
find "$BACKUP_DIR" -name "media_*.tgz" -mtime "+${RETENTION_JOURS}" -print -delete

NB_RESTANTES=$(find "$BACKUP_DIR" -name "rzi_camp_*.dump" | wc -l)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] $NB_RESTANTES sauvegarde(s) conservée(s) (rétention ${RETENTION_JOURS}j)"
