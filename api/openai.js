const DEFAULT_MODEL = 'gpt-4.1-mini';
const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

const extractTextFromResponse = (payload) => {
  if (!payload) return '';
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }

  if (!Array.isArray(payload.output)) return '';

  const chunks = payload.output
    .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    .map((part) => {
      if (typeof part?.text === 'string') return part.text;
      if (typeof part?.value === 'string') return part.value;
      return '';
    })
    .filter(Boolean);

  return chunks.join('\n').trim();
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const prompt = String(body.prompt || '').trim();
    const model = String(body.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
    const maxTokens = Number(body.maxTokens) || DEFAULT_MAX_OUTPUT_TOKENS;

    if (!prompt) {
      return res.status(400).json({ error: 'Thiếu prompt.' });
    }

    const headerKey = req.headers['x-openai-key'];
    const clientApiKey = Array.isArray(headerKey) ? headerKey[0] : headerKey;
    const apiKey = clientApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'Thiếu OPENAI_API_KEY trên server (Vercel env) hoặc chưa nhập API key trong app.',
      });
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: prompt,
        temperature: 0.7,
        max_output_tokens: maxTokens,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const status = response.status;
      const message = payload?.error?.message || `OpenAI request failed (${status})`;
      return res.status(status).json({ error: message });
    }

    const text = extractTextFromResponse(payload);
    return res.status(200).json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return res.status(500).json({ error: message });
  }
}
