export function installTheme() {
  const root = document.documentElement;
  const toggle = document.getElementById("theme-toggle");
  const updateButton = () => {
    toggle.setAttribute("aria-pressed", String(root.dataset.theme === "night"));
  };
  updateButton();
  toggle.addEventListener("click", () => {
    const night = root.dataset.theme !== "night";
    if (night) root.dataset.theme = "night";
    else delete root.dataset.theme;
    updateButton();
    try {
      localStorage.setItem("atlas-theme", night ? "night" : "day");
    } catch {}
  });
}

// Publication graphics have a light background and need the matching chart styles.
export function withDayPalette(render) {
  const root = document.documentElement;
  const night = root.dataset.theme === "night";
  if (night) delete root.dataset.theme;
  try {
    return render();
  } finally {
    if (night) root.dataset.theme = "night";
  }
}
