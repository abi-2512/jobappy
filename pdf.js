// The engine + TeX Live package data are vendored locally under pdf/busytex/
// (gitignored, downloaded once via `npx texlyre-busytex download-assets`, see
// README) rather than loaded from a CDN: Chrome MV3 flatly forbids any
// non-'self' host in an extension page's script-src, so a cross-origin
// <script>-loaded engine can never work here, only same-origin.
import { BusyTexRunner, PdfLatex } from "./texlyre-busytex.js";

const BUSYTEX_BASE = chrome.runtime.getURL("pdf/busytex");
const CATALOG_PACKAGES = [
  `${BUSYTEX_BASE}/texlive-basic.js`,
  `${BUSYTEX_BASE}/texlive-recommended.js`
];

let runnerPromise;

function getRunner() {
  if (!runnerPromise) {
    const runner = new BusyTexRunner({
      busytexBasePath: BUSYTEX_BASE,
      engineMode: "combined",
      catalogDataPackages: CATALOG_PACKAGES
    });
    // Everything is same-origin now, so the engine can run in its own Worker
    // (non-blocking) instead of the direct/main-thread mode the CDN approach
    // needed to work around cross-origin Worker restrictions.
    runnerPromise = runner.initialize(true).then(() => runner);
  }
  return runnerPromise;
}

async function compileResumeTex(texSource) {
  const runner = await getRunner();
  const pdflatex = new PdfLatex(runner);
  const result = await pdflatex.compile({ input: texSource, verbose: "info" });
  if (!result.success || !result.pdf) {
    throw new Error(result.log ? result.log.slice(-1000) : "LaTeX compilation failed");
  }
  return result.pdf;
}

export { compileResumeTex };
