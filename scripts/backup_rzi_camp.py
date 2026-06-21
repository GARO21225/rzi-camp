#!/usr/bin/env python3
"""
RZI Camp — Script de sauvegarde externe.

Récupère un export JSON complet de la base de production via
/api/backup-complet/ et l'enregistre localement, horodaté.

Pourquoi ce script existe :
La base PostgreSQL gratuite de Render expire après un délai fixe (30-90 jours
selon la politique en vigueur) et est supprimée DÉFINITIVEMENT sans période
de grâce ni récupération possible. Ce projet n'avait jusqu'ici AUCUN mécanisme
de sauvegarde. Ce script comble ce manque sans dépendre du Render Dashboard ni
d'outils CLI PostgreSQL (pg_dump n'est pas installé sur l'environnement Render) :
l'export se fait côté Django via `dumpdata`, ce script ne fait que le récupérer
et le stocker ailleurs que sur Render.

Utilisation :
    python backup_rzi_camp.py

Variables d'environnement requises :
    RZI_BACKUP_URL     — ex: https://rzi-camp-backend.onrender.com/api/backup-complet/
    RZI_BACKUP_SECRET  — la valeur de SETUP_DB_SECRET configurée sur Render

Peut être exécuté :
- Manuellement depuis n'importe quel poste avec Python 3 (aucune dépendance
  externe, seulement la lib standard — pas besoin de pip install).
- Via un cron local (crontab -e, voir exemple en bas de fichier).
- Via GitHub Actions (workflow gratuit, voir .github/workflows/backup.yml
  fourni séparément) — c'est l'option recommandée car elle ne dépend pas
  qu'un poste personnel soit allumé au bon moment.

Restauration :
    Le fichier JSON produit est restaurable sur n'importe quel projet Django
    avec le même schéma de modèles via :
        python manage.py loaddata rzi_camp_backup_YYYYMMDD_HHMMSS.json
    Cela fonctionne identiquement que la cible soit Render, un autre cloud,
    ou un serveur local — c'est tout l'intérêt de ne pas dépendre de pg_dump.
"""
import os
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

# ── Configuration ──────────────────────────────────────────────────
BACKUP_URL = os.environ.get(
    "RZI_BACKUP_URL", "https://rzi-camp-backend.onrender.com/api/backup-complet/"
)
BACKUP_SECRET = os.environ.get("RZI_BACKUP_SECRET", "")
OUTPUT_DIR = Path(os.environ.get("RZI_BACKUP_DIR", "./backups"))
KEEP_LAST_N = int(os.environ.get("RZI_BACKUP_KEEP_LAST_N", "30"))  # rétention locale


def fail(message: str, code: int = 1):
    print(f"[ERREUR] {message}", file=sys.stderr)
    sys.exit(code)


def main():
    if not BACKUP_SECRET:
        fail(
            "RZI_BACKUP_SECRET n'est pas défini. "
            "Exporte-le avant d'exécuter ce script : export RZI_BACKUP_SECRET='...'"
        )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    url = f"{BACKUP_URL}?secret={BACKUP_SECRET}"
    print(f"[INFO] Récupération du backup depuis {BACKUP_URL} ...")

    try:
        # Timeout long volontaire : un export complet de toute la base peut
        # prendre du temps sur le plan gratuit Render (cold start + volume).
        req = urllib.request.Request(url, headers={"User-Agent": "rzi-camp-backup-script"})
        with urllib.request.urlopen(req, timeout=120) as response:
            if response.status != 200:
                fail(f"Le serveur a répondu avec le statut {response.status}")
            data = response.read()
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        fail(f"Échec HTTP {e.code} : {body[:300]}")
    except urllib.error.URLError as e:
        fail(f"Échec réseau : {e.reason}")

    # Validation minimale : s'assurer que la réponse est bien du JSON exploitable
    # avant de l'écrire sur disque — un fichier vide ou une page d'erreur HTML
    # ne doit jamais remplacer silencieusement un backup valide.
    try:
        parsed = json.loads(data)
        if not isinstance(parsed, list):
            fail("La réponse ne ressemble pas à un export dumpdata valide (attendu : une liste JSON).")
        record_count = len(parsed)
    except json.JSONDecodeError:
        fail("La réponse reçue n'est pas du JSON valide — backup NON enregistré pour éviter un fichier corrompu.")

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = OUTPUT_DIR / f"rzi_camp_backup_{timestamp}.json"
    filename.write_bytes(data)

    size_kb = len(data) / 1024
    print(f"[OK] Backup enregistré : {filename} ({size_kb:.1f} Ko, {record_count} enregistrements)")

    # ── Rétention : ne garder que les N derniers backups locaux ──
    # (objectif : éviter une croissance illimitée du dossier, pas une politique
    # de rétention long terme — pour ça, voir la note GitHub Actions ci-dessous)
    existing = sorted(OUTPUT_DIR.glob("rzi_camp_backup_*.json"))
    if len(existing) > KEEP_LAST_N:
        for old_file in existing[: len(existing) - KEEP_LAST_N]:
            old_file.unlink()
            print(f"[INFO] Ancien backup supprimé (rétention {KEEP_LAST_N}) : {old_file.name}")

    print("[OK] Sauvegarde terminée avec succès.")


if __name__ == "__main__":
    main()

# ─────────────────────────────────────────────────────────────────
# Exemple de crontab pour une exécution quotidienne à 3h du matin :
#
#   0 3 * * * RZI_BACKUP_SECRET='...' /usr/bin/python3 /chemin/vers/backup_rzi_camp.py >> /var/log/rzi_backup.log 2>&1
#
# Recommandation : préférer le workflow GitHub Actions fourni séparément
# (.github/workflows/backup.yml) plutôt qu'un cron local — il s'exécute
# même si aucun poste personnel n'est allumé, et GitHub Actions est gratuit
# pour ce volume d'exécution (quelques minutes par jour).
# ─────────────────────────────────────────────────────────────────
