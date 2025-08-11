// api/miroir.js — Fonction serverless Vercel (Node.js CommonJS)

// Import officiel de l'API OpenAI
const OpenAI = require('openai');

// On instancie le client avec la clé définie dans Vercel → Settings → Environment Variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

module.exports = async (req, res) => {
  // --- Gestion CORS ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Réponse immédiate à la pré-requête
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed. Use POST.' });
      return;
    }

    // Récupération du body envoyé par l'app front
    const { axes, parents, locale } = req.body;
    if (!axes || !parents) {
      res.status(400).json({ error: 'Missing axes or parents in request body.' });
      return;
    }

    // Prépare le prompt dynamique pour GPT
    const systemPrompt = `
Tu es un expert du Tarot de Marseille, spécialiste de l'analyse numérologique et symbolique
des arcanes majeurs selon la méthode des 9 positions décrites ci-dessous.
Tu connais aussi la loi du triangle : lorsqu'une carte est obtenue par la somme de deux autres,
elle doit être interprétée à la lumière de leurs influences combinées.

Règles :
- Pas d'injonctions morales.
- Analyse riche, nuancée, inspirante.
- Texte fluide, pas de listes à puces sauf si nécessaire.
- Lumière (atouts), Ombre (pièges), Besoins (ressources à nourrir), Leviers (axes d'évolution).
- Si carte issue d'une somme, intégrer une analyse fine du triangle (influences des deux cartes sources).
- Style en français clair, avec vocabulaire symbolique et psychologique.
- Aucun texte générique vide de sens.

Positions :
1. Jour (Eau) : émotions, vie intérieure, caractère intime.
2. Mois (Air) : intellection, compréhension du monde, équilibre eau/feu.
3. Année (Feu) : perception, extérieur, manière d’agir.
4. Terre : somme de Jour + Mois + Année, rapport au corps, au concret, personnalité profonde.
5. Comportement intérieur : somme de Jour + Mois, comportements dans l'intimité.
6. Nœud d’émotion : somme de Jour + Année, manière d’aimer, empreinte affective profonde.
7. Comportement extérieur : somme de Mois + Année, comportement social.
8. Personnalité extérieure : somme de comportements intérieur + extérieur, place dans la société.
9. Recherche d’harmonie : équilibre entre personnalité profonde et extérieure.

Format de réponse : JSON avec 9 clés (jour, mois, annee, terre, ci, ne, ce, pe, rh),
chacune contenant { titre, element, lumiere, ombre, besoins, leviers, triangle? }.
`;

    // On construit le message utilisateur à partir des axes
    let userPrompt = `Voici les cartes :\n`;
    Object.keys(axes).forEach(k => {
      userPrompt += `- ${k} : ${axes[k]}\n`;
    });
    userPrompt += `\nParents : ${JSON.stringify(parents, null, 2)}`;

    // Appel à l'API OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // ou "gpt-4.1" si dispo sur ton compte
      temperature: 0.9,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    });

    const json = JSON.parse(completion.choices[0].message.content);
    res.status(200).json({ cards: json });

  } catch (error) {
    console.error('Erreur miroir.js :', error);
    res.status(500).json({ error: error.message });
  }
};
