# JobAppy

Chrome extension that tailors your resume to whatever job posting you're looking at, using free Gemini and NVIDIA NIM API keys. No server, no backend, everything runs in the extension.

## How it works

1. Open a job posting, then click the extension icon and hit **Analyze fit**.
2. The extension reads the current tab's visible text and sends it to Gemini (falling back to NVIDIA NIM if Gemini hits its rate limit) along with your base resume, then shows your fit score, strengths, and gaps for that posting.
3. Click **Generate tailored PDF**: the model rewrites your summary, skills, and bullets to match the posting (never inventing employers, dates, or numbers), and opens a new tab that compiles a real LaTeX PDF client-side and shows it inline.

## Setup

1. Download the LaTeX engine assets (one-time, ~319MB, not checked into git): from this folder run
   `npx texlyre-busytex download-assets pdf`
   then move the result into place: `mv pdf/busytex/busytex/* pdf/busytex/ && rmdir pdf/busytex/busytex` (the CLI nests an extra `busytex/` folder; `pdf/busytex/` needs `busytex.wasm` etc. directly inside it — verify with `ls pdf/busytex/`).
2. Load the extension: open `chrome://extensions`, enable Developer Mode, click **Load unpacked**, select this folder.
3. It opens a setup tab automatically on first install (or click the extension icon → "Finish setup" anytime).
4. Add a free **Gemini** API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
5. Add a free **NVIDIA NIM** API key from [build.nvidia.com](https://build.nvidia.com) (used automatically as a fallback if Gemini rate-limits).
6. Paste your base resume as JSON (a sample is pre-filled to show the shape) and hit **Save**.

Keys and your resume are stored only in `chrome.storage.local` on your machine, never sent anywhere except directly to Google's and NVIDIA's APIs.

## Models

- Primary: **`gemini-flash-latest`**, falling back to **`gemini-3.5-flash-lite`** (separate model pool, less likely to be overloaded at the same time) on 429/503.
- Fallback on 429/503: **NVIDIA NIM — `nvidia/llama-3.1-nemotron-70b-instruct`** (~40 requests/min free tier). If NVIDIA retires this model too, check the live catalog at `https://integrate.api.nvidia.com/v1/models` (no auth needed) and swap `NIM_MODEL` in `llm.js`.

## PDF generation

Real LaTeX, compiled client-side, no server. `pdf.js` loads the [texlyre-busytex](https://github.com/TeXlyre/texlyre-busytex) WASM TeX engine, vendored locally under `pdf/` (see Setup step 1) rather than from a CDN: Chrome MV3 flatly forbids any non-`'self'` host in an extension page's `script-src`, so a cross-origin `<script>`-loaded engine can never work there, only same-origin files can.

`pdf/busytex/` (~319MB: the WASM engine plus the `texlive-basic` and `texlive-recommended` TeX Live package sets, `texlive-extra` and `biber`/bibtex support dropped since a resume doesn't need them) is gitignored, not checked into this repo. Compiles run in a Worker (non-blocking) since everything is same-origin now.

## Files

- `manifest.json` — MV3 extension manifest (note the `content_security_policy` override needed for the WASM engine)
- `background.js` — service worker, routes analyze/tailor requests to the LLMs
- `llm.js` — Gemini + NIM API calls with fallback-on-429/503 logic
- `prompts.js` — the fit-analysis and tailoring prompts
- `options.html` / `options.js` — setup page (keys + base resume)
- `popup.html` / `popup.js` — fit score display, PDF trigger
- `resume-template.tex.js` — fills the tailored resume into a LaTeX template
- `pdf.js` / `pdf/texlyre-busytex.js` — drives the vendored LaTeX engine
- `preview.html` / `preview.js` — compiles the PDF and shows it inline
