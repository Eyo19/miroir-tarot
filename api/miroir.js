// api/miroir.js — Vercel Serverless (CommonJS) compatible service/project keys
// - Supporte sk-svcacct-… et sk-proj-… via les headers OpenAI-Project / OpenAI-Organization
// - Affiche les erreurs OpenAI en clair pour débug

module.exports = async (req, res) => {
  // --- CORS (pour ouvrir le HTML en local) ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method_not_allowed', detail: 'Use POST.' });
      return;
    }

    // 0) Variables d’env
    const API_KEY = process.env.OPENAI_API_KEY;              // <- obligatoire
    const PROJECT = process.env.OPENAI_PROJECT || '';        // <- recommandé avec sk-svcacct ou sk-proj
    const ORG     = process.env.OPENAI_ORG || '';            // <- optionnel

    if (!API_KEY) {
      res.status(500).json({
        error: 'openai_error',
        detail: 'Missing OPENAI_API_KEY in Vercel environment variables.'
      });
      return;
    }

    // 1) Lecture body (req.body pas toujours dispo selon runtime)
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let payload = {};
    try { payload = JSON.parse(raw || '{}'); } catch { payload = {}; }

    const { axes, parents, locale = 'fr' } = payload || {};
    if (!axes || typeof axes !== 'object' || !parents) {
      res.status(400).json({ error: 'bad_request', detail: 'Missing "axes" or "parents" in body' });
      return;
    }

    // 2) Prompts
    const system = `
Tu es un analyste du "Miroir de l’Être" (Kris Hadar).
Règle: ≤22 gardé, sinon somme des chiffres (22 = Le Mat).
9 positions: Jour(Eau), Mois(Air), Année(Feu), Terre, Comportement intérieur, Nœud d’émotion, Comportement extérieur, Personnalité extérieure, Recherche d’harmonie.
Loi du triangle: analyser la carte issue d’une somme à la lumière EXPLICITE de ses deux parents (dynamique, convergences/tensions), pas seulement les nommer.
Style FR: naturel, nuancé, sans injonctions morales ni phrases génériques.
Chaque position: ~130–170 mots, structurés en: Lumière / Ombre / Besoins / Leviers / Triangle (analyse).
Réponse STRICTEMENT en JSON (objet "cards" → 9 positions).
`.trim();

    const user = JSON.stringify({ locale, axes, parents });

    // 3) Appel OpenAI — modèle stable + headers projet/orga si fournis
    const headers = {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    };
    if (PROJECT) headers['OpenAI-Project'] = PROJECT;       // <- clé service/projet : important
    if (ORG)     headers['OpenAI-Organization'] = ORG;      // <- si ton org est requise

    const rsp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        top_p: 0.9,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });

    if (!rsp.ok) {
      const text = await rsp.text();
      res.status(500).json({ error: 'openai_error', detail: text });
      return;
    }

    const data = await rsp.json();
    const content = data?.choices?.[0]?.message?.content || '{}';

    let out;
    try { out = JSON.parse(content); }
    catch { out = { error: 'bad_json_from_ai', content }; }

    const result = out?.cards ? out : { cards: out };

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.status(200).json(result);

  } catch (e) {
    res.status(500).json({ error: 'server_error', detail: String(e) });
  }
};
