# Website Chatbot (Gemini + Vercel)

A drop-in chat widget for a static HTML site, backed by a small RAG (retrieval-augmented
generation) pipeline using Google Gemini's free tier, hosted as Vercel serverless functions.

## How it works

- `content/*.md` — your business info, FAQs, product/service details, in plain text.
- `scripts/build-index.js` — chunks that content and embeds each chunk with Gemini's
  `text-embedding-004`, saving vectors to `data/embeddings.json`.
- `api/chat.js` — a serverless function: embeds the incoming question, finds the most
  relevant chunks (cosine similarity), and asks Gemini to answer using only that context.
- `public/widget.js` — a single-file, dependency-free chat widget you embed with one
  `<script>` tag. `public/index.html` is a demo page showing it in place.

## 1. Get a free Gemini API key

Go to https://aistudio.google.com/apikey, sign in, and create a key. The free tier is enough
for a low/medium-traffic website chatbot.

## 2. Fill in your content

Edit `content/business-info.md` (or add more `.md`/`.txt` files in `content/`) with real
information about your business — about, services, FAQs, policies, contact info.

## 3. Build the embedding index

```
cd website-chatbot
GEMINI_API_KEY=your-key-here npm run build-index
```

(On Windows PowerShell: `$env:GEMINI_API_KEY="your-key-here"; npm run build-index`)

This writes `data/embeddings.json`. Re-run it any time you edit `content/`.

## 4. Run locally

```
npm install -g vercel   # if you don't have it
vercel dev
```

Set `GEMINI_API_KEY` when prompted, or create a `.env` file (copy `.env.example`). Open the
local URL it prints — you'll see the demo page with the chat bubble bottom-right.

## 5. Deploy to Vercel

```
vercel
```

Then in the Vercel dashboard for the project: **Settings → Environment Variables**, add
`GEMINI_API_KEY` with your key, and redeploy (`vercel --prod`).

## 6. Add the widget to your real website

Copy this one snippet into your site's HTML, just before `</body>`, on every page you want
the chatbot to appear:

```html
<script
  src="https://YOUR-DEPLOYMENT.vercel.app/widget.js"
  data-api-url="https://YOUR-DEPLOYMENT.vercel.app/api/chat"
  data-title="Ask us anything"
  data-greeting="Hi! Ask me anything about this site or business."
></script>
```

Replace `YOUR-DEPLOYMENT.vercel.app` with your actual deployed domain. That's it — no build
step needed on your existing site.

## Updating content later

1. Edit files in `content/`.
2. Re-run `npm run build-index` (needs `GEMINI_API_KEY` set).
3. Commit and redeploy (`vercel --prod`) so the new `data/embeddings.json` ships.

## Notes / next steps

- The API allows requests from any origin (`Access-Control-Allow-Origin: *`) so the widget
  works when embedded on a different domain than the Vercel deployment. If you want to lock
  it down to your domain only, edit `setCors` in `api/chat.js`.
- Conversation history is kept in the browser tab only (not stored server-side or in a
  database) — refreshing the page starts a new conversation.
- To make the agent take actions (e.g. look up an order, check availability) rather than
  just answer from text, that's a follow-up step: add tool/function-calling to the
  `askGemini` call in `api/chat.js`. Ask if you want that built out.
- Model used for answers is `gemini-flash-latest` (overridable via `GEMINI_MODEL` env var).
  Embeddings use `gemini-embedding-001`. (Available models depend on your API key/account —
  run `curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY"` to check.)
