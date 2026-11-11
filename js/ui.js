/**
 * Shared UI helpers: icons, DOM builders, toasts, dialogs, popovers,
 * Chart.js theming and small formatting utilities.
 */

/* ---------- icons (lucide-style inline SVG) ---------- */
const P = (d) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICONS = {
  activity: P('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),
  userPlus: P('<path d="M2 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="8" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>'),
  table: P('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M9 5v14M15 5v14"/>'),
  chart: P('<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="4" width="3" height="14"/>'),
  brain: P('<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M12 5v13"/>'),
  database: P('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>'),
  users: P('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  clock: P('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
  search: P('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
  download: P('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>'),
  upload: P('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>'),
  eye: P('<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>'),
  sliders: P('<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>'),
  filterX: P('<path d="M13.13 14.56 11 22 2 2l20 20-3.48-6.44"/><path d="m21.39 2.61-8.26 8.26"/>'),
  chevronLeft: P('<path d="m15 18-6-6 6-6"/>'),
  chevronRight: P('<path d="m9 18 6-6-6-6"/>'),
  arrowUp: P('<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>'),
  arrowDown: P('<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>'),
  arrowRight: P('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'),
  trash: P('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  wand: P('<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/>'),
  check: P('<path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>'),
  rotate: P('<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'),
  x: P('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  sparkles: P('<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>'),
  refresh: P('<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>'),
  sigma: P('<path d="M18 7V4H6l6 8-6 8h12v-3"/>'),
  equal: P('<line x1="5" x2="19" y1="9" y2="9"/><line x1="5" x2="19" y1="15" y2="15"/>'),
  network: P('<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>'),
  gauge: P('<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>'),
  info: P('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
  file: P('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>'),
};

/* ---------- tiny DOM helpers ---------- */

export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function icon(name, cls = "icon") {
  const svg = ICONS[name] || ICONS.info;
  return cls === "icon" ? svg : svg.replace('class="icon"', `class="${cls}"`);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ---------- formatting ---------- */

export function fmtP(p) {
  if (!Number.isFinite(p)) return "—";
  if (p < 0.001) return "< 0.001";
  return p.toFixed(3);
}

export function stars(p) {
  if (p < 0.001) return "***";
  if (p < 0.01) return "**";
  if (p < 0.05) return "*";
  return "ns";
}

export function fmtN(v, d = 1) {
  return Number.isFinite(v) ? v.toFixed(d) : "—";
}

/* ---------- toasts ---------- */

export function toast(title, description = "", isError = false) {
  const root = $("#toast-root");
  const node = el(
    `<div class="toast${isError ? " err" : ""}" role="status">
       ${icon(isError ? "info" : "check")}
       <div><div class="strong">${esc(title)}</div>${description ? `<div class="small muted">${esc(description)}</div>` : ""}</div>
     </div>`
  );
  root.appendChild(node);
  setTimeout(() => node.remove(), 4200);
}

/* ---------- dialog ---------- */

export function openDialog(titleHtml, subHtml, bodyHtml, opts = {}) {
  const root = $("#dialog-root");
  root.innerHTML = "";
  const backdrop = el(
    `<div class="dialog-backdrop" role="presentation">
       <div class="dialog" role="dialog" aria-modal="true">
         <div class="dialog-head">
           <div>
             <h2 class="dialog-title">${titleHtml}</h2>
             ${subHtml ? `<p class="dialog-sub">${subHtml}</p>` : ""}
           </div>
           <button class="btn btn-ghost btn-icon" data-close aria-label="Close">${icon("x")}</button>
         </div>
         <div class="dialog-body">${bodyHtml}</div>
       </div>
     </div>`
  );
  const close = () => { backdrop.remove(); document.removeEventListener("keydown", onKey); opts.onClose && opts.onClose(); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  backdrop.addEventListener("mousedown", (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector("[data-close]").addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  root.appendChild(backdrop);
  return { close, body: backdrop.querySelector(".dialog-body") };
}

/* ---------- popover ---------- */

export function attachPopover(triggerBtn, buildContent) {
  const wrap = triggerBtn.closest(".pop-wrap") || triggerBtn.parentElement;
  const existing = wrap.querySelector(".popover");
  if (existing) { existing.remove(); return null; }
  // close any other open popovers
  document.querySelectorAll(".popover").forEach((p) => p.remove());
  const pop = el(`<div class="popover"></div>`);
  if (typeof buildContent === "string") pop.innerHTML = buildContent;
  else pop.appendChild(buildContent);
  wrap.appendChild(pop);
  const onDoc = (e) => {
    if (!pop.contains(e.target) && e.target !== triggerBtn && !triggerBtn.contains(e.target)) {
      pop.remove();
      document.removeEventListener("mousedown", onDoc);
    }
  };
  document.addEventListener("mousedown", onDoc);
  return pop;
}

/* ---------- Chart.js helpers ---------- */

export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function chartColors() {
  return {
    c1: cssVar("--chart-1"), c2: cssVar("--chart-2"), c3: cssVar("--chart-3"),
    c4: cssVar("--chart-4"), c5: cssVar("--chart-5"),
    border: cssVar("--border"), fg: cssVar("--foreground"),
    muted: cssVar("--muted-foreground"), card: cssVar("--card"),
  };
}

export function chartDefaults() {
  if (!window.Chart) return;
  const c = chartColors();
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.font.size = 11;
  Chart.defaults.color = c.muted;
  Chart.defaults.borderColor = c.border;
  Chart.defaults.plugins.tooltip.backgroundColor = c.card;
  Chart.defaults.plugins.tooltip.titleColor = c.fg;
  Chart.defaults.plugins.tooltip.bodyColor = c.fg;
  Chart.defaults.plugins.tooltip.borderColor = c.border;
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.legend.labels.color = c.muted;
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.boxHeight = 10;
}

/** Registry of live charts so pages can destroy + redraw on theme/data change. */
const liveCharts = [];
export function makeChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart) return null;
  const prev = Chart.getChart(canvas);
  if (prev) prev.destroy();
  const chart = new Chart(canvas, config);
  liveCharts.push(chart);
  return chart;
}

export function destroyCharts() {
  for (const c of liveCharts) { try { c.destroy(); } catch { /* noop */ } }
  liveCharts.length = 0;
}

/* ---------- simple HTML bar row ---------- */

export function wbar(label, value, max = 1) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return `<div class="wbar-row">
    <span class="wbar-label" title="${esc(label)}">${esc(label)}</span>
    <div class="wbar-track"><div class="wbar-fill" style="width:${pct.toFixed(1)}%"></div></div>
    <span class="wbar-val tabnum">${Number(value).toFixed(3)}</span>
  </div>`;
}
