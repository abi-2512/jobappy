import { callLLM } from "./llm.js";
import { buildAnalyzePrompt, buildTailorPrompt, ANALYZE_SCHEMA } from "./prompts.js";

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    chrome.runtime.openOptionsPage();
  }
});

async function getSettings() {
  const { geminiKey, nimKey, resume } = await chrome.storage.local.get([
    "geminiKey",
    "nimKey",
    "resume"
  ]);
  return { geminiKey, nimKey, resume };
}

// The popup closes on any outside click/focus loss, which tears down its JS
// context mid-request. That doesn't stop this service worker's fetch(), so
// the result is also persisted here regardless of whether a popup is still
// around to receive sendResponse() — popup.js checks this on (re)open.
async function setPending(state) {
  await chrome.storage.session.set({ pendingRequest: state });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "analyze" && message.type !== "tailor") {
    sendResponse({ ok: false, error: `Unknown message type: ${message.type}` });
    return;
  }

  (async () => {
    await setPending({ type: message.type, status: "running", startedAt: Date.now() });
    try {
      const { geminiKey, nimKey, resume } = await getSettings();
      if (!resume) throw new Error("No base resume saved yet. Open Setup first.");

      const prompt =
        message.type === "analyze"
          ? buildAnalyzePrompt(message.jobText, resume)
          : buildTailorPrompt(message.jobText, resume);
      const schema = message.type === "analyze" ? ANALYZE_SCHEMA : undefined;
      const result = await callLLM(prompt, { geminiKey, nimKey }, schema);

      if (message.type === "tailor") {
        // Own opening the PDF tab here, not in popup.js — the popup may
        // already be closed by the time this resolves, and that must not
        // stop the tailored resume from actually reaching a PDF.
        await chrome.storage.session.set({ tailoredResume: result });
        await chrome.tabs.create({ url: chrome.runtime.getURL("preview.html") });
      }

      await setPending({ type: message.type, status: "done", result });
      sendResponse({ ok: true, result });
    } catch (e) {
      await setPending({ type: message.type, status: "error", error: e.message });
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true; // keep the channel open for the async response
});
