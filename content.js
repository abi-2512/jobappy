(() => {
  if (document.getElementById("jobappy-button")) return;

  const btn = document.createElement("button");
  btn.id = "jobappy-button";
  btn.textContent = "Tailor Resume";
  Object.assign(btn.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: "2147483647",
    padding: "12px 20px",
    borderRadius: "999px",
    border: "none",
    background: "#111",
    color: "#fff",
    fontSize: "14px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontWeight: "600",
    boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
    cursor: "pointer",
    transition: "transform 0.15s ease, box-shadow 0.15s ease"
  });
  btn.onmouseenter = () => {
    btn.style.transform = "translateY(-2px)";
    btn.style.boxShadow = "0 6px 20px rgba(0,0,0,0.3)";
  };
  btn.onmouseleave = () => {
    btn.style.transform = "none";
    btn.style.boxShadow = "0 4px 16px rgba(0,0,0,0.25)";
  };
  btn.onclick = async () => {
    await chrome.runtime.sendMessage({
      type: "saveJobText",
      jobText: document.body.innerText.slice(0, 20000),
      jobUrl: location.href
    });
    btn.textContent = "Grabbed ✓ open the extension icon";
    setTimeout(() => (btn.textContent = "Tailor Resume"), 2500);
  };

  document.documentElement.appendChild(btn);
})();
