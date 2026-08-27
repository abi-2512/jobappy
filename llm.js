const GEMINI_MODEL = "gemini-flash-latest";
const NIM_MODEL = "qwen/qwen2.5-72b-instruct";

async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Gemini error ${res.status}: ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");
  return text;
}

async function callNim(apiKey, prompt) {
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: NIM_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`NIM error ${res.status}: ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("NIM returned no content");
  return text;
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in model output");
  return JSON.parse(text.slice(start, end + 1));
}

// Gemini is rate-limited (429) or temporarily overloaded (503): both are worth
// retrying against NIM instead of failing outright.
const FALLBACK_STATUSES = new Set([429, 503]);

// Tries Gemini first; falls back to NIM on rate-limit/overload (or if only NIM is configured).
async function callLLM(prompt, { geminiKey, nimKey }) {
  if (!geminiKey && !nimKey) throw new Error("No API keys configured. Open Setup to add one.");

  if (geminiKey) {
    try {
      return extractJson(await callGemini(geminiKey, prompt));
    } catch (e) {
      if (!FALLBACK_STATUSES.has(e.status) || !nimKey) throw e;
      // fall back to NIM
    }
  }
  return extractJson(await callNim(nimKey, prompt));
}

export { callLLM };
