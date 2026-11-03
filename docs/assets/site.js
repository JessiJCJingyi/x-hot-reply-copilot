const tabs = Array.from(document.querySelectorAll("[data-feature]"));
const panels = Array.from(document.querySelectorAll("[data-feature-panel]"));

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const feature = tab.dataset.feature;
    tabs.forEach((item) => {
      const active = item === tab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.featurePanel !== feature;
    });
  });
});
