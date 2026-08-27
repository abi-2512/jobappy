function escapeTex(s = "") {
  return String(s)
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([%$&#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
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
\\textbf{${escapeTex(job.title)}} \\hfill \\textit{${escapeTex(job.dates)}} \\\\
\\textit{${escapeTex(job.company)}}
\\vspace{-2pt}
\\begin{itemize}[leftmargin=1.1em, itemsep=0pt, topsep=2pt, parsep=0pt]
${(job.bullets || []).map((b) => `  \\item ${escapeTex(b)}`).join("\n")}
\\end{itemize}`
    )
    .join("\n\\vspace{2pt}\n");

  const education = (resume.education || [])
    .map(
      (ed) =>
        `\\textbf{${escapeTex(ed.degree)}} \\hfill \\textit{${escapeTex(ed.dates)}} \\\\ \\textit{${escapeTex(
          ed.school
        )}}`
    )
    .join(" \\\\[3pt]\n");

  const projects = (resume.projects || [])
    .map((p) => {
      const titleLine = p.techStack
        ? `\\textbf{${escapeTex(p.name)}} \\textit{| ${escapeTex(p.techStack)}}`
        : `\\textbf{${escapeTex(p.name)}}`;
      const bullets = (p.bullets || []).length
        ? `\n\\vspace{-2pt}\n\\begin{itemize}[leftmargin=1.1em, itemsep=0pt, topsep=2pt, parsep=0pt]\n${(
            p.bullets || []
          )
            .map((b) => `  \\item ${escapeTex(b)}`)
            .join("\n")}\n\\end{itemize}`
        : "";
      return `${titleLine} \\hfill \\textit{${escapeTex(p.dates)}}${bullets}`;
    })
    .join("\n\\vspace{2pt}\n");

  return `\\documentclass[10pt]{article}
\\usepackage[margin=0.5in]{geometry}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{xcolor}
\\usepackage[hidelinks]{hyperref}
\\definecolor{accent}{HTML}{1F3A5F}
\\pagestyle{empty}
\\titleformat{\\section}{\\color{accent}\\normalsize\\bfseries\\scshape}{}{0em}{}[\\color{accent}\\titlerule]
\\titlespacing{\\section}{0pt}{6pt}{3pt}
\\setlength{\\parindent}{0pt}

\\begin{document}

{\\LARGE\\bfseries\\color{accent} ${escapeTex(resume.name)}}\\\\[3pt]
{\\small ${contactLine}}

\\section*{Summary}
${escapeTex(resume.summary)}

\\section*{Skills}
${(resume.skills || []).map(escapeTex).join(" \\textbullet\\ ")}

\\section*{Experience}
${experience}

${projects ? `\\section*{Projects}\n${projects}\n` : ""}
\\section*{Education}
${education}

\\end{document}
`;
}

export { buildTex };
