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

// The model returns ONLY the changed parts (each experience entry's bullets
// and each project entry's bullets, positionally aligned to the original
// arrays) — never the full resume. Code (background.js) applies this as a
// diff onto the original JSON. This is deliberate: an earlier version asked
// the model to return the complete resume JSON with instructions to copy
// untouched fields (contact, education, projects, ...) through unchanged,
// and in practice the model didn't reliably do that — a real generated PDF
// came back with the projects section silently blanked out. A model can't
// corrupt data it's never given the chance to touch. Same reasoning is why
// `skills` isn't part of the diff either: it's structured category data
// (`{label: items[]}`), not prose, and there's nothing about it a model
// needs to rewrite to match a JD the way bullet phrasing does.
function buildTailorPrompt(jobText, resume) {
  const experienceCount = (resume.experience || []).length;
  const projectCount = (resume.projects || []).length;

  return `You are rewriting parts of a resume to better match a specific job posting.

You will output ONLY a diff: rewritten bullets for each of the
${experienceCount} experience entries below${projectCount ? `, and rewritten bullets for each of the ${projectCount} project entries below` : ""},
all in the same order they're given (do not add, remove, or reorder any
entries). Nothing else about the resume is being changed by you; do not
mention or restate any other field — job titles, companies, dates,
locations, project names, tech stacks, skills, education, and contact info
all stay exactly as given, untouched.

Mirror the job posting's terminology where truthful. Rewrite each bullet
(experience and project alike) to lead with a strong action verb, state the
concrete contribution, and work in any existing metric naturally, as a
normal sentence would, not a fill-in-the-blank template. Reuse existing
numbers, never fabricate new ones. Vary sentence structure so they don't all
read the same way — do not reuse the same connecting phrase (e.g. "as
measured by") in more than one bullet; most shouldn't use it at all. Bad:
"Reduced latency by 5x as measured by benchmark metrics by migrating
routing." Good: "Cut inference latency 5x by migrating request routing to a
distributed GPU compute network."

${NEVER_FABRICATE}

${STRICT_JSON_OUTPUT}

Your JSON must match exactly this shape: {"experience":[{"bullets":["",""]},...]${projectCount ? `,"projects":[{"bullets":["",""]},...]` : ""}}
The "experience" array must have exactly ${experienceCount} entries${projectCount ? `, and "projects" exactly ${projectCount} entries,` : ""} in the same order as below.

JOB POSTING:
"""
${jobText}
"""

ORIGINAL RESUME JSON (for context — do not repeat it back):
"""
${JSON.stringify(resume)}
"""`;
}

function buildTailorSchema(resume) {
  const experienceCount = (resume.experience || []).length;
  const projectCount = (resume.projects || []).length;

  const schema = {
    type: "OBJECT",
    properties: {
      experience: {
        type: "ARRAY",
        minItems: experienceCount,
        maxItems: experienceCount,
        items: {
          type: "OBJECT",
          properties: { bullets: { type: "ARRAY", items: { type: "STRING" } } },
          required: ["bullets"]
        }
      }
    },
    required: ["experience"]
  };

  if (projectCount) {
    schema.properties.projects = {
      type: "ARRAY",
      minItems: projectCount,
      maxItems: projectCount,
      items: {
        type: "OBJECT",
        properties: { bullets: { type: "ARRAY", items: { type: "STRING" } } },
        required: ["bullets"]
      }
    };
    schema.required.push("projects");
  }

  return schema;
}

// Applies the model's {experience[].bullets, projects[].bullets} diff onto
// the original resume. Every other field (contact, education, skills, job
// titles/companies/dates/locations, project names/tech stacks/dates, ...)
// always comes from the original, never the model's output.
function applyTailorDiff(resume, diff) {
  return {
    ...resume,
    experience: (resume.experience || []).map((job, i) => ({
      ...job,
      bullets: diff.experience?.[i]?.bullets ?? job.bullets
    })),
    projects: (resume.projects || []).map((p, i) => ({
      ...p,
      bullets: diff.projects?.[i]?.bullets ?? p.bullets
    }))
  };
}

export { buildAnalyzePrompt, buildTailorPrompt, buildTailorSchema, applyTailorDiff, ANALYZE_SCHEMA };
