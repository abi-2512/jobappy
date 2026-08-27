#!/usr/bin/env node
// Dev-only tool: generates synthetic "LARPed" resume test fixtures for a
// resume-fraud/overfitting detector.
//
// NOT part of the extension. Nothing under dev/ is referenced by
// manifest.json, so this can never run inside the real tailor flow — it's a
// separate script with its own prompt, run manually from the terminal.
//
// Usage:
//   GEMINI_API_KEY=... node dev/generate-larp-fixture.mjs path/to/jd.txt [path/to/base-resume.json]
//
// Outputs base_resume.json, larped_resume.json, and annotations.md to
// dev/fixtures/<timestamp>/.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_BASE_RESUME = {
  name: "Jordan Reyes",
  contact: {
    email: "jordan.reyes.dev@example.com",
    phone: "+1 (415) 555-0148",
    location: "San Francisco, CA",
    links: "linkedin.com/in/jordanreyesdev, github.com/jreyes-dev"
  },
  workAuth: "Authorized to work in the U.S.",
  skills: {
    Languages: ["Python", "TypeScript", "SQL"],
    "Frameworks & Tools": ["FastAPI", "PostgreSQL", "Docker", "AWS", "Git", "CI/CD"],
    Concepts: ["REST APIs", "Distributed Systems", "Agile", "Unit Testing"]
  },
  experience: [
    {
      title: "Backend Engineer",
      company: "Northlane Analytics",
      location: "San Francisco, CA",
      dates: "March 2023 – Present",
      bullets: [
        "Built and maintained internal REST APIs in FastAPI serving reporting dashboards for ~40 business analysts.",
        "Reduced average query response time 22% by adding targeted PostgreSQL indexes and query batching.",
        "Contributed to sprint planning and code review within a 6-person Agile team.",
        "Set up a CI pipeline in GitHub Actions that cut deployment time from ~25 minutes to ~8 minutes."
      ]
    },
    {
      title: "Software Engineer",
      company: "Corvid Systems",
      location: "Oakland, CA",
      dates: "July 2021 – March 2023",
      bullets: [
        "Developed backend services in Python for an internal document-tagging tool used by the compliance team.",
        "Wrote unit tests that raised coverage on the tagging service from 40% to 75%.",
        "Assisted senior engineers with migrating a monolith service into two smaller FastAPI services."
      ]
    }
  ],
  education: [
    { school: "San Jose State University", degree: "B.S. Computer Science", location: "San Jose, CA", dates: "August 2017 – May 2021" }
  ],
  projects: []
};

function buildLarpPrompt(jobText, baseResume) {
  return `You are generating a SYNTHETIC TEST FIXTURE for a resume-fraud detector.
This is not a real person and is never submitted anywhere as a real application.

Given the base resume JSON (ground truth, 100% honest) and a job posting, produce
a "larped" variant: a realistic, SUBTLE case of a candidate overfitting their
resume to this specific JD. Insert 3-5 changes total, mixing these two kinds:

1. Scope/role inflation: reframe a real bullet to claim more ownership/seniority
   than the original implies (e.g. "assisted with" -> "led"; "contributed to" ->
   "drove"), with no other change to the underlying facts.
2. Fabricated capability: add or weave in ONE JD-relevant skill/tool/technology
   that does not appear anywhere in the base resume, phrased naturally (not a
   glaring non-sequitur).

Keep it subtle and realistic — this must be a HARD case for a detector, not an
obvious one. Do NOT: invent new companies, degrees, job titles, dates, or
numeric metrics; do not add more than one fabricated capability; do not change
more than half the bullets. Most of the resume should stay identical to the
base.

Respond with ONLY raw JSON, no markdown fences, no prose outside the JSON,
matching this shape:
{"larpedResume": <full resume JSON, same schema as the base>, "annotations": [{"location": "e.g. Northlane Analytics bullet 1", "type": "fabrication|inflation", "explanation": ""}]}

JOB POSTING:
"""
${jobText}
"""

BASE RESUME JSON (ground truth):
"""
${JSON.stringify(baseResume)}
"""`;
}

async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });
  if (!res.ok) {
    throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return JSON.parse(text.slice(start, end + 1));
}

async function main() {
  const [, , jdPath, baseResumePath] = process.argv;
  if (!jdPath) {
    console.error("Usage: GEMINI_API_KEY=... node dev/generate-larp-fixture.mjs path/to/jd.txt [base-resume.json]");
    process.exit(1);
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Set GEMINI_API_KEY in the environment.");
    process.exit(1);
  }

  const jobText = readFileSync(jdPath, "utf8");
  const baseResume = baseResumePath ? JSON.parse(readFileSync(baseResumePath, "utf8")) : DEFAULT_BASE_RESUME;

  console.log("Calling Gemini...");
  const { larpedResume, annotations } = await callGemini(apiKey, buildLarpPrompt(jobText, baseResume));

  const outDir = join(__dirname, "fixtures", new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "base_resume.json"), JSON.stringify(baseResume, null, 2));
  writeFileSync(join(outDir, "larped_resume.json"), JSON.stringify(larpedResume, null, 2));
  writeFileSync(
    join(outDir, "annotations.md"),
    `# Ground truth annotations\n\n${(annotations || [])
      .map((a) => `- **${a.location}** (${a.type}): ${a.explanation}`)
      .join("\n")}\n`
  );

  console.log(`Wrote fixture to ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
