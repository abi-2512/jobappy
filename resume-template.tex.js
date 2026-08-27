function escapeTex(s = "") {
  return String(s)
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([%$&#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

// row(left, right): a bold/italic-left, italic-right line pair used for
// experience/education/project headers — mirrors the master resume's
// layout (title+dates on one line, company/school+location on the next).
function row(left, right) {
  return `${left} \\hfill \\textit{${escapeTex(right)}}`;
}

function buildTex(resume) {
  const contact = resume.contact || {};
  const contactLine = [contact.email, contact.phone, contact.location, contact.links]
    .filter(Boolean)
    .map(escapeTex)
    .join(" \\quad|\\quad ");

  const experience = (resume.experience || [])
    .map(
      (job) => `
${row(`\\textbf{${escapeTex(job.title)}}`, job.dates)} \\\\
${row(`\\textit{${escapeTex(job.company)}}`, job.location)}
\\vspace{-3pt}
\\begin{itemize}[leftmargin=1.1em, itemsep=0pt, topsep=1pt, parsep=0pt]
${(job.bullets || []).map((b) => `  \\item ${escapeTex(b)}`).join("\n")}
\\end{itemize}`
    )
    .join("\n\\vspace{1pt}\n");

  // school+location on the first line, degree+dates on the second — matches
  // the master resume's order (school is the identifying line, like a job
  // title is for experience).
  const education = (resume.education || [])
    .map(
      (ed) =>
        `${row(`\\textbf{${escapeTex(ed.school)}}`, ed.location)} \\\\\n${row(
          `\\textit{${escapeTex(ed.degree)}}`,
          ed.dates
        )}`
    )
    .join(" \\\\[2pt]\n");

  const projects = (resume.projects || [])
    .map((p) => {
      // Accept either key naming: {name, techStack} or {title, tech}.
      const projName = p.name ?? p.title;
      const projTech = p.techStack ?? p.tech;
      const titleLine = projTech
        ? `\\textbf{${escapeTex(projName)}} \\textit{| ${escapeTex(projTech)}}`
        : `\\textbf{${escapeTex(projName)}}`;
      const bullets = (p.bullets || []).length
        ? `\n\\vspace{-3pt}\n\\begin{itemize}[leftmargin=1.1em, itemsep=0pt, topsep=1pt, parsep=0pt]\n${(
            p.bullets || []
          )
            .map((b) => `  \\item ${escapeTex(b)}`)
            .join("\n")}\n\\end{itemize}`
        : "";
      return `${row(titleLine, p.dates)}${bullets}`;
    })
    .join("\n\\vspace{1pt}\n");

  // skills: {"Languages": ["Python", ...], "Frameworks & Tools": [...], ...}
  // — one bold-labeled line per category, in whatever order the object has.
  const skillLines = Object.entries(resume.skills || {})
    .map(([label, items]) => `\\textbf{${escapeTex(label)}}: ${(items || []).map(escapeTex).join(", ")}`)
    .join(" \\\\\n");

  const workAuthLine = resume.workAuth ? `\n{\\small ${escapeTex(resume.workAuth)}}\\\\` : "";

  return `\\documentclass[10pt]{article}
\\usepackage[margin=0.45in]{geometry}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage[hidelinks]{hyperref}
\\linespread{0.96}
\\pagestyle{empty}
\\titleformat{\\section}{\\normalsize\\bfseries\\scshape}{}{0em}{}[\\titlerule]
\\titlespacing{\\section}{0pt}{4pt}{2pt}
\\setlength{\\parindent}{0pt}

\\begin{document}
\\begin{center}
{\\LARGE\\bfseries ${escapeTex(resume.name)}}\\\\[2pt]
{\\small ${contactLine}}\\\\${workAuthLine}
\\end{center}
\\vspace{-4pt}

\\section*{Experience}
${experience}

${projects ? `\\section*{Projects}\n${projects}\n` : ""}
\\section*{Technical Skills}
${skillLines}

\\section*{Education}
${education}

\\end{document}
`;
}

export { buildTex };
