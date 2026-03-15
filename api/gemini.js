const DEFAULT_MODEL = 'gemini-3-flash';
const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

const extractTextFromResponse = (payload) => {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  const parts = candidates
    .flatMap((candidate) => Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [])
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .filter(Boolean);

  return parts.join('\n').trim();
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
    const document = body.document && typeof body.document === 'object' ? body.document : null;

    if (!prompt) {
      return res.status(400).json({ error: 'Thieu prompt.' });
    }

    const headerKey = req.headers['x-gemini-key'];
    const clientApiKeyRaw = Array.isArray(headerKey) ? headerKey[0] : headerKey;
    const clientApiKey = typeof clientApiKeyRaw === 'string' ? clientApiKeyRaw.trim() : '';
    const envApiKey = typeof process.env.GEMINI_API_KEY === 'string' ? process.env.GEMINI_API_KEY.trim() : '';
    const apiKey = envApiKey || clientApiKey;

    if (!apiKey) {
      return res.status(500).json({
        error: 'Thieu GEMINI_API_KEY tren server (Vercel env) hoac chua nhap API key trong app.',
      });
    }

    const parts = [{ text: prompt }];
    if (document) {
      const mimeType = String(document.mimeType || '').trim();
      const dataBase64 = String(document.base64Data || '').trim();

      if (!mimeType || !dataBase64) {
        return res.status(400).json({ error: 'Tai lieu dinh kem khong hop le.' });
      }

      parts.push({
        inlineData: {
          mimeType,
          data: dataBase64,
        },
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: maxTokens,
          },
        }),
      },
    );

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const status = response.status;
      const message = payload?.error?.message || `Gemini request failed (${status})`;
      return res.status(status).json({ error: message });
    }

    const text = extractTextFromResponse(payload);
    if (!text) {
      return res.status(502).json({ error: 'Gemini tra ve rong, vui long thu lai.' });
    }

    return res.status(200).json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return res.status(500).json({ error: message });
  }
}

