const $ = (id) => document.getElementById(id);

let jobText = null;
let analysis = null;

function setStatus(text) {
  $("status").textContent = text || "";
  $("status").classList.toggle("hidden", !text);
}
function setError(text) {
  $("error").textContent = text || "";
  $("error").classList.toggle("hidden", !text);
}

async function init() {
  const { geminiKey, nimKey, resume } = await chrome.storage.local.get([
    "geminiKey",
    "nimKey",
    "resume"
  ]);
  const configured = (geminiKey || nimKey) && resume;

  $("setupPrompt").classList.toggle("hidden", !!configured);
  $("main").classList.toggle("hidden", !configured);
  $("openSetup").onclick = () => chrome.runtime.openOptionsPage();

  if (!configured) return;

  const session = await chrome.storage.session.get(["jobText"]);
  jobText = session.jobText || null;
  $("analyzeBtn").disabled = !jobText;
  if (!jobText) setStatus("Click \"Tailor Resume\" on a job page first.");
}

async function analyze() {
  setError("");
  setStatus("Analyzing fit…");
  $("analyzeBtn").disabled = true;
  const res = await chrome.runtime.sendMessage({ type: "analyze", jobText });
  $("analyzeBtn").disabled = false;
  setStatus("");
  if (!res.ok) return setError(res.error);

  analysis = res.result;
  $("scoreText").textContent = `${analysis.fitScore}/100`;
  $("strengths").innerHTML = (analysis.strengths || [])
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join("");
  $("gaps").innerHTML = (analysis.gaps || []).map((g) => `<li>${escapeHtml(g)}</li>`).join("");
  $("result").classList.remove("hidden");
}

async function tailorAndCompile() {
  setError("");
  setStatus("Rewriting resume…");
  $("tailorBtn").disabled = true;
  const res = await chrome.runtime.sendMessage({ type: "tailor", jobText });
  if (!res.ok) {
    $("tailorBtn").disabled = false;
    setStatus("");
    return setError(res.error);
  }

  await chrome.storage.session.set({ tailoredResume: res.result });
  await chrome.tabs.create({ url: chrome.runtime.getURL("preview.html") });
  setStatus("Opened tailored resume in a new tab — use the print dialog to save as PDF.");
  $("tailorBtn").disabled = false;
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

$("analyzeBtn").addEventListener("click", analyze);
$("tailorBtn").addEventListener("click", tailorAndCompile);

init();
