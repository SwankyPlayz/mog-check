# MOG Check

Camera-based face scoring demo. Single-page frontend plus one Netlify Function that does the scoring server-side. No login, no tracking, 3–10 photos enforced on both client and server.

> **Note:** the scoring in `netlify/functions/analyze.js` is deterministic, not a real AI model. See [Scoring](#scoring) below.

## File structure

```
mog-check/
├── public/
│   └── index.html        <- the only thing served to visitors
├── netlify/
│   └── functions/
│       └── analyze.js    <- never served as a file
├── netlify.toml
├── package.json
├── .env.example
└── .gitignore
```

`publish = "public"`, and the functions directory sits **outside** the publish
directory. That matters: if you publish the repo root and keep the function at
`netlify/functions/analyze.js`, Netlify ships the function's source as a static
asset and anyone can read it at `/netlify/functions/analyze.js`.

## Files

- **`public/index.html`** — the whole UI, camera handling and request logic in one file.
- **`netlify/functions/analyze.js`** — the backend. Holds every secret, enforces the 3–10 photo rule, and returns `{ mogScore, verdict, advice }`.
- **`netlify.toml`** — publish dir `public`, functions dir `netlify/functions`, esbuild bundler.
- **`package.json`** — no dependencies; Node 18+ has `fetch` and `FormData` built in.
- **`.env.example`** — copy to `.env` locally. Never commit `.env`.

## Deploy on Netlify

1. Netlify → team dashboard → **Add new project** → **Import an existing project** → **GitHub**.
2. If `mog-check` isn't in the list, the Netlify GitHub App has no access to it:
   choose **Configure Netlify on GitHub** and grant access to this one repository
   (Settings → Applications → Netlify → Configure → *Only select repositories*).
3. Build settings: leave the build command empty, publish directory `public`,
   functions directory `netlify/functions`. `netlify.toml` already sets these.
4. Deploy, then add the environment variables (see below) and redeploy.
5. If the project was created private, make it public: **Project configuration →
   General → Visitor access → Project visibility → Edit visibility → Public**.
   "Make public" only becomes available after one successful production deploy.

### Environment variables

**Project configuration → Environment variables → Add a variable.** Never put
these in the repo or in `netlify.toml`.

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_UPLOAD_PRESET` — must be an **unsigned** preset (Cloudinary →
  Settings → Upload → Add upload preset → Signing Mode: Unsigned)

An unsigned preset is a bearer capability: anyone who learns the cloud name and
preset name can upload to your Cloudinary account directly, without going
through this function. Since the upload already happens server-side, a signed
upload (API key + secret + signature) is the safer choice.

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
