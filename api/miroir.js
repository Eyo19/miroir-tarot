
// api/miroir.js — Vercel Serverless Function (Node.js, CommonJS)
module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed. Use POST.' });
      return;
    }

    // Parse JSON body
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let payload = {};
    try { payload = JSON.parse(raw || '{}'); } catch (e) {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }

    const { axes, parents, locale = 'fr' } = payload || {};
    if (!axes || typeof axes !== 'object') {
      res.status(400).json({ error: 'Missing \"axes\" object' });
      return;
    }

    const system = `
Tu es un analyste du "Miroir de l’Être" (Kris Hadar).
Règle: ≤22 gardé, sinon somme des chiffres (22 = Le Mat).
9 positions: Jour(Eau), Mois(Air), Année(Feu), Terre, Comportement intérieur, Nœud d’émotion, Comportement extérieur, Personnalité extérieure, Recherche d’harmonie.
Loi du triangle: toute carte issue d’une somme s’interprète en fonction de ses deux parents (leur dynamique précise).
Style FR: naturel, nuancé, sans injonction morale ni phrases génériques. Pas de jargon gratuit.
Chaque position: 130–170 mots, structurés en:
- Lumière
- Ombre
- Besoins
- Leviers
- Triangle (analyse concrète des deux parents; pas juste les nommer)
Évite les formules passe-partout. Ton concret, 1–2 images parlantes max.
`.trim();

    const ARCANA_META = {
      1:{L:"élan, expérimentation, ingéniosité", O:"dispersion, esbroufe"},
      2:{L:"savoir intérieur, mémoire, gestation", O:"inhibition, inertie"},
      3:{L:"créativité, parole féconde, diplomatie", O:"vanité, précipitation mentale"},
      4:{L:"structure, stabilité, autorité juste", O:"rigidité, domination"},
      5:{L:"transmission, guidance, sens", O:"moralisme, paternalisme"},
      6:{L:"choix, affinité, alliance", O:"indécision, dispersion"},
      7:{L:"cap, mouvement maîtrisé, volonté", O:"tension, dirigisme"},
      8:{L:"équité, clarté, mesure", O:"sévérité, rigidité morale"},
      9:{L:"prudence, temps long, soin", O:"isolement, pessimisme"},
      10:{L:"cycle, opportunité, relance", O:"instabilité, illusions de contrôle"},
      11:{L:"apprivoisement, courage tranquille", O:"brusquerie, orgueil"},
      12:{L:"inversion du regard, compassion", O:"sacrifice, stagnation"},
      13:{L:"mue, épuration, renaissance", O:"radicalité, casse sèche"},
      14:{L:"harmonie, circulation, adaptation", O:"tiédeur, évitement"},
      15:{L:"puissance vitale, désir, créativité brute", O:"attachements, manipulation"},
      16:{L:"libération, vérité éclat", O:"rupture mal gérée"},
      17:{L:"grâce, inspiration, naturalité", O:"fragilité, idéalisation"},
      18:{L:"imaginaire, intuition, mémoire", O:"peurs floues, projections"},
      19:{L:"joie, clarté, fraternité", O:"surface parfaite, orgueil lumineux"},
      20:{L:"réveil, appel, message", O:"bruit, attente de validation"},
      21:{L:"accomplissement, alliance des plans", O:"zone de confort diffuse"},
      22:{L:"quête, liberté, marche", O:"errance, imprudence"}
    };

    const payloadForAI = { locale, axes, parents, meta: { arcana_meta: ARCANA_META } };

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

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: 'server_error', detail: String(e) });
  }
};
