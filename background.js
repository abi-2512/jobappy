import { callLLM } from "./llm.js";
import { buildAnalyzePrompt, buildTailorPrompt } from "./prompts.js";

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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "saveJobText") {
        await chrome.storage.session.set({ jobText: message.jobText, jobUrl: message.jobUrl });
        sendResponse({ ok: true });
        return;
      }

      const { geminiKey, nimKey, resume } = await getSettings();
      if (!resume) throw new Error("No base resume saved yet. Open Setup first.");

      if (message.type === "analyze") {
        const prompt = buildAnalyzePrompt(message.jobText, resume);
        const result = await callLLM(prompt, { geminiKey, nimKey });
        sendResponse({ ok: true, result });
      } else if (message.type === "tailor") {
        const prompt = buildTailorPrompt(message.jobText, resume);
        const result = await callLLM(prompt, { geminiKey, nimKey });
        sendResponse({ ok: true, result });
      } else {
        sendResponse({ ok: false, error: `Unknown message type: ${message.type}` });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true; // keep the channel open for the async response
});
