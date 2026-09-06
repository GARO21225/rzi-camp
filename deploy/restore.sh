#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# Restauration de la base RZI Camp depuis une sauvegarde pg_dump (-Fc).
#
# ⚠️ DESTRUCTIF : remplace entièrement les données actuelles de la base
# par celles de la sauvegarde. À utiliser uniquement en cas de restauration
# réelle après incident (perte de données, corruption, mauvaise manip).
#
# Usage :
#   ./deploy/restore.sh backups/rzi_camp_20260906_020000.dump
# ─────────────────────────────────────────────────────────────────
set -e

cd "$(dirname "$0")/.."

FICHIER="$1"
if [ -z "$FICHIER" ]; then
  echo "Usage: $0 <chemin_vers_sauvegarde.dump>"
  echo
  echo "Sauvegardes disponibles :"
  ls -la ./backups/*.dump 2>/dev/null || echo "  (aucune trouvée dans ./backups)"
  exit 1
fi

if [ ! -f "$FICHIER" ]; then
  echo "❌ Fichier introuvable : $FICHIER"
  exit 1
fi

echo "⚠️  ATTENTION : ceci va REMPLACER toutes les données actuelles de la base"
echo "   par le contenu de : $FICHIER"
echo
read -p "Taper OUI en majuscules pour confirmer : " CONFIRMATION
if [ "$CONFIRMATION" != "OUI" ]; then
  echo "Annulé."
  exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Arrêt du backend (évite les écritures pendant la restauration)..."
docker compose stop backend

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restauration en cours..."
cat "$FICHIER" | docker compose exec -T db pg_restore -U rzi -d rzi_camp --clean --if-exists

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Redémarrage du backend..."
docker compose start backend

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Restauration terminée."
