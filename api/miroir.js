// api/miroir.js — Vercel Serverless Function (Node.js, CommonJS) robuste

module.exports = async (req, res) => {
  // --- CORS ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed. Use POST.' });
      return;
    }

    // --- Parse JSON body de manière sûre (req.body n’est pas toujours dispo selon le runtime)
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let payload = {};
    try { payload = JSON.parse(raw || '{}'); } catch { /* noop, payload reste {} */ }

    const { axes, parents, locale = 'fr' } = payload || {};
    if (!axes || typeof axes !== 'object' || !parents) {
      res.status(400).json({ error: 'Missing "axes" or "parents" in body' });
      return;
    }

    const system = `
Tu es un analyste du "Miroir de l’Être" (Kris Hadar).
Règle: ≤22 gardé, sinon somme des chiffres (22 = Le Mat).
9 positions: Jour(Eau), Mois(Air), Année(Feu), Terre, Comportement intérieur, Nœud d’émotion, Comportement extérieur, Personnalité extérieure, Recherche d’harmonie.
Loi du triangle: toute carte issue d’une somme s’interprète EN FONCTION DE SES DEUX PARENTS (leur dynamique précise, pas juste les nommer).
Style FR: naturel, nuancé, sans injonction morale ni phrases génériques.
Chaque position: 130–170 mots, structurés en: Lumière / Ombre / Besoins / Leviers / Triangle (analyse).
Réponse STRICTEMENT en JSON (objet "cards" → 9 positions).
`.trim();

    const payloadForAI = { locale, axes, parents };

    // Appel OpenAI en mode JSON (pas besoin du SDK ici)
    const rsp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-5-thinking',
        temperature: 0.7,
        top_p: 0.9,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(payloadForAI) }
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
    let out = {};
    try { out = JSON.parse(content); } catch { out = { error: 'bad_json_from_ai', content }; }

    // on force un schéma { cards: {...} } pour le front
    const result = out.cards ? out : { cards: out };

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: 'server_error', detail: String(e) });
  }
};
