import { buildTex } from "./resume-template.tex.js";
import { compileResumeTex } from "./pdf.js";

const statusText = document.getElementById("statusText");
const statusSub = document.getElementById("statusSub");
const statusLog = document.getElementById("statusLog");
const statusBox = document.getElementById("status");
const progressBar = document.getElementById("progressBar");
const elapsedEl = document.getElementById("elapsed");
const frame = document.getElementById("pdfFrame");

let elapsedTimer;

function startElapsedTimer() {
  const start = Date.now();
  elapsedTimer = setInterval(() => {
    elapsedEl.textContent = `${Math.floor((Date.now() - start) / 1000)}s elapsed`;
  }, 1000);
}

function fail(title, detail) {
  clearInterval(elapsedTimer);
  statusText.textContent = title;
  statusSub.textContent = "";
  progressBar.parentElement.classList.add("hidden");
  elapsedEl.classList.add("hidden");
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

  startElapsedTimer();

  try {
    const tex = buildTex(tailoredResume);
    const pdfBytes = await compileResumeTex(tex, ({ percent }) => {
      progressBar.style.width = `${Math.max(4, percent)}%`;
      statusText.textContent = `Loading the LaTeX engine… ${percent}%`;
    });
    clearInterval(elapsedTimer);
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    frame.src = URL.createObjectURL(blob);
    frame.classList.remove("hidden");
    statusBox.classList.add("hidden");
  } catch (e) {
    fail("Couldn't compile the PDF.", e.message);
  }
}

run();
