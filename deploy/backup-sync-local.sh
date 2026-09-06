#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# Copie les sauvegardes locales (dossier backups/) vers un AUTRE serveur
# ou ordinateur, sur le même réseau ou ailleurs — protège contre une panne
# physique du serveur Hetzner lui-même (les sauvegardes locales seules n'y
# survivraient pas).
#
# Mise en place (une seule fois) :
#   1. Sur le serveur cible (la machine qui recevra les copies), s'assurer
#      que SSH est accessible.
#   2. Depuis ce serveur Hetzner, générer une clé SSH dédiée si pas déjà fait :
#        ssh-keygen -t ed25519 -f ~/.ssh/rzi_backup_key -N ""
#   3. Copier la clé publique sur la machine cible :
#        ssh-copy-id -i ~/.ssh/rzi_backup_key.pub USER@ADRESSE_SERVEUR_LOCAL
#   4. Renseigner les 3 variables ci-dessous.
#   5. Automatiser en crontab, juste après backup.sh (voir BACKUP.md) :
#        30 2 * * * cd /opt/stacks/rzi-camp && ./deploy/backup-sync-local.sh >> /var/log/rzi-camp-backup.log 2>&1
# ─────────────────────────────────────────────────────────────────
set -e

# ── À renseigner ──
SERVEUR_CIBLE="USER@ADRESSE_SERVEUR_LOCAL"     # ex: backup@192.168.1.50
DOSSIER_CIBLE="/home/backup/rzi-camp-backups/"  # doit déjà exister sur la machine cible
CLE_SSH="$HOME/.ssh/rzi_backup_key"

cd "$(dirname "$0")/.."

if [ "$SERVEUR_CIBLE" = "USER@ADRESSE_SERVEUR_LOCAL" ]; then
  echo "❌ Configuration manquante : ouvrez deploy/backup-sync-local.sh et renseignez SERVEUR_CIBLE."
  exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Synchronisation vers $SERVEUR_CIBLE..."

rsync -avz --delete \
  -e "ssh -i $CLE_SSH -o StrictHostKeyChecking=accept-new" \
  ./backups/ "$SERVEUR_CIBLE:$DOSSIER_CIBLE"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Synchronisation terminée."
