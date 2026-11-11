/**
 * Page 4 · Prediction Platform — enter a new patient profile and receive
 * time-to-kidney-failure and time-to-transplant from each of the five
 * learning models. The Attention NN is computed architecture-faithfully;
 * RSF / GB / NN use calibrated kNN surrogates over the study's published
 * predictions. All inference runs locally in the browser.
 */

import { store } from "../store.js";
import { MODELS } from "../columns.js";
import { ensureReady, predictAll, rowToPool } from "../engine.js";
import { el, icon, esc, toast, makeChart, chartColors, fmtN } from "../ui.js";

const FIELDS = [
  { key: "sex", label: "Sex", unit: "", def: "Male" },
  { key: "age", label: "Age", unit: "years", def: "64" },
  { key: "egfr", label: "eGFR", unit: "mL/min/1.73m²", def: "28.0", hint: "primary driver of the base median" },
  { key: "microalb", label: "MicroAlbumin", unit: "mg/L", def: "180.0", hint: "log₁₀-transformed by the models" },
  { key: "bun", label: "BUN", unit: "mg/dL", def: "34.0" },
  { key: "ca", label: "Calcium", unit: "mg/dL", def: "8.9" },
  { key: "p", label: "Phosphorus", unit: "mg/dL", def: "4.7" },
  { key: "alb", label: "Albumin", unit: "g/dL", def: "3.4" },
  { key: "cr", label: "Creatinine", unit: "mg/dL", def: "2.5" },
  { key: "hb", label: "Hemoglobin", unit: "g/dL", def: "11.2" },
  { key: "k", label: "Potassium", unit: "mEq/L", def: "4.7" },
  { key: "pro", label: "Proteinuria", unit: "g/24h", def: "1.5", hint: "0 allowed" },
];

let metricsJson = null;

