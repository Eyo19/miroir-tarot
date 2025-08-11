// api/miroir.js — Vercel Serverless Function (Node.js, CommonJS) robuste + erreurs détaillées

module.exports = async (req, res) => {
  // --- CORS (indispensable si tu ouvres le HTML en local) ---
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

    // (1) Vérif clé API OpenAI
    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'openai_error', detail: 'Missing OPENAI_API_KEY in Vercel → Project → Settings → Environment Variables.' });
      return;
    }

    // (2) Parse JSON body de manière sûre (selon runtime, req.body peut être vide)
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let payload = {};
    try { payload = JSON.parse(raw || '{}'); } catch { payload = {}; }

    const { axes, parents, locale = 'fr' } = payload || {};
    if (!axes || typeof axes !== 'object' || !parents) {
      res.status(400).json({ error: 'bad_request', detail: 'Missing "axes" or "parents" in body' });
      return;
    }

    // (3) Prompts
    const system = `
Tu es un analyste du "Miroir de l’Être" (Kris Hadar).
Règle: ≤22 gardé, sinon somme des chiffres (22 = Le Mat).
9 positions: Jour(Eau), Mois(Air), Année(Feu), Terre, Comportement intérieur, Nœud d’émotion, Comportement extérieur, Personnalité extérieure, Recherche d’harmonie.
Loi du triangle: toute carte issue d’une somme s’interprète à la lumière de ses deux parents (dynamique précise, pas juste les nommer).
Style FR: naturel, nuancé, sans injonctions morales ni phrases génériques.
Chaque position: ~130–170 mots (si possible), structurés en: Lumière / Ombre / Besoins / Leviers / Triangle (analyse).
Réponse STRICTEMENT en JSON (objet "cards" → 9 positions).
`.trim();

    const user = JSON.stringify({ locale, axes, parents });

    // (4) Appel OpenAI — modèle stable
    const rsp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',                 // ← modèle disponible très largement
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
      const text = await rsp.text(); // retourne le JSON d’erreur OpenAI
      res.status(500).json({ error: 'openai_error', detail: text });
      return;
    }

    const data = await rsp.json();
    const content = data?.choices?.[0]?.message?.content || '{}';
    let out;
    try { out = JSON.parse(content); }
    catch { out = { error: 'bad_json_from_ai', content }; }

    // (5) Toujours renvoyer { cards: {...} }
    const result = out?.cards ? out : { cards: out };

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.status(200).json(result);

  } catch (e) {
    res.status(500).json({ error: 'server_error', detail: String(e) });
  }
};
