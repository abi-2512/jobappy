import { buildResumeHtml } from "./resume-template.js";

const { tailoredResume } = await chrome.storage.session.get(["tailoredResume"]);
if (tailoredResume) {
  document.getElementById("root").innerHTML = buildResumeHtml(tailoredResume);
  document.title = `${tailoredResume.name || "Resume"} — Tailored Resume`;
  setTimeout(() => window.print(), 200);
}
