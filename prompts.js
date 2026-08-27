// Ported from the jd-resume-matcher skill (steps 1-4), collapsed into single
// structured-output prompts since Gemini/NIM run one-shot, not an interactive session.

const NEVER_FABRICATE =
  "Never invent companies, titles, dates, technologies, or metrics that are not " +
  "already present in the resume JSON given to you. If a bullet has no number, " +
  "either leave it qualitative or reuse a number already present elsewhere for the " +
  "same achievement — do not make one up.";

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

Respond with ONLY minified JSON matching exactly this shape, no prose outside it:
{"fitScore":0,"keywords":{"essentialSkills":[{"term":"","status":"present|weak|missing","note":""}],"preferredSkills":[...],"industryKeywords":[...]},"strengths":["",""],"gaps":["",""]}

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
  return `You are rewriting a resume to better match a specific job posting.

Rewrite ONLY these fields: summary, skills, and each experience[].bullets entry.
Do not add, remove, or reorder experience entries, education, projects, name,
or contact info. Mirror the job posting's terminology where truthful. Keep
bullets in the form: accomplished [impact] as measured by [number] by doing
[specific contribution] — reuse existing numbers, never fabricate new ones.
Drop skills from the skills list only if they're clearly unrelated to this role;
never add a skill that isn't already in the original resume.

${NEVER_FABRICATE}

Respond with ONLY the full resume JSON, same shape as given, with summary/skills/
experience[].bullets updated. No prose outside the JSON.

JOB POSTING:
"""
${jobText}
"""

ORIGINAL RESUME JSON:
"""
${JSON.stringify(resume)}
"""`;
}

export { buildAnalyzePrompt, buildTailorPrompt };
