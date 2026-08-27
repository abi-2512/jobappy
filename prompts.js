// Ported from the jd-resume-matcher skill (steps 1-4), collapsed into single
// structured-output prompts since Gemini/NIM run one-shot, not an interactive session.

const NEVER_FABRICATE =
  "Never invent companies, titles, dates, technologies, or metrics that are not " +
  "already present in the resume JSON given to you. If a bullet has no number, " +
  "either leave it qualitative or reuse a number already present elsewhere for the " +
  "same achievement — do not make one up.";

// This runs against small/weak fallback models (e.g. Gemini Flash-Lite, a
// 70B NIM model) as well as strong ones, so the output-format rules are
// spelled out plainly rather than assumed.
const STRICT_JSON_OUTPUT =
  "Output rules: respond with raw JSON only. Do not wrap it in ```json or any " +
  "other markdown code fence. Do not add any sentence before or after the JSON, " +
  "not even a summary. The first character of your response must be { and the " +
  "last character must be }. Use double quotes for all keys and string values, " +
  "and no trailing commas.";

// Passed to Gemini as generationConfig.responseSchema so the JSON is
// constrained at generation time instead of just requested via prompt text.
// Real bug this fixes: the model would echo JD phrases verbatim into a
// "note" field, sometimes with an unescaped quote, producing invalid JSON
// that plain prompt instructions couldn't reliably prevent.
const keywordItemSchema = {
  type: "OBJECT",
  properties: {
    term: { type: "STRING" },
    status: { type: "STRING", enum: ["present", "weak", "missing"] },
    note: { type: "STRING" }
  },
  required: ["term", "status", "note"]
};

const ANALYZE_SCHEMA = {
  type: "OBJECT",
  properties: {
    fitScore: { type: "INTEGER" },
    keywords: {
      type: "OBJECT",
      properties: {
        essentialSkills: { type: "ARRAY", items: keywordItemSchema },
        preferredSkills: { type: "ARRAY", items: keywordItemSchema },
        industryKeywords: { type: "ARRAY", items: keywordItemSchema }
      },
      required: ["essentialSkills", "preferredSkills", "industryKeywords"]
    },
    strengths: { type: "ARRAY", items: { type: "STRING" } },
    gaps: { type: "ARRAY", items: { type: "STRING" } }
  },
  required: ["fitScore", "keywords", "strengths", "gaps"]
};

function buildAnalyzePrompt(jobText, resume) {
  return `You are a meticulous hiring-manager-style resume analyst.

Given a job posting and a candidate resume (as JSON), do all of the following:

1. Extract JD keywords into three buckets: essentialSkills (explicitly required),
   preferredSkills ("nice to have"/"preferred"/"plus"), industryKeywords (domain
   terms, tools, methodologies, certifications likely searched by ATS/recruiters).
   Only include terms actually present or clearly implied by the JD.
2. Compare each bucket against the resume: mark each keyword as "present",
   "weak" (present but buried or not phrased in JD's language), or "missing".
   For weak/missing items, suggest where in the resume it belongs and how to
   phrase it truthfully — only if it's plausible given the resume's existing content.
3. Give a short hiring-manager read: 2-3 concrete strengths, 2-3 concrete
   gaps/risks, tied to this specific JD, not generic advice.
4. Give an overall fit score from 0-100.

${NEVER_FABRICATE}

${STRICT_JSON_OUTPUT}

Your JSON must match exactly this shape (types shown, fill in real values):
{"fitScore":0,"keywords":{"essentialSkills":[{"term":"","status":"present|weak|missing","note":""}],"preferredSkills":[{"term":"","status":"present|weak|missing","note":""}],"industryKeywords":[{"term":"","status":"present|weak|missing","note":""}]},"strengths":["",""],"gaps":["",""]}

JOB POSTING:
"""
${jobText}
"""

RESUME JSON:
"""
${JSON.stringify(resume)}
"""`;
}

function buildTailorPrompt(jobText, resume) {
  const untouchedKeys = Object.keys(resume).filter((k) => k !== "summary" && k !== "skills");

  return `You are rewriting a resume to better match a specific job posting.

Rewrite ONLY these fields: summary, skills, and each experience[].bullets entry.
Every other top-level field must be copied through byte-for-byte unchanged:
${untouchedKeys.map((k) => `"${k}"`).join(", ")}. Do not add, remove, or reorder
anything in those fields — no dropped entries, no renamed keys, no shortened
arrays. Mirror the job posting's terminology where truthful.

Rewrite each bullet to lead with a strong action verb, state the concrete
contribution, and work in the existing metric naturally, as a normal sentence
would, not a fill-in-the-blank template. Reuse existing numbers, never
fabricate new ones. Vary sentence structure across bullets so they don't all
read the same way — do not reuse the same connecting phrase (e.g. "as
measured by") in more than one bullet; most bullets shouldn't use it at all.
Bad: "Reduced latency by 5x as measured by benchmark metrics by migrating
routing." Good: "Cut inference latency 5x by migrating request routing to a
distributed GPU compute network." Drop skills from the skills list only if
they're clearly unrelated to this role; never add a skill that isn't already
in the original resume.

${NEVER_FABRICATE}

${STRICT_JSON_OUTPUT}

Your response must be the complete resume JSON, with the exact same top-level
keys as the original (${Object.keys(resume).map((k) => `"${k}"`).join(", ")}),
only summary/skills/experience[].bullets updated.

JOB POSTING:
"""
${jobText}
"""

ORIGINAL RESUME JSON:
"""
${JSON.stringify(resume)}
"""`;
}

export { buildAnalyzePrompt, buildTailorPrompt, ANALYZE_SCHEMA };
