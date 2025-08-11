# API Miroir de l’Être — Vercel (ultra-simple)

## Fichiers
- `api/miroir.js` : la Serverless Function (Node.js, CommonJS)
- `package.json` : minimal, aucune dépendance

## Déploiement — Sans CLI, via GitHub (facile)
1. Sur **GitHub**, crée un nouveau dépôt vide (bouton **New**).
2. Clique **Add file → Upload files** et **dépose le contenu de ce ZIP** (le dossier entier).
3. Sur **vercel.com**, clique **New Project** → **Import Git Repository** → choisis ton dépôt → **Deploy**.
4. Dans le projet Vercel : **Settings → Environment Variables** → ajoute `OPENAI_API_KEY` (ta clé) → **Redeploy**.
5. L’URL de l’API sera du type : `https://TON-PROJET.vercel.app/api/miroir`.

## Appel de test
Remplace l’URL et les valeurs par tes nombres réduits :
```
curl -X POST https://TON-PROJET.vercel.app/api/miroir   -H "Content-Type: application/json"   -d '{"axes":{"d":12,"m":7,"y":6,"terre":12,"ci":19,"ne":18,"ce":13,"pe":5,"rh":14},"parents":{"terre":["d","m","y"],"ci":["d","m"],"ne":["d","y"],"ce":["m","y"],"pe":["ci","ce"],"rh":["terre","pe"]},"locale":"fr"}'
```