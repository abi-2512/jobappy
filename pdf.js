// Compiles LaTeX via https://latex.ytotech.com/builds/sync, a public hosted
// instance of the open-source latex-on-http project. No local engine, no
// server of our own. Tradeoff: the resume's text content leaves the machine
// to a third-party demo service with no SLA — see README.
const COMPILE_URL = "https://latex.ytotech.com/builds/sync";

async function compileResumeTex(texSource) {
  const res = await fetch(COMPILE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // xelatex over pdflatex: handles UTF-8/Unicode (emoji, symbols a user's
      // resume text might contain) natively instead of rendering an unknown
      // glyph as a tofu box.
      compiler: "xelatex",
      resources: [{ main: true, content: texSource }]
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LaTeX compile failed (${res.status}): ${body.slice(0, 800)}`);
  }

  return res.arrayBuffer();
}

export { compileResumeTex };
