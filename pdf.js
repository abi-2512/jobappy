// The engine JS and its WASM/TeX-package data are loaded from public CDNs at
// compile time; nothing is bundled with the extension. See README for the
// tradeoffs (requires internet on first compile per session, and leans on
// texlyre.github.io's demo assets rather than a published stable CDN).
import { BusyTexRunner, PdfLatex } from "https://cdn.jsdelivr.net/npm/texlyre-busytex@1.4.0/dist/index.js";

const BUSYTEX_BASE = "https://texlyre.github.io/texlyre-busytex/core/busytex";
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
    // useWorker=false: a cross-origin Worker script (texlyre.github.io, while
    // this page is chrome-extension://) is blocked by the browser regardless
    // of CORS, so we run the compiler on the main thread instead.
    runnerPromise = runner.initialize(false).then(() => runner);
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
