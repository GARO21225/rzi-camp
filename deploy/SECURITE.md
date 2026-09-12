# Sécurité du serveur — RZI Camp

## ⚠️ Avant de commencer

Certaines étapes ci-dessous (SSH) peuvent te bloquer dehors si elles sont
faites dans le mauvais ordre. **Ne jamais** fermer ta session SSH actuelle
avant d'avoir vérifié qu'une nouvelle connexion fonctionne toujours. Garde
cette session ouverte pendant tout le processus.

## 1. Corrigé dans ce commit : le backend n'est plus exposé publiquement

`docker-compose.yml` publiait `8001:8000` — le backend Django était donc
accessible directement en HTTP non chiffré sur l'IP publique du serveur,
en contournant complètement nginx (SSL, WebSocket, compression). Aucune
partie de l'application n'en avait besoin (le frontend accède au backend
en interne via le réseau Docker). Retiré.

Après déploiement, vérifie que ce port ne répond plus du tout depuis
l'extérieur :
```bash
curl -m 5 http://204.168.229.74:8001/api/version/
# doit échouer ("Connection refused" ou timeout) - c'est le résultat voulu
```

## 2. Pare-feu (UFW) — n'autoriser que le strict nécessaire

```bash
sudo apt install -y ufw
sudo ufw allow 22/tcp        # SSH — indispensable, sinon tu te bloques dehors
sudo ufw allow 5173/tcp      # L'application (HTTPS)
sudo ufw --force enable
sudo ufw status verbose
```
Vérifie que **22** et **5173** apparaissent bien, puis dans un **nouvel**
onglet de terminal (sans fermer celui-ci), reconnecte-toi en SSH pour
confirmer que ça fonctionne toujours avant de continuer.

## 3. Mises à jour de sécurité automatiques

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```
Répondre "Oui" à la question posée. Le serveur installera désormais seul
les correctifs de sécurité critiques.

## 4. Fail2ban — bloque les tentatives de connexion SSH répétées

```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

## 5. Durcir SSH (⚠️ faire dans cet ordre précis, avec vérification à chaque étape)

**Étape A — s'assurer qu'une connexion par clé SSH fonctionne AVANT toute
chose.** Si tu ne te connectes aujourd'hui qu'avec un mot de passe, arrête-toi
ici et dis-le-moi : il faut d'abord mettre en place une clé SSH, sinon les
étapes suivantes te bloquent dehors définitivement.

Pour vérifier si tu as déjà une clé configurée :
```bash
cat ~/.ssh/authorized_keys 2>/dev/null && echo "Une clé existe" || echo "Aucune cle - NE PAS CONTINUER l'etape 5"
```

**Étape B — uniquement si l'étape A confirme une clé existante :**
```bash
sudo nano /etc/ssh/sshd_config
```
Modifier (ou ajouter) ces lignes :
```
PermitRootLogin no
PasswordAuthentication no
```
Puis :
```bash
sudo systemctl restart sshd
```
**Avant de fermer ta session actuelle**, ouvre un nouveau terminal et
confirme que tu peux te reconnecter avec ta clé. Si ça ne fonctionne pas,
reviens sur `PasswordAuthentication yes` immédiatement depuis la session
encore ouverte.

## 6. Vérification finale

```bash
sudo ufw status
docker compose ps
free -h
```
