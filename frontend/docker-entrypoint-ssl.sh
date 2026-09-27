#!/bin/sh
# Génère le certificat auto-signé une seule fois, au premier démarrage, sur
# un volume persistant (voir docker-compose.yml: ssl_data monté sur
# /etc/nginx/ssl). Avant ce script, le certificat était généré à CHAQUE
# build d'image (RUN openssl dans le Dockerfile) : chaque redéploiement
# changeait donc le certificat, invalidant l'exception de sécurité que le
# navigateur avait mémorisée — d'où la bannière "hors ligne" qui revenait
# après chaque mise à jour de l'app, même en étant réellement en ligne.
set -e

CERT_DIR=/etc/nginx/ssl
mkdir -p "$CERT_DIR"

if [ ! -f "$CERT_DIR/selfsigned.crt" ] || [ ! -f "$CERT_DIR/selfsigned.key" ]; then
  echo "[ssl] Aucun certificat existant sur le volume — génération (une seule fois)."
  # SAN inclut l'IP ET le domaine (app.roxgold-sitelife.com) : sans ça,
  # accéder à l'app par le nom de domaine plutôt que par l'IP brute
  # provoquerait une erreur de certificat SUPPLÉMENTAIRE (hostname mismatch)
  # en plus de l'avertissement "auto-signé" déjà accepté une fois par le
  # navigateur — un seul certificat couvre les deux façons d'accéder à
  # l'app pendant la transition IP -> domaine.
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout "$CERT_DIR/selfsigned.key" \
    -out "$CERT_DIR/selfsigned.crt" \
    -subj "/CN=app.roxgold-sitelife.com" \
    -addext "subjectAltName=DNS:app.roxgold-sitelife.com,IP:204.168.229.74"
else
  echo "[ssl] Certificat existant trouvé sur le volume — conservé tel quel."
  echo "[ssl] ATTENTION : si ce certificat a été généré AVANT l'ajout du domaine"
  echo "[ssl] app.roxgold-sitelife.com à son SAN, il ne couvrira que l'IP — supprimez"
  echo "[ssl] le volume ssl_data (docker volume rm) pour forcer une régénération."
fi
