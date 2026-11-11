/**
 * App bootstrap: hash-based router + theme toggle.
 * Routes: #/overview  #/register  #/explore  #/analytics  #/predict
 */

import { store } from "./store.js";
import { chartDefaults, destroyCharts, icon } from "./ui.js";
import { renderOverview } from "./pages/overview.js";
import { renderRegister } from "./pages/register.js";
import { renderExplore } from "./pages/explore.js";
import { renderAnalytics } from "./pages/analytics.js";
import { renderPredict } from "./pages/predict.js";

const NAV = [
  { id: "overview", label: "Overview", short: "Home", icon: "activity" },
  { id: "register", label: "1 · Register Patient", short: "1 · Register", icon: "userPlus" },
  { id: "explore", label: "2 · Data Explorer", short: "2 · Explore", icon: "table" },
  { id: "analytics", label: "3 · Analytics", short: "3 · Analytics", icon: "chart" },
  { id: "predict", label: "4 · Prediction", short: "4 · Predict", icon: "brain" },
];

const PAGES = {
  overview: renderOverview,
  register: renderRegister,
  explore: renderExplore,
  analytics: renderAnalytics,
  predict: renderPredict,
};

/* ---------- theme ---------- */

function initTheme() {
  const btn = document.getElementById("theme-toggle");
  const setBtnLabel = () => {
    const dark = document.documentElement.classList.contains("dark");
    btn.setAttribute("title", dark ? "Switch to light mode" : "Switch to dark mode");
    btn.setAttribute("aria-label", btn.getAttribute("title"));
  };
  btn.addEventListener("click", () => {
    const dark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("ckd-theme", dark ? "dark" : "light");
    setBtnLabel();
    // re-theme live charts on the current page
    window.dispatchEvent(new CustomEvent("portal:theme"));
  });
  setBtnLabel();
}

/* ---------- nav ---------- */

function renderNav(activeId) {
  const nav = document.getElementById("nav");
  nav.innerHTML = "";
  for (const t of NAV) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nav-btn" + (t.id === activeId ? " active" : "");
    btn.setAttribute("aria-current", t.id === activeId ? "page" : "false");
    btn.innerHTML = `${icon(t.icon)}<span class="nav-label">${t.label}</span><span class="nav-short">${t.short}</span>`;
    btn.addEventListener("click", () => { location.hash = `#/${t.id}`; });
    nav.appendChild(btn);
  }
}

/* ---------- router ---------- */

let renderToken = 0;

function currentPageId() {
  const id = (location.hash || "#/overview").replace(/^#\//, "");
  return PAGES[id] ? id : "overview";
}

async function render() {
  const token = ++renderToken;
  const id = currentPageId();
  renderNav(id);
  destroyCharts();
  document.getElementById("dialog-root").innerHTML = "";

  const root = document.getElementById("page");
  root.innerHTML = `<div class="page-loading">
      <div class="skeleton sk-title"></div><div class="skeleton sk-line"></div><div class="skeleton sk-block"></div>
    </div>`;

  try {
    await store.ready;
  } catch (e) {
    root.innerHTML = `<div class="card card-pad"><p class="strong">Could not load the cohort data.</p>
      <p class="small muted">${String(e && e.message || e)} — when serving from a subdirectory, make sure data/cohort.json is reachable.</p></div>`;
    return;
  }

  chartDefaults();
  const page = PAGES[id];
  try {
    await page(root, { rerender: () => { if (token === renderToken) render(); } });
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="card card-pad"><p class="strong">Something went wrong rendering this page.</p>
      <p class="small muted">${String(e && e.message || e)}</p></div>`;
  }
  window.scrollTo({ top: 0 });
}

/* ---------- boot ---------- */

initTheme();
window.addEventListener("hashchange", render);
// Re-render data pages when the dataset changes (patient added/removed/imported)
store.subscribe(() => {
  const id = currentPageId();
  if (id === "overview" || id === "explore" || id === "analytics") render();
});
render();
