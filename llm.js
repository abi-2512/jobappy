// Tried in order on 429/503 before falling through to NIM. Two separate model
// pools (the rolling "latest" alias vs. a distinct stable model) so a demand
// spike on one doesn't necessarily hit the other.
const GEMINI_MODELS = ["gemini-flash-latest", "gemini-3.5-flash-lite"];
const NIM_MODEL = "nvidia/llama-3.1-nemotron-70b-instruct";

async function callGemini(apiKey, prompt, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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
    const err = new Error(`Gemini (${model}) error ${res.status}: ${body.slice(0, 300)}`);
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
      temperature: 0.3,
      response_format: { type: "json_object" }
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

// Rate-limited (429) or temporarily overloaded (503): worth retrying against
// the next model/provider instead of failing outright.
const FALLBACK_STATUSES = new Set([429, 503]);

// Tries each Gemini model in order, then NIM, on rate-limit/overload.
async function callLLM(prompt, { geminiKey, nimKey }) {
  if (!geminiKey && !nimKey) throw new Error("No API keys configured. Open Setup to add one.");

  let lastError;
  if (geminiKey) {
    for (const model of GEMINI_MODELS) {
      try {
        return extractJson(await callGemini(geminiKey, prompt, model));
      } catch (e) {
        if (!FALLBACK_STATUSES.has(e.status)) throw e;
        lastError = e;
      }
    }
  }
  if (!nimKey) throw lastError;
  return extractJson(await callNim(nimKey, prompt));
}

export { callLLM };
