// Vercel serverless function: POST { message, history } -> { reply }
// Does retrieval (cosine similarity over data/embeddings.json) then calls Gemini.

const embeddings = require('../data/embeddings.json');

const API_KEY = process.env.GEMINI_API_KEY;
const EMBED_MODEL = 'gemini-embedding-001';
const CHAT_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const TOP_K = 4;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embedQuery(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text }] },
    }),
  });
  if (!res.ok) throw new Error(`Embedding failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.embedding.values;
}

function topMatches(queryEmbedding) {
  if (!embeddings || embeddings.length === 0) return [];
  return embeddings
    .map((chunk) => ({ ...chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K)
    .filter((c) => c.score > 0.5);
}

async function askGemini(message, history, context) {
  const systemInstruction = {
    parts: [
      {
        text:
          'You are a helpful assistant embedded on a business website. ' +
          'Answer questions using ONLY the CONTEXT below when it is relevant. ' +
          "If the answer isn't in the context and it's a specific factual question about the business, " +
          "say you don't have that information and suggest contacting the business directly. " +
          'For general conversation, be friendly and concise.\n\n' +
          `CONTEXT:\n${context || '(no relevant context found)'}`,
      },
    ],
  };

  const contents = [
    ...(history || []).map((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.text }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CHAT_MODEL}:generateContent?key=${API_KEY}`;
  const body = JSON.stringify({
    systemInstruction,
    contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (res.ok || (res.status !== 503 && res.status !== 429)) break;
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }

  if (!res.ok) throw new Error(`Generation failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  return reply || "Sorry, I couldn't generate a response just now.";
}

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!API_KEY) {
    res.status(500).json({ error: 'Server is missing GEMINI_API_KEY' });
    return;
  }

  try {
    const { message, history } = req.body || {};
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Missing "message" string in request body' });
      return;
    }

    const queryEmbedding = await embedQuery(message);
    const matches = topMatches(queryEmbedding);
    const context = matches.map((m) => `- ${m.text}`).join('\n');

    const reply = await askGemini(message, history, context);
    res.status(200).json({ reply, sources: matches.map((m) => m.source) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong handling your message.' });
  }
};
