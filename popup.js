const $ = (id) => document.getElementById(id);

let jobText = null;
let elapsedTimer;

function setStatus(text) {
  $("status").textContent = text || "";
  $("status").classList.toggle("hidden", !text);
}
function setError(text) {
  $("error").textContent = text || "";
  $("error").classList.toggle("hidden", !text);
}
function setSpinning(on) {
  $("spinner").classList.toggle("hidden", !on);
  $("analyzeBtn").disabled = on;
  $("tailorBtn").disabled = on;
}

function startElapsedTimer(label) {
  const start = Date.now();
  clearInterval(elapsedTimer);
  const tick = () => setStatus(`${label} (${Math.floor((Date.now() - start) / 1000)}s)`);
  tick();
  elapsedTimer = setInterval(tick, 1000);
}
function stopElapsedTimer() {
  clearInterval(elapsedTimer);
}

function renderAnalysis(analysis) {
  $("scoreText").textContent = `${analysis.fitScore}/100`;
  $("strengths").innerHTML = (analysis.strengths || [])
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join("");
  $("gaps").innerHTML = (analysis.gaps || []).map((g) => `<li>${escapeHtml(g)}</li>`).join("");
  $("result").classList.remove("hidden");
}

async function grabActiveTabText() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found.");
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.body.innerText.slice(0, 20000)
  });
  await chrome.storage.session.set({ jobText: result });
  return result;
}

// The popup closes on any outside click/focus loss, tearing this whole JS
// context down mid-request. background.js keeps running the actual LLM call
// regardless and persists its state to storage, so on (re)open we check for
// a request that's still running or already finished instead of assuming a
// clean slate.
async function resumePendingRequest() {
  const { pendingRequest } = await chrome.storage.session.get(["pendingRequest"]);
  if (!pendingRequest) return false;

  if (pendingRequest.status === "running") {
    setError("");
    setSpinning(true);
    startElapsedTimer(pendingRequest.type === "analyze" ? "Analyzing fit…" : "Rewriting resume…");
    return true;
  }

  if (pendingRequest.status === "done" && pendingRequest.type === "analyze") {
    renderAnalysis(pendingRequest.result);
  } else if (pendingRequest.status === "error") {
    setError(pendingRequest.error);
  }
  return false;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "session" || !changes.pendingRequest) return;
  const state = changes.pendingRequest.newValue;
  if (!state || state.status === "running") return;

  stopElapsedTimer();
  setSpinning(false);
  setStatus("");
  if (state.status === "done") {
    if (state.type === "analyze") renderAnalysis(state.result);
    else setStatus("Opened tailored resume in a new tab — compiling your PDF there.");
  } else {
    setError(state.error);
  }
});

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

  if (configured) {
    const { jobText: storedJobText } = await chrome.storage.session.get(["jobText"]);
    jobText = storedJobText || null;
    await resumePendingRequest();
  }
}

async function analyze() {
  setError("");
  $("result").classList.add("hidden");
  setSpinning(true);
  setStatus("Reading this page…");

  try {
    jobText = await grabActiveTabText();
  } catch (e) {
    setSpinning(false);
    setStatus("");
    return setError(`Couldn't read this page: ${e.message}`);
  }

  startElapsedTimer("Analyzing fit…");
  const res = await chrome.runtime.sendMessage({ type: "analyze", jobText });
  stopElapsedTimer();
  setSpinning(false);
  setStatus("");
  if (!res.ok) return setError(res.error);
  renderAnalysis(res.result);
}

async function tailorAndCompile() {
  setError("");
  setSpinning(true);
  startElapsedTimer("Rewriting resume…");

  const res = await chrome.runtime.sendMessage({ type: "tailor", jobText });
  stopElapsedTimer();
  setSpinning(false);
  if (!res.ok) {
    setStatus("");
    return setError(res.error);
  }

  // background.js already stored tailoredResume and opened preview.html.
  setStatus("Opened tailored resume in a new tab — compiling your PDF there.");
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

$("analyzeBtn").addEventListener("click", analyze);
$("tailorBtn").addEventListener("click", tailorAndCompile);

init();
