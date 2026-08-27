# JobAppy

Chrome extension that tailors your resume to whatever job posting you're looking at, using free Gemini and NVIDIA NIM API keys. No server, no backend, everything runs in the extension.

## How it works

1. Open a job posting, then click the extension icon and hit **Analyze fit**.
2. The extension reads the current tab's visible text and sends it to Gemini (falling back to NVIDIA NIM if Gemini hits its rate limit) along with your base resume, then shows your fit score, strengths, and gaps for that posting.
3. Click **Generate tailored PDF**: the model rewrites your summary, skills, and bullets to match the posting (never inventing employers, dates, or numbers), and opens a print-ready resume in a new tab. Use your browser's print dialog to save it as a PDF.

## Setup

1. Load the extension: open `chrome://extensions`, enable Developer Mode, click **Load unpacked**, select this folder.
2. It opens a setup tab automatically on first install (or click the extension icon → "Finish setup" anytime).
3. Add a free **Gemini** API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
4. Add a free **NVIDIA NIM** API key from [build.nvidia.com](https://build.nvidia.com) (used automatically as a fallback if Gemini rate-limits).
5. Paste your base resume as JSON (a sample is pre-filled to show the shape) and hit **Save**.

Keys and your resume are stored only in `chrome.storage.local` on your machine, never sent anywhere except directly to Google's and NVIDIA's APIs.

## Models

- Primary: **`gemini-flash-latest`**, falling back to **`gemini-2.5-flash-lite`** (separate model pool, less likely to be overloaded at the same time) on 429/503.
- Fallback on 429/503: **NVIDIA NIM — `nvidia/llama-3.1-nemotron-70b-instruct`** (~40 requests/min free tier). If NVIDIA retires this model too, check the live catalog at `https://integrate.api.nvidia.com/v1/models` (no auth needed) and swap `NIM_MODEL` in `llm.js`.

## Files

- `manifest.json` — MV3 extension manifest
- `background.js` — service worker, routes analyze/tailor requests to the LLMs
- `llm.js` — Gemini + NIM API calls with fallback-on-429 logic
- `prompts.js` — the fit-analysis and tailoring prompts
- `options.html` / `options.js` — setup page (keys + base resume)
- `popup.html` / `popup.js` — fit score display, PDF trigger
- `resume-template.js` / `preview.html` / `preview.js` — renders the tailored resume as a print-ready page
