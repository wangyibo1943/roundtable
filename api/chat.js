export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { model, system, messages } = req.body;
  if (!system || !messages) return res.status(400).json({ error: 'Missing params' });

  try {
    // ── CLAUDE ──────────────────────────────────────────
    if (!model || model === 'claude') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system,
          messages
        })
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Claude error' });
      return res.status(200).json({ text: data.content?.[0]?.text || '' });
    }

    // ── GPT ─────────────────────────────────────────────
    if (model === 'gpt') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 1000,
          messages: [
            { role: 'system', content: system },
            ...messages
          ]
        })
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'GPT error' });
      return res.status(200).json({ text: data.choices?.[0]?.message?.content || '' });
    }

    // ── GEMINI ──────────────────────────────────────────
    if (model === 'gemini') {
      const prompt = `${system}\n\n${messages[messages.length - 1].content}`;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 1000 }
          })
        }
      );
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Gemini error' });
      return res.status(200).json({ text: data.candidates?.[0]?.content?.parts?.[0]?.text || '' });
    }

    return res.status(400).json({ error: 'Unknown model: ' + model });

  } catch (error) {
    return res.status(500).json({ error: '服务器错误：' + error.message });
  }
}
