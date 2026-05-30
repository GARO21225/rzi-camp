#!/bin/bash
# À exécuter sur ton ordinateur dans le dossier où tu as extrait le ZIP

set -e
echo "=== Push complet vers GitHub ==="

# Vérifier qu'on est dans le bon dossier
if [ ! -f "frontend/index.html" ] || [ ! -f "frontend/src/main.jsx" ]; then
  echo "ERREUR: Lance ce script depuis le dossier rzi-camp (où il y a frontend/ et backend/)"
  exit 1
fi

echo "✓ Structure correcte détectée"

# Initialiser git si pas déjà fait
if [ ! -d ".git" ]; then
  git init
  git remote add origin https://github.com/GARO21225/rzi-camp.git
fi

# S'assurer qu'on est sur main
git checkout -B main 2>/dev/null || true

# Ajouter TOUS les fichiers
git add -A

# Vérifier les fichiers clés
echo ""
echo "=== Fichiers clés présents ==="
git ls-files frontend/src/main.jsx && echo "✓ main.jsx"
git ls-files frontend/src/pages/Login.jsx && echo "✓ Login.jsx"
git ls-files backend/maintenance/views.py && echo "✓ maintenance/views.py"
git ls-files backend/restauration/views.py && echo "✓ restauration/views.py"

echo ""
git commit -m "fix: build + refonte + tous bugs corrigés $(date +%Y-%m-%d_%H-%M)"
git push -u origin main --force

echo ""
echo "✅ Push terminé ! Render va redéployer automatiquement."
