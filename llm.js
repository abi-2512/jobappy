// Tried in order on 429/503 before falling through to NIM. Two separate model
// pools (the rolling "latest" alias vs. a distinct stable model) so a demand
// spike on one doesn't necessarily hit the other.
const GEMINI_MODELS = ["gemini-flash-latest", "gemini-3.5-flash-lite"];
const NIM_MODEL = "nvidia/llama-3.1-nemotron-70b-instruct";

async function callGemini(apiKey, prompt, model, schema) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const generationConfig = { responseMimeType: "application/json" };
  if (schema) generationConfig.responseSchema = schema;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig
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
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    // The model itself produced malformed JSON (seen in practice: a missing
    // colon from a weaker fallback model). Log the full text so it's
    // inspectable in the service worker console, and surface a snippet in
    // the thrown error instead of just JSON.parse's opaque message.
    console.error("[JobAppy] Model returned invalid JSON:", text);
    const err = new Error(`Model returned invalid JSON (${e.message}): ${text.slice(0, 200)}`);
    err.invalidJson = true;
    throw err;
  }
}

// Rate-limited (429), temporarily overloaded (503), or the model produced
// malformed JSON: all worth retrying against the next model/provider
// instead of failing outright.
const FALLBACK_STATUSES = new Set([429, 503]);

function shouldFallback(e) {
  return e.invalidJson || FALLBACK_STATUSES.has(e.status);
}

// Tries each Gemini model in order, then NIM, on rate-limit/overload/bad JSON.
// `schema` (optional): a Gemini responseSchema object, constrains generation
// to that shape instead of relying on prompt instructions alone. NIM's API
// doesn't support an equivalent, so it only ever gets json_object mode.
async function callLLM(prompt, { geminiKey, nimKey }, schema) {
  if (!geminiKey && !nimKey) throw new Error("No API keys configured. Open Setup to add one.");

  let lastError;
  if (geminiKey) {
    for (const model of GEMINI_MODELS) {
      try {
        return extractJson(await callGemini(geminiKey, prompt, model, schema));
      } catch (e) {
        if (!shouldFallback(e)) throw e;
        lastError = e;
      }
    }
  }
  if (!nimKey) throw lastError;
  try {
    return extractJson(await callNim(nimKey, prompt));
  } catch (nimError) {
    // Don't let NIM's failure hide why Gemini also failed before it.
    if (lastError) nimError.message = `${nimError.message} (Gemini also failed: ${lastError.message})`;
    throw nimError;
  }
}

export { callLLM };
