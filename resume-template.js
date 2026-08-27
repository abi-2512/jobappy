function esc(s = "") {
  const div = document.createElement("div");
  div.textContent = String(s);
  return div.innerHTML;
}

// Returns the inner body markup for a resume; the print-styled shell lives in preview.html.
function buildResumeHtml(resume) {
  const contact = resume.contact || {};
  const contactLine = [contact.email, contact.phone, contact.location, contact.links]
    .filter(Boolean)
    .map(esc)
    .join(" &nbsp;|&nbsp; ");

  const experience = (resume.experience || [])
    .map(
      (job) => `
      <div class="entry">
        <div class="row">
          <span class="bold">${esc(job.title)}</span>
          <span class="dates">${esc(job.dates)}</span>
        </div>
        <div class="italic">${esc(job.company)}</div>
        <ul>${(job.bullets || []).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      </div>`
    )
    .join("");

  const education = (resume.education || [])
    .map(
      (ed) => `
      <div class="row">
        <span class="bold">${esc(ed.degree)}</span>
        <span class="dates">${esc(ed.dates)}</span>
      </div>
      <div class="italic">${esc(ed.school)}</div>`
    )
    .join("");

  const projects = (resume.projects || [])
    .map((p) => `<div><span class="bold">${esc(p.name)}</span> — ${esc(p.description)}</div>`)
    .join("");

  return `
  <h1>${esc(resume.name)}</h1>
  <div class="contact">${contactLine}</div>

  <h2>Summary</h2>
  <p>${esc(resume.summary)}</p>

  <h2>Skills</h2>
  <p class="skills">${(resume.skills || []).map(esc).join(" &bull; ")}</p>

  <h2>Experience</h2>
  ${experience}

  ${projects ? `<h2>Projects</h2>${projects}` : ""}

  <h2>Education</h2>
  ${education}
  `;
}

export { buildResumeHtml };
