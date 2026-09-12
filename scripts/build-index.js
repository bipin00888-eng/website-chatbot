// Builds data/embeddings.json from everything in content/*.md and content/*.txt.
// Run: npm run build-index   (requires GEMINI_API_KEY in the environment)

const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, '..', 'content');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'embeddings.json');
const EMBED_MODEL = 'gemini-embedding-001';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey');
  console.error('Then run: GEMINI_API_KEY=your-key npm run build-index');
  process.exit(1);
}

function chunkText(text, source) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20)
    .map((p) => ({ text: p, source }));
}

async function embed(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text }] },
    }),
  });
  if (!res.ok) {
    throw new Error(`Embedding request failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.embedding.values;
}

async function main() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`No content directory found at ${CONTENT_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.md') || f.endsWith('.txt'));

  if (files.length === 0) {
    console.error('No .md or .txt files found in content/. Add some and try again.');
    process.exit(1);
  }

  let chunks = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
    chunks = chunks.concat(chunkText(raw, file));
  }

  console.log(`Found ${chunks.length} chunks across ${files.length} file(s). Embedding...`);

  const results = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    process.stdout.write(`  [${i + 1}/${chunks.length}] ${chunk.source}... `);
    try {
      const embedding = await embed(chunk.text);
      results.push({ text: chunk.text, source: chunk.source, embedding });
      console.log('ok');
    } catch (err) {
      console.log('FAILED');
      console.error(err.message);
      process.exit(1);
    }
    // Small delay to stay comfortably under free-tier rate limits.
    await new Promise((r) => setTimeout(r, 200));
  }

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`Wrote ${results.length} embedded chunks to ${OUTPUT_FILE}`);
}

main();
