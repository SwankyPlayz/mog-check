# MOG Check

Camera-based face scoring demo. Single-page frontend plus one Netlify Function that does the scoring server-side. No login, no tracking, 3–10 photos enforced on both client and server.

> **Note:** the scoring in `netlify/functions/analyze.js` is deterministic, not a real AI model. See [Scoring](#scoring) below.

## File structure

```
mog-check/
├── index.html
├── netlify.toml
├── package.json
├── .env.example
├── .gitignore
└── netlify/
    └── functions/
        └── analyze.js
```

## Files

- **`index.html`** — the whole UI, camera handling and request logic in one file.
- **`netlify/functions/analyze.js`** — the backend. Holds every secret, enforces the 3–10 photo rule, and returns `{ mogScore, verdict, advice }`.
- **`netlify.toml`** — publish dir `.`, functions dir `netlify/functions`, esbuild bundler.
- **`package.json`** — no dependencies; Node 18+ has `fetch` and `FormData` built in.
- **`.env.example`** — copy to `.env` locally. Never commit `.env`.

## Deploy in 3 minutes

1. Push this repo to GitHub.
2. Netlify → **Add new site** → **Import from GitHub** → select this repo → **Deploy**.
3. Site settings → **Environment variables**, add:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_UPLOAD_PRESET` (must be an **unsigned** preset: Settings → Upload → Add upload preset → Signing Mode: Unsigned)
4. Trigger a redeploy.

## Scoring

The function derives a score from a hash of each image's base64 payload:

```js
const scores = images.map(base64 => {
  let h = 0;
  for (let i = 0; i < base64.length; i += 97) {
    h = ((h << 5) - h) + base64.charCodeAt(i);
    h |= 0;
  }
  return (Math.abs(h) % 100) + 1;
});
```

This is stable for a given set of images and gives the illusion of analysis, but it reads nothing about the face — the number is a function of file bytes, not appearance. The same face at a different JPEG quality scores differently.

To plug in a real model, replace that block with a call to your provider of choice (HuggingFace, Replicate, an OpenAI vision model, a hosted face-landmark model) and keep the return shape:

```json
{ "mogScore": 0, "verdict": "", "advice": "" }
```

## Security notes

| Risk | How it is handled |
| --- | --- |
| API keys leaking to the browser | Only in Netlify env vars, only read inside the function |
| Fake/spam requests | Function enforces 3–10 photos |
| Photos kept client-side forever | `sessionStorage` — wiped when the tab closes |
| Login / tracking | None |
| Cloudinary secrets in HTML/JS | Never — uploads happen inside the function |

### Before you put this in front of real users

- **Photos are uploaded to Cloudinary and the URLs are then discarded.** `uploadedUrls` is only counted in the response, never used. Every capture therefore leaves a copy of the user's face on a third-party CDN for no functional reason. Either use the URLs or drop the upload block.
- **No payload size limit.** Ten 1280×720 JPEG data URIs can approach Netlify's request body ceiling; a client-side downscale plus a server-side length check is worth adding.
- **No rate limiting or origin check.** The function can be called directly by anyone who finds the URL.
- **Verdict labels** (`Sub-5`, `Mogged`, `Brutal. Focus on looksmaxxing.`) are shown to whoever is in frame. Worth thinking about who that is.
