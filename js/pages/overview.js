/**
 * Overview — hero, cohort counters, CKD stage strip, page cards,
 * recent portal entries.
 */

import { store } from "../store.js";
import { STAGE_ORDER, ckStage } from "../columns.js";
import { el, icon, esc } from "../ui.js";

const PAGE_CARDS = [
  {
    id: "register", n: "1", icon: "userPlus", title: "Register Patient",
    desc: "Enter a new patient using the exact columns of Patient Data.xlsx. The record is stored in this browser and all five models are scored automatically.",
  },
  {
    id: "explore", n: "2", icon: "database", title: "Data Explorer",
    desc: "Browse all 500+ patients, search by any feature combination, inspect individual records and download any filtered subset as CSV or Excel.",
  },
  {
    id: "analytics", n: "3", icon: "chart", title: "Analytics & Tests",
    desc: "Live exploratory analysis: distributions, correlations, CKD staging, sex/ANOVA comparisons, Kaplan–Meier curves and model performance — updated with every new entry.",
  },
  {
    id: "predict", n: "4", icon: "brain", title: "Prediction Platform",
    desc: "Enter a new patient profile and get predicted time to kidney failure and time to transplant from each learning model, with attention-weight interpretability.",
  },
];

export function renderOverview(root) {
  const rows = store.allRows();
  const portalRows = rows.filter((r) => r.source === "portal");
  const males = rows.filter((r) => r.sex === "Male").length;
  const females = rows.length - males;
  const stages = Object.fromEntries(STAGE_ORDER.map((s) => [s, 0]));
  for (const r of rows) stages[ckStage(r.egfr).stage]++;
  const totalStages = rows.length;
  const recent = [...portalRows].reverse().slice(0, 5);

  root.innerHTML = "";

  /* hero */
  const hero = el(`<div class="card card-hero"><div class="card-pad" style="display:flex;gap:1.5rem;flex-wrap:wrap;align-items:center;">
    <div style="flex:1;min-width:16rem;">
      <span class="pill">${icon("sparkles")} Attention-Based Neural Network Survival · C-index 0.925</span>
      <h1 class="page-title" style="font-size:1.6rem;margin-top:0.7rem;">Chronic Kidney Disease Survival Portal</h1>
      <p class="page-desc" style="font-size:0.9rem;">
        A four-page workspace for the 500-patient CKD cohort: register new patients into the Patient Data file,
        explore and export the full dataset, run live exploratory statistics, and predict time-to-kidney-failure
        and time-to-transplant with five survival learning models (Cox PH, Random Survival Forest, Gradient
        Boosting, Neural Network and Attention NN).
      </p>
      <div class="row" style="margin-top:0.9rem;">
        <a class="btn btn-primary" href="#/register">${icon("userPlus")} Register a patient</a>
        <a class="btn btn-outline" href="#/predict">${icon("brain")} Predict outcomes</a>
      </div>
    </div>
    <div class="stat-grid" style="flex:0 0 auto;width:17rem;">
      <div class="stat"><div class="stat-lbl">${icon("users")} Patients</div><div class="stat-val">${rows.length}</div></div>
      <div class="stat"><div class="stat-lbl">${icon("clock")} Stored predictions</div><div class="stat-val">${rows.filter((r) => r.prediction).length}</div></div>
      <div class="stat"><div class="stat-lbl">${icon("userPlus")} Portal entries</div><div class="stat-val">${portalRows.length}</div></div>
      <div class="stat"><div class="stat-lbl">${icon("users")} Male / Female</div><div class="stat-val" style="font-size:1rem;">${males} / ${females}</div></div>
    </div>
  </div></div>`);

  /* stage strip */
  const strip = STAGE_ORDER.map((stage) => {
    const count = stages[stage];
    const pct = totalStages ? (count / totalStages) * 100 : 0;
    return `<div style="width:${pct}%" title="${stage}: ${count} patients (${pct.toFixed(1)}%)">${pct > 6 ? `${stage} · ${count}` : ""}</div>`;
  }).join("");

  const stageCard = el(`<div class="card">
    <div class="card-head"><h3 class="card-title">Cohort by CKD eGFR stage (KDIGO)</h3></div>
    <div class="card-pad">
      <div class="stage-strip" role="img" aria-label="CKD stage distribution">${strip}</div>
      <div class="stage-note">
        <span>G1 ≥ 90</span><span>G2 60–89</span><span>G3a 45–59</span>
        <span>G3b 30–44</span><span>G4 15–29</span><span>G5 &lt; 15 mL/min/1.73m²</span>
      </div>
    </div>
  </div>`);

  /* page cards */
  const cards = el(`<div class="page-cards"></div>`);
  for (const c of PAGE_CARDS) {
    const card = el(`<button type="button" class="card page-card card-pad" style="border:1px solid var(--border);font:inherit;background:var(--card);color:inherit;">
      <div class="row" style="gap:0.6rem;">
        <span class="pc-icon">${icon(c.icon)}</span>
        <span><span class="pc-num">Page ${c.n}</span><span class="pc-title" style="display:block;">${c.title}</span></span>
      </div>
      <p class="pc-desc">${c.desc}</p>
      <span class="pc-open">Open ${icon("arrowRight")}</span>
    </button>`);
    card.addEventListener("click", () => { location.hash = `#/${c.id}`; });
    cards.appendChild(card);
  }

  /* recent portal entries */
  const recentCard = el(`<div class="card">
    <div class="card-head row-between">
      <h3 class="card-title">Recently registered via portal</h3>
      <a class="btn btn-ghost btn-sm" href="#/explore">Open explorer ${icon("arrowRight")}</a>
    </div>
    <div class="card-pad" style="padding-top:0.2rem;">
      <p class="small muted" style="margin:0 0 0.4rem;">Study rows CKD-0001…0500 are read-only; portal additions start at CKD-0501.</p>
      ${recent.length === 0
        ? `<p class="small muted">No portal-registered patients yet — use Page 1 to add the first one. New entries immediately appear in the explorer, the analytics and the kNN reference pool of the prediction engine.</p>`
        : `<ul class="list-plain">${recent.map((r) => `
            <li>
              <span class="strong tabnum">${esc(r.patientId)}</span>
              <span class="muted">${esc(r.sex)}, ${r.age} y</span>
              <span class="muted">eGFR ${Number(r.egfr).toFixed(1)} · ${ckStage(r.egfr).stage}</span>
              <span class="xsmall muted" style="display:none;" data-wide>${new Date(r.createdAt).toLocaleString()}</span>
            </li>`).join("")}</ul>`}
    </div>
  </div>`);
  if (window.innerWidth >= 640) {
    recentCard.querySelectorAll("[data-wide]").forEach((n) => (n.style.display = "inline"));
  }

  root.append(hero, stageCard, cards, recentCard);
}
