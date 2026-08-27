const $ = (id) => document.getElementById(id);

const SAMPLE_RESUME = {
  name: "Jane Doe",
  contact: { email: "jane@example.com", phone: "555-0100", location: "Remote", links: "linkedin.com/in/janedoe" },
  summary: "Software engineer with 5 years building backend systems.",
  skills: ["Python", "PostgreSQL", "AWS"],
  experience: [
    {
      title: "Software Engineer",
      company: "Acme Corp",
      dates: "2022 – Present",
      bullets: ["Reduced API latency by 30% by rewriting the caching layer"]
    }
  ],
  education: [{ degree: "B.S. Computer Science", school: "State University", dates: "2018 – 2022" }],
  projects: []
};

async function load() {
  const { geminiKey, nimKey, resume } = await chrome.storage.local.get([
    "geminiKey",
    "nimKey",
    "resume"
  ]);
  if (geminiKey) $("geminiKey").value = geminiKey;
  if (nimKey) $("nimKey").value = nimKey;
  $("resume").value = resume ? JSON.stringify(resume, null, 2) : JSON.stringify(SAMPLE_RESUME, null, 2);
}

async function save() {
  $("jsonError").style.display = "none";

  let resume;
  try {
    resume = JSON.parse($("resume").value);
  } catch (e) {
    $("jsonError").textContent = `Resume JSON is invalid: ${e.message}`;
    $("jsonError").style.display = "block";
    return;
  }

  await chrome.storage.local.set({
    geminiKey: $("geminiKey").value.trim(),
    nimKey: $("nimKey").value.trim(),
    resume
  });

  $("savedMsg").style.display = "inline";
  setTimeout(() => ($("savedMsg").style.display = "none"), 2000);
}

$("save").addEventListener("click", save);
load();
