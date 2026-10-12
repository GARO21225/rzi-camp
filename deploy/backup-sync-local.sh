#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# Copie les sauvegardes (dossier backups/) vers UN AUTRE serveur (VPS, NAS, PC...) via SSH/rsync.
# Protège d'une perte totale du VPS (disque mort, compte supprimé, erreur d'administration).
#
# Configuration : copier deploy/backup.conf.example vers deploy/backup.conf et le remplir
# (backup.conf est ignoré par git — il contient l'adresse du serveur de secours).
#
# IMPORTANT : pas d'option --delete. Si le dossier backups/ est vidé ou corrompu ici par erreur,
# la copie distante est CONSERVÉE. La purge distante (rétention) se fait séparément ci-dessous.
# ─────────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")/.."

CONF="deploy/backup.conf"
[ -f "$CONF" ] || { echo "❌ $CONF introuvable : copiez deploy/backup.conf.example vers $CONF et renseignez-le."; exit 1; }
# shellcheck disable=SC1090
. "$CONF"

: "${SERVEUR_CIBLE:?SERVEUR_CIBLE non défini}" "${DOSSIER_CIBLE:?DOSSIER_CIBLE non défini}"
CLE_SSH="${CLE_SSH:-$HOME/.ssh/rzi_backup_key}"
PORT_SSH="${PORT_SSH:-22}"
RETENTION_DISTANTE_JOURS="${RETENTION_DISTANTE_JOURS:-90}"
SSH="ssh -i $CLE_SSH -p $PORT_SSH -o StrictHostKeyChecking=accept-new"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Synchronisation vers $SERVEUR_CIBLE:$DOSSIER_CIBLE ..."
$SSH "$SERVEUR_CIBLE" "mkdir -p '$DOSSIER_CIBLE'"
rsync -az --chmod=F600 -e "$SSH" ./backups/ "$SERVEUR_CIBLE:$DOSSIER_CIBLE"

# Rétention côté serveur de secours
$SSH "$SERVEUR_CIBLE" "find '$DOSSIER_CIBLE' -type f \( -name 'rzi_camp_*.dump' -o -name 'media_*.tgz' -o -name 'env_*.bak' \) -mtime +$RETENTION_DISTANTE_JOURS -delete"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Synchronisation terminée ($(ls ./backups/*.dump 2>/dev/null | wc -l) dump(s) locaux)."
