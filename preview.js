import { buildTex } from "./resume-template.tex.js";
import { compileResumeTex } from "./pdf.js";

const statusText = document.getElementById("statusText");
const statusSub = document.getElementById("statusSub");
const statusLog = document.getElementById("statusLog");
const statusBox = document.getElementById("status");
const frame = document.getElementById("pdfFrame");

function fail(title, detail) {
  statusText.textContent = title;
  statusSub.textContent = "";
  if (detail) {
    statusLog.textContent = detail;
    statusLog.classList.remove("hidden");
  }
}

async function run() {
  const { tailoredResume } = await chrome.storage.session.get(["tailoredResume"]);
  if (!tailoredResume) {
    return fail("No tailored resume found.", "Generate one from the extension popup first.");
  }

  try {
    const tex = buildTex(tailoredResume);
    const pdfBytes = await compileResumeTex(tex);
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    frame.src = URL.createObjectURL(blob);
    frame.classList.remove("hidden");
    statusBox.classList.add("hidden");
  } catch (e) {
    fail("Couldn't compile the PDF.", e.message);
  }
}

run();
