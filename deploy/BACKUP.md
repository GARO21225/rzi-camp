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
./deploy/restore.sh backups/rzi_camp_20260906_020000.dump
```
⚠️ Destructif — remplace toutes les données actuelles. Le script demande une
confirmation explicite avant d'agir, et arrête proprement le backend pendant
l'opération pour éviter toute écriture concurrente.

## Copies hors-serveur (recommandé, pas encore en place)

Les sauvegardes ci-dessus restent **sur le même serveur** que l'application.
En cas de panne physique du serveur lui-même, elles disparaissent avec le
reste. Pour s'en protéger, copier périodiquement le dossier `backups/` vers
un autre emplacement — au choix, selon ce qui est disponible :

- Un **Hetzner Storage Box** (souvent le plus simple si déjà chez Hetzner) via `rclone` ou `rsync`.
- Un simple `scp` régulier vers un autre serveur/ordinateur.
- Un stockage cloud (S3, Backblaze...) via `rclone`.

Cette étape n'a pas été automatisée ici car elle dépend d'un compte/service
externe que seul l'exploitant du serveur peut choisir et configurer — dites
lequel est disponible et le script d'envoi peut être ajouté ensuite.

## Export manuel ponctuel (secondaire)

Un export JSON manuel existe aussi, déclenchable depuis un navigateur, utile
pour une copie ponctuelle rapide (moins complet qu'un `pg_dump`, mais portable
entre moteurs de base de données) :
```
https://204.168.229.74:5173/api/backup-complet/?secret=<SETUP_DB_SECRET>
```
Nécessite que `SETUP_DB_SECRET` soit défini dans `.env` (voir `.env.example`)
— sinon l'endpoint reste désactivé par sécurité.
