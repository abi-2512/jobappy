const $ = (id) => document.getElementById(id);

const SAMPLE_RESUME = {
  name: "Jane Doe",
  contact: { email: "jane@example.com", phone: "555-0100", location: "Remote", links: "linkedin.com/in/janedoe" },
  workAuth: "Authorized to work in the U.S.",
  skills: {
    Languages: ["Python", "SQL"],
    "Frameworks & Tools": ["FastAPI", "PostgreSQL", "AWS", "Docker"],
    Concepts: ["Distributed Systems", "REST APIs"]
  },
  experience: [
    {
      title: "Software Engineer",
      company: "Acme Corp",
      location: "Remote",
      dates: "2022 – Present",
      bullets: ["Reduced API latency by 30% by rewriting the caching layer"]
    }
  ],
  education: [
    { school: "State University", degree: "B.S. Computer Science", location: "State, USA", dates: "2018 – 2022" }
  ],
  projects: [
    {
      name: "Side Project",
      techStack: "Python, FastAPI",
      dates: "2023",
      bullets: ["Built a small tool to automate a personal workflow"]
    }
  ]
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
