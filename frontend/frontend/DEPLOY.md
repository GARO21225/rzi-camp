# GUIDE DE DÉPLOIEMENT — RZI Camp

## Étapes après téléchargement du ZIP

### 1. Extraire et pusher sur GitHub

```bash
# Extraire le ZIP dans ton dossier projet
# Puis dans le terminal:
cd /chemin/vers/rzi-camp
git add -A
git commit -m "Fix analyses, dashboard, bons roxgold, sous-traitants masse v1779680747"
git push origin main
```

### 2. Vérifier le déploiement sur Render

1. Aller sur https://dashboard.render.com
2. Cliquer sur ton service **rzi-camp-backend**
3. Onglet **"Events"** → voir si un nouveau deploy a démarré
4. Si pas de deploy automatique → cliquer **"Manual Deploy" → "Deploy latest commit"**

### 3. Confirmer que le bon code est déployé

Ouvrir dans le navigateur:
```
https://rzi-camp-backend.onrender.com/api/version/
```

Doit afficher:
```json
{"version": "1779680747", "fixes": ["analyses-expressionwrapper", ...]}
```

### 4. Si les changements frontend ne s'affichent pas

Sur ton navigateur: **Ctrl + Shift + R** (rechargement forcé sans cache)

### 5. Après déploiement backend

Aller dans **Diagnostic → "Initialiser les données maintenant"**
→ Crée la table BonCaisse si absente

---
Build: 1779680747