export async function renderPredict(root) {
  if (!metricsJson) metricsJson = await fetch("data/metrics.json").then((r) => r.json());
  await ensureReady();

  root.innerHTML = "";

  /* ---------- head ---------- */
  const head = el(`<div class="page-head">
    <div>
      <h1 class="page-title">Page 4 · Prediction Platform</h1>
      <p class="page-desc">Enter the 12 model-input features of a new patient. Every learning model returns its own
        predicted <b>time to kidney failure</b> and <b>time to transplant</b> (months).</p>
    </div>
    <div class="head-actions">
      <button class="btn btn-outline btn-sm" data-example>${icon("wand")} Load example from study cohort</button>
    </div>
  </div>`);

  /* ---------- form ---------- */
  const inputs = {};
  const formCard = el(`<div class="card">
    <div class="card-head"><h3 class="card-title">${icon("userPlus")} New patient profile</h3>
      <p class="card-desc">The 12 normalized biomarker features used by all five models.</p></div>
    <div class="card-pad" style="padding-top:0.2rem;">
      <div class="form-grid form-grid-3"></div>
      <div class="right" style="margin-top:0.9rem;">
        <button class="btn btn-ghost" data-clear>Clear</button>
        <button class="btn btn-primary" data-run>${icon("brain")} Predict with all five models</button>
      </div>
    </div>
  </div>`);
  const grid = formCard.querySelector(".form-grid");

  for (const f of FIELDS) {
    const field = f.key === "sex"
      ? el(`<div class="field"><label class="lbl" for="p-${f.key}">${f.label}</label>
           <select id="p-${f.key}" class="input" aria-label="${f.label}"><option>Male</option><option>Female</option></select></div>`)
      : el(`<div class="field"><label class="lbl" for="p-${f.key}">${f.label}${f.unit ? `<span class="unit">(${f.unit})</span>` : ""}</label>
           <input id="p-${f.key}" class="input" type="number" inputmode="decimal" step="any" value="${f.def}" aria-label="${f.label}" />
           ${f.hint ? `<p class="field-hint">${f.hint}</p>` : ""}</div>`);
    inputs[f.key] = field.querySelector("input, select");
    grid.appendChild(field);
  }

  /* ---------- results ---------- */
  const results = el(`<div class="stack-sm" hidden></div>`);

  formCard.querySelector("[data-clear]").addEventListener("click", () => {
    for (const f of FIELDS) inputs[f.key].value = f.def;
    results.hidden = true;
    results.innerHTML = "";
  });

  head.querySelector("[data-example]").addEventListener("click", () => {
    const study = store.allRows().filter((r) => r.source === "study");
    const r = study[Math.floor(Math.random() * study.length)];
    const map = { sex: r.sex, age: r.age, egfr: r.egfr, microalb: r.microalb, bun: r.bun, ca: r.ca, p: r.p, alb: r.alb, cr: r.cr, hb: r.hb, k: r.k, pro: r.pro };
    for (const f of FIELDS) inputs[f.key].value = map[f.key];
    toast(`Loaded ${r.patientId}`, "A random study patient — press Predict to score this profile.");
  });

  formCard.querySelector("[data-run]").addEventListener("click", async () => {
    const btn = formCard.querySelector("[data-run]");
    btn.disabled = true;
    try {
      const input = {};
      for (const f of FIELDS) {
        const v = f.key === "sex" ? inputs.sex.value : Number(inputs[f.key].value);
        if (f.key !== "sex" && !Number.isFinite(v)) {
          toast("Invalid value", `${f.label} must be a number`, true);
          inputs[f.key].classList.add("invalid");
          return;
        }
        input[f.key] = v;
      }
      const pool = store.allRows().filter((r) => r.prediction).map(rowToPool);
      if (pool.length === 0) throw new Error("No reference predictions available");
      const result = predictAll(input, pool);
      renderResults(input, result);
    } catch (e) {
      toast("Prediction failed", String(e.message || e), true);
    } finally {
      btn.disabled = false;
    }
  });

  function renderResults(input, result) {
    const cix = (model, outcome) => {
      const row = metricsJson.find((x) => x.Model === model && x.Outcome === outcome);
      return row ? row["C-index"].toFixed(3) : null;
    };
    const models = MODELS.map((m) => ({
      ...m,
      f: result.predictions[`${m.key}Failure`],
      t: result.predictions[`${m.key}Transplant`],
      cF: cix(m.cKey, "Kidney Failure"),
      cT: cix(m.cKey, "Transplant"),
    }));

    results.innerHTML = `
      <!-- attention interpretability -->
      <div class="card card-accent">
        <div class="card-head">
          <h3 class="card-title">${icon("network")} Attention NN — primary model (C-index 0.925 / 0.909)</h3>
          <p class="card-desc">Multi-head self-attention over four feature groups. Risk drives the time:
            <span class="inline-formula">time = base median(eGFR) × e^(−risk × 0.6)</span> ·
            risk = ${result.attention.riskScore.toFixed(3)} (${result.attention.riskLabel})</p>
        </div>
        <div class="card-pad" style="padding-top:0.2rem;">
          <div class="stat-grid stat-grid-4" style="margin-bottom:0.9rem;">
            <div class="stat"><div class="stat-lbl">${icon("gauge")} Risk score</div><div class="stat-val">${result.attention.riskScore.toFixed(3)}</div><div class="stat-sub">${result.attention.riskLabel} risk (cap 0.42)</div></div>
            <div class="stat"><div class="stat-lbl">${icon("clock")} Base median — failure</div><div class="stat-val">${result.attention.baseMedianFailure} mo</div><div class="stat-sub">eGFR-only baseline</div></div>
            <div class="stat"><div class="stat-lbl">${icon("clock")} Base median — transplant</div><div class="stat-val">${result.attention.baseMedianTransplant} mo</div><div class="stat-sub">eGFR-only baseline</div></div>
            <div class="stat"><div class="stat-lbl">${icon("activity")} Risk multiplier e^−0.6r</div><div class="stat-val">×${result.attention.multiplier.toFixed(3)}</div><div class="stat-sub">applied to both baselines</div></div>
          </div>
          <div class="grid-2" style="gap:1rem;">
            ${[["Head 1", result.attention.head1], ["Head 2", result.attention.head2]].map(([label, ws]) => `
              <div>
                <p class="small strong" style="margin:0 0 0.3rem;">${label}</p>
                ${ws.map((w, i) => `
                  <div class="wbar-row">
                    <span class="wbar-label" title="${esc(result.attention.groups[i])}">${esc(result.attention.groups[i])}</span>
                    <div class="wbar-track"><div class="wbar-fill" style="width:${(w * 100).toFixed(1)}%"></div></div>
                    <span class="wbar-val tabnum">${w.toFixed(3)}</span>
                  </div>`).join("")}
              </div>`).join("")}
          </div>
          <details style="margin-top:0.9rem;">
            <summary class="small strong" style="cursor:pointer;">Normalized model inputs (z-scores)</summary>
            <div class="toolbar" style="margin-top:0.5rem;gap:0.35rem;">
              ${Object.entries(result.normalized).map(([k, v]) => `
                <span class="badge badge-mono" title="${k}">${k.replace("LogMicroAlb", "lMicroAlb")}&nbsp;${fmtN(v, 2)}</span>`).join("")}
            </div>
            <p class="xsmall muted" style="margin-top:0.4rem;">Cox linear predictor η = ${result.coxLinearPredictor.toFixed(3)}</p>
          </details>
        </div>
      </div>

      <!-- five models -->
      <div class="card">
        <div class="card-head"><h3 class="card-title">${icon("brain")} All five learning models</h3>
          <p class="card-desc">Predicted months (central estimates; each model carries ±5% stochastic variability).</p></div>
        <div class="card-pad" style="padding-top:0.2rem;">
          <div class="model-grid">
            ${models.map((m) => `
              <div class="model-card${m.key === "attn" ? " primary-model" : ""}" title="${esc(m.label)}">
                <div class="m-name">${m.short}</div>
                <div class="m-val">${m.f}</div><div class="m-cap">failure (mo)</div>
                <div class="m-val" style="font-size:0.95rem;">${m.t}</div><div class="m-cap">transplant (mo)</div>
                ${m.cF ? `<div class="m-cix">C-index ${m.cF} / ${m.cT}</div>` : ""}
              </div>`).join("")}
          </div>
          <div class="chart-box chart-h-220" style="margin-top:0.9rem;"><canvas id="ch-pred"></canvas></div>
          <p class="xsmall muted" style="margin-top:0.6rem;">RSF / Gradient Boosted / Neural Network outputs are calibrated
            k-nearest-neighbour surrogates over the study's published predictions (k = 10, inverse-distance weighted) —
            see the reference set below for full transparency.</p>
        </div>
      </div>

      <!-- neighbours -->
      <div class="card">
        <div class="card-head"><h3 class="card-title">${icon("users")} Most similar cohort patients (kNN reference set)</h3>
          <p class="card-desc">Used by the RSF / GB / NN surrogates — transparency for the interpolated outputs.</p></div>
        <div class="card-pad" style="padding-top:0.2rem;">
          <div class="table-scroll" style="max-height:20rem;">
            <table class="plain">
              <thead><tr><th>Patient</th><th>Distance</th>
                <th>RSF F / T</th><th>GB F / T</th><th>NN F / T</th></tr></thead>
              <tbody>${result.neighbours.map((n) => `
                <tr><td class="strong">${esc(n.patientId)}</td>
                  <td class="num">${n.distance.toFixed(3)}</td>
                  <td class="num">${n.rsfFailure} / ${n.rsfTransplant}</td>
                  <td class="num">${n.gbFailure} / ${n.gbTransplant}</td>
                  <td class="num">${n.nnFailure} / ${n.nnTransplant}</td></tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    results.hidden = false;

    const c = chartColors();
    makeChart("ch-pred", {
      type: "bar",
      data: {
        labels: models.map((m) => m.short),
        datasets: [
          { label: "Time to kidney failure (mo)", data: models.map((m) => m.f), backgroundColor: c.c3, borderRadius: 4 },
          { label: "Time to transplant (mo)", data: models.map((m) => m.t), backgroundColor: c.c1, borderRadius: 4 },
        ],
      },
      options: {
        indexAxis: "y", maintainAspectRatio: false, animation: { duration: 300 },
        scales: { x: { beginAtZero: true, title: { display: true, text: "Months" } } },
      },
    });

    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  root.append(head, formCard, results);
}
