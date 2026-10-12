# Sauvegarde & restauration — RZI Camp

## Ce qui est couvert

- **Base de données complète** (Personnel, Maintenance, Restauration, Voyages,
  Historique, Paramétrage, tout) via `pg_dump`, format compressé restaurable.
- **`.env`** (clé secrète Django) — sans lui, restaurer la base sur un nouveau
  serveur déconnecte quand même tout le monde (tokens invalidés).

## Ce qui n'est PAS couvert (à faire une fois, séparément)

- **Le code de l'application** — déjà en sécurité sur GitHub, rien à faire.
- **Les copies hors-serveur** — voir section dédiée plus bas. Sans ça, une
  panne physique du serveur Hetzner (disque mort, incendie du datacenter,
  etc.) emporte à la fois la base ET ses sauvegardes locales.
- **Le certificat SSL auto-signé** — pas critique : s'il est perdu, un nouveau
  est régénéré automatiquement au prochain démarrage (voir
  `docker-entrypoint-ssl.sh`), il faudra juste ré-accepter l'avertissement
  navigateur une fois.

## Mise en place (une seule fois)

```bash
cd /opt/stacks/rzi-camp
chmod +x deploy/backup.sh deploy/restore.sh

# Tester manuellement une première fois
./deploy/backup.sh

# Automatiser : tous les jours à 2h du matin
crontab -e
# Ajouter cette ligne :
0 2 * * * cd /opt/stacks/rzi-camp && ./deploy/backup.sh >> /var/log/rzi-camp-backup.log 2>&1
```

Rétention par défaut : **30 jours** glissants (modifiable en tête de
`deploy/backup.sh`, variable `RETENTION_JOURS`).

## Vérifier que ça tourne

```bash
ls -la /opt/stacks/rzi-camp/backups/
tail -20 /var/log/rzi-camp-backup.log
```

## Restaurer après un incident

```bash
cd /opt/stacks/rzi-camp
ls -lh backups/                                   # choisir un fichier
./deploy/restore.sh backups/rzi_camp_AAAAMMJJ_HHMMSS.dump backups/media_AAAAMMJJ_HHMMSS.tgz
```
Le 2e argument (médias : vidéos d'induction, photos) est facultatif. ⚠️ Destructif : remplace toutes les données
actuelles ; confirmation « OUI » demandée ; le backend est arrêté pendant l'opération puis relancé.

### Restaurer sur un NOUVEAU serveur (VPS perdu)
```bash
git clone https://github.com/GARO21225/rzi-camp /opt/stacks/rzi-camp && cd /opt/stacks/rzi-camp
git checkout claude/focused-rubin-9cy2g2
# récupérer depuis le serveur de secours le .env et les dernières sauvegardes
rsync -av USER@IP_AUTRE_VPS:/home/backup/rzi-camp-backups/ ./backups/
cp backups/env_AAAAMMJJ_HHMMSS.bak .env            # (le plus récent)
docker compose up -d db redis && sleep 15
docker compose up -d --build
./deploy/restore.sh backups/rzi_camp_AAAAMMJJ_HHMMSS.dump backups/media_AAAAMMJJ_HHMMSS.tgz
docker compose exec backend python manage.py migrate
```

## Vérifier que la sauvegarde automatique tourne
```bash
crontab -l | grep backup                  # la ligne cron existe ?
ls -lh /opt/stacks/rzi-camp/backups/ | tail -5   # un .dump récent (< 24 h) et sa taille ?
tail -20 /var/log/rzi-camp-backup.log     # "Sauvegarde base terminée" sans erreur ?
```

## Copies hors-serveur (recommandé, pas encore en place)

Les sauvegardes ci-dessus restent **sur le même serveur** que l'application.
En cas de panne physique du serveur lui-même, elles disparaissent avec le
reste. Pour s'en protéger, copier périodiquement le dossier `backups/` vers
un autre emplacement — au choix, selon ce qui est disponible :

### Option A — Un autre VPS / serveur (script prêt : `deploy/backup-sync-local.sh`)

```bash
# 1. Sur CE serveur : clé SSH dédiée (une fois)
ssh-keygen -t ed25519 -f ~/.ssh/rzi_backup_key -N ""
ssh-copy-id -i ~/.ssh/rzi_backup_key.pub USER@IP_AUTRE_VPS

# 2. Configuration (fichier ignoré par git)
cp deploy/backup.conf.example deploy/backup.conf && nano deploy/backup.conf

# 3. Test manuel
./deploy/backup-sync-local.sh

# 4. Automatiser (30 min après la sauvegarde de 2h)
crontab -e
30 2 * * * cd /opt/stacks/rzi-camp && ./deploy/backup-sync-local.sh >> /var/log/rzi-camp-backup.log 2>&1
```
La copie distante n'utilise PAS `--delete` : si les sauvegardes locales disparaissent par erreur, celles du
serveur de secours sont conservées (purge distante après `RETENTION_DISTANTE_JOURS`, 90 j par défaut).

### Option B — Un service cloud (Hetzner Storage Box, S3, Backblaze...)

Via `rclone`, non fourni ici (dépend du service choisi et de ses identifiants).

Cette étape n'a pas été automatisée par défaut pour l'option B car elle
dépend d'un compte/service externe que seul l'exploitant du serveur peut
choisir et configurer — dites lequel est disponible et le script d'envoi
peut être ajouté ensuite.

## Export manuel ponctuel (secondaire)

Un export JSON manuel existe aussi, déclenchable depuis un navigateur, utile
pour une copie ponctuelle rapide (moins complet qu'un `pg_dump`, mais portable
entre moteurs de base de données) :
```
https://204.168.229.74:5173/api/backup-complet/?secret=<SETUP_DB_SECRET>
```
Nécessite que `SETUP_DB_SECRET` soit défini dans `.env` (voir `.env.example`)
— sinon l'endpoint reste désactivé par sécurité.
