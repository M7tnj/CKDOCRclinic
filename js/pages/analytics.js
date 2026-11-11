/**
 * Page 3 · Analytics & Statistical Tests — every computation runs live over
 * the merged dataset (study rows + portal entries), so all charts and tables
 * update automatically when new patients are registered.
 *
 * Sections: cohort summary · sex comparison (Welch t + Mann-Whitney U) ·
 * ANOVA across CKD stages · stage distribution · distribution explorer ·
 * relationship explorer + correlation heatmap · Kaplan–Meier + log-rank ·
 * model performance (C-index / predicted-time spread / feature importance) ·
 * study evaluation tables.
 */

import { store } from "../store.js";
import { NUMERIC_COLUMNS, ckStage, STAGE_ORDER, MODELS } from "../columns.js";
import {
  el, icon, esc, makeChart, chartColors, cssVar, fmtP, stars, fmtN,
} from "../ui.js";
import {
  mean, std, median, quantile, pearson, spearman, corrP,
  twoGroupTests, anova, kaplanMeier, logRank,
} from "../stats.js";

const CORR_FEATURES = [
  { key: "age", name: "Age" }, { key: "egfr", name: "eGFR" }, { key: "cr", name: "Creatinine" },
  { key: "alb", name: "Albumin" }, { key: "microalb", name: "Microalbumin" }, { key: "bun", name: "BUN" },
  { key: "ca", name: "Calcium" }, { key: "p", name: "Phosphorus" }, { key: "hb", name: "Hemoglobin" },
  { key: "k", name: "Potassium" }, { key: "pro", name: "Proteinuria" }, { key: "hba1c", name: "HbA1c" },
];

const labelOf = (k) => NUMERIC_COLUMNS.find((c) => c.key === k)?.label ?? k;

let metricsJson = null;
let importanceJson = null;

async function loadStatic() {
  if (!metricsJson) {
    const [m, i] = await Promise.all([
      fetch("data/metrics.json").then((r) => r.json()),
      fetch("data/importance.json").then((r) => r.json()),
    ]);
    metricsJson = m;
    importanceJson = i;
  }
}

function heatColor(v) {
  // -1 -> red, 0 -> card, +1 -> teal
  const pos = v >= 0;
  const a = Math.min(1, Math.abs(v));
  const posRgb = [8, 141, 132], negRgb = [209, 93, 77];
  const mid = document.documentElement.classList.contains("dark") ? [16, 27, 30] : [255, 255, 255];
  const rgb = pos ? posRgb : negRgb;
  const c = mid.map((m, i) => Math.round(m + (rgb[i] - m) * a));
  return `rgb(${c.join(",")})`;
}

export async function renderAnalytics(root, ctx = {}) {
  await loadStatic();
  const rows = store.allRows();
  const num = (k) => rows.map((r) => r[k]);
  const males = rows.filter((r) => r.sex === "Male");
  const females = rows.filter((r) => r.sex === "Female");

  root.innerHTML = "";

  /* ---------- head ---------- */
  const head = el(`<div class="page-head">
    <div>
      <h1 class="page-title">Page 3 · Analytics &amp; Statistical Tests</h1>
      <p class="page-desc">Exploratory analysis and inferential tests over the live cohort — every chart and table
        recomputes when patients are registered on Page 1.</p>
    </div>
    <div class="head-actions">
      <span class="badge badge-mono">${rows.length} patients · updated ${new Date().toLocaleTimeString()}</span>
      <button class="btn btn-outline btn-sm" data-refresh>${icon("refresh")} Refresh</button>
    </div>
  </div>`);

  /* ---------- summary ---------- */
  const egfrs = num("egfr");
  const summary = el(`<div class="stat-grid stat-grid-4">
    ${[
      ["users", "Patients", rows.length, `${rows.filter((r) => r.source === "portal").length} portal · ${rows.filter((r) => r.source === "study").length} study`],
      ["users", "Male / Female", `${males.length} / ${females.length}`, "cohort composition"],
      ["activity", `Age (y)`, `${fmtN(mean(num("age")), 1)} ± ${fmtN(std(num("age")), 1)}`, `median ${fmtN(median(num("age")), 0)} y`],
      ["activity", "eGFR", `${fmtN(mean(egfrs), 1)} ± ${fmtN(std(egfrs), 1)}`, `median ${fmtN(median(egfrs), 1)} mL/min/1.73m²`],
    ].map(([ic, label, val, sub]) => `
      <div class="stat"><div class="stat-lbl">${icon(ic)} ${label}</div>
      <div class="stat-val" style="font-size:${typeof val === "string" && val.length > 8 ? "1rem" : "1.25rem"};">${val}</div>
      <div class="stat-sub">${sub}</div></div>`).join("")}
  </div>`);

  /* ---------- statistical tests (tabs) ---------- */
  const testVars = ["age", "wbc", "hb", "plt", "fbs", "ppg2h", "lymphocyte", "bun", "cr", "ca", "p", "alb", "tsh", "hba1c", "microalb", "na", "k", "ast", "alt", "pro", "egfr"];
  const sexTests = testVars.map((k) =>
    twoGroupTests(labelOf(k), males.map((r) => r[k]), females.map((r) => r[k]), "Male", "Female")
  );

  const anovaVars = ["age", "hb", "alb", "bun", "cr", "ca", "p", "k", "microalb", "pro", "hba1c"];
  const stageGroups = STAGE_ORDER.map((s) => ({ label: s, rows: rows.filter((r) => ckStage(r.egfr).stage === s) }));
  const anovaResults = anovaVars.map((k) =>
    anova(labelOf(k), stageGroups.map((g) => ({ label: g.label, values: g.rows.map((r) => r[k]) })))
  );

  const testsCard = el(`<div class="card">
    <div class="card-head" style="padding-bottom:0.6rem;">
      <h3 class="card-title">${icon("equal")} Statistical tests</h3>
      <p class="card-desc">Welch's t-test with Mann–Whitney U for two groups; one-way ANOVA across CKD eGFR stages.
        Stars: * p&lt;0.05, ** p&lt;0.01, *** p&lt;0.001.</p>
    </div>
    <div class="card-pad" style="padding-top:0;">
      <div class="tab-bar" style="margin-bottom:0.7rem;">
        <button class="tab-btn active" data-tab="sex">Male vs Female (t / U)</button>
        <button class="tab-btn" data-tab="anova">Across CKD stages (ANOVA)</button>
      </div>
      <div class="table-scroll" style="max-height:26rem;">
        <table class="plain" data-sex-table></table>
      </div>
      <div class="table-scroll" style="max-height:26rem;display:none;">
        <table class="plain" data-anova-table></table>
      </div>
    </div>
  </div>`);

  testsCard.querySelector("[data-sex-table]").innerHTML = `
    <thead><tr><th>Variable</th><th>Male mean ± SD</th><th>Female mean ± SD</th>
      <th>Welch t</th><th>df</th><th>p (t)</th><th>MW U</th><th>p (U)</th><th>Sig.</th></tr></thead>
    <tbody>${sexTests.map((t) => `
      <tr>
        <td class="strong">${esc(t.variable)}</td>
        <td class="num">${fmtN(t.meanA, 1)} ± ${fmtN(t.sdA, 1)}</td>
        <td class="num">${fmtN(t.meanB, 1)} ± ${fmtN(t.sdB, 1)}</td>
        <td class="num">${fmtN(t.welchT, 2)}</td>
        <td class="num">${fmtN(t.welchDf, 0)}</td>
        <td class="num">${fmtP(t.welchP)}</td>
        <td class="num">${fmtN(t.mannWhitneyU, 0)}</td>
        <td class="num">${fmtP(t.mannWhitneyP)}</td>
        <td class="${Math.min(t.welchP, t.mannWhitneyP) < 0.05 ? "sig" : "ns"}">${stars(Math.min(t.welchP, t.mannWhitneyP))}</td>
      </tr>`).join("")}</tbody>`;

  testsCard.querySelector("[data-anova-table]").innerHTML = `
    <thead><tr><th>Variable</th><th>F</th><th>df1</th><th>df2</th><th>p</th><th>Sig.</th>
      <th>Group means (G1 → G5)</th></tr></thead>
    <tbody>${anovaResults.map((a) => `
      <tr>
        <td class="strong">${esc(a.variable)}</td>
        <td class="num">${fmtN(a.f, 2)}</td>
        <td class="num">${a.df1}</td>
        <td class="num">${a.df2}</td>
        <td class="num">${fmtP(a.p)}</td>
        <td class="${a.p < 0.05 ? "sig" : "ns"}">${stars(a.p)}</td>
        <td class="num muted">${a.groupMeans.map((g) => `${g.group}: ${fmtN(g.mean, 1)}`).join(" · ")}</td>
      </tr>`).join("")}</tbody>`;

  testsCard.querySelectorAll(".tab-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      testsCard.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
      const sexPane = testsCard.querySelectorAll(".table-scroll")[0];
      const anovaPane = testsCard.querySelectorAll(".table-scroll")[1];
      const showSex = btn.dataset.tab === "sex";
      sexPane.style.display = showSex ? "" : "none";
      anovaPane.style.display = showSex ? "none" : "";
    })
  );

  /* ---------- charts ---------- */
  const stageCard = el(`<div class="card">
    <div class="card-head"><h3 class="card-title">CKD stage distribution (eGFR categories)</h3></div>
    <div class="card-pad"><div class="chart-box chart-h-220"><canvas id="ch-stage"></canvas></div></div>
  </div>`);

  /* distribution explorer */
  const distSel = el(`<select class="input" data-var>
      ${NUMERIC_COLUMNS.map((c) => `<option value="${c.key}" ${c.key === "egfr" ? "selected" : ""}>${c.label} (${c.unit})</option>`).join("")}
    </select>`);
  const binSel = el(`<select class="input" data-bins>${[8, 12, 16, 24].map((n) => `<option ${n === 12 ? "selected" : ""}>${n}</option>`).join("")}</select>`);
  const distStats = el(`<div class="row small muted tabnum"></div>`);
  const distCard = el(`<div class="card">
    <div class="card-head row-between">
      <h3 class="card-title">${icon("sigma")} Distribution explorer</h3>
      <div class="toolbar" data-dist-tools><label class="xsmall muted">bins</label></div>
    </div>
    <div class="card-pad" style="padding-top:0;">
      <div class="chart-box chart-h-260"><canvas id="ch-dist"></canvas></div>
      <div style="margin-top:0.4rem;" data-dist-stats></div>
    </div>
  </div>`);
  distCard.querySelector("[data-dist-tools]").prepend(distSel);
  distCard.querySelector("[data-dist-tools]").appendChild(binSel);
  distCard.querySelector("[data-dist-stats]").appendChild(distStats);

  function drawDist() {
    const key = distSel.value;
    const bins = Number(binSel.value);
    const values = num(key).filter((v) => Number.isFinite(v));
    const lo = Math.min(...values), hi = Math.max(...values);
    const w = (hi - lo) / bins || 1;
    const counts = new Array(bins).fill(0);
    for (const v of values) counts[Math.min(bins - 1, Math.floor((v - lo) / w))]++;
    const labels = counts.map((_, i) => `${(lo + i * w).toFixed(w < 1 ? 1 : 0)}–${(lo + (i + 1) * w).toFixed(w < 1 ? 1 : 0)}`);
    const c = chartColors();
    const mu = mean(values), md = median(values);

    distStats.innerHTML = `<span>n = ${values.length}</span><span>mean ${fmtN(mu, 2)}</span>
      <span>SD ${fmtN(std(values), 2)}</span><span>median ${fmtN(md, 2)}</span>
      <span>Q1 ${fmtN(quantile(values, 0.25), 2)}</span><span>Q3 ${fmtN(quantile(values, 0.75), 2)}</span>`;

    makeChart("ch-dist", {
      type: "bar",
      data: { labels, datasets: [{ label: "Patients", data: counts, backgroundColor: cssVar("--chart-1"), borderRadius: 3 }] },
      options: {
        maintainAspectRatio: false, animation: { duration: 300 },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: (it) => `${labelOf(key)}: ${it[0].label}` } },
        },
        scales: {
          x: { ticks: { maxRotation: 60, autoSkip: true, font: { size: 9 } } },
          y: { beginAtZero: true, title: { display: true, text: "Patients" } },
        },
      },
      plugins: [{
        id: "reflines",
        afterDatasetsDraw(chart) {
          const { ctx, chartArea: area, scales } = chart;
          if (!area) return;
          const xScale = scales.x;
          // approximate positions by category index
          const idxFor = (v) => Math.max(0, Math.min(bins - 1, Math.floor((v - lo) / w)));
          const drawLine = (v, color, label) => {
            const i = idxFor(v);
            const px = xScale.getPixelForValue(i) + xScale.width / (2 * bins);
            ctx.save();
            ctx.strokeStyle = color;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(px, area.top);
            ctx.lineTo(px, area.bottom);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = color;
            ctx.font = "10px " + Chart.defaults.font.family;
            ctx.fillText(label, px + 3, area.top + 10);
            ctx.restore();
          };
          drawLine(mu, cssVar("--chart-3"), `μ ${fmtN(mu, 1)}`);
          drawLine(md, cssVar("--chart-2"), `med ${fmtN(md, 1)}`);
        },
      }],
    });
  }
  distSel.addEventListener("change", drawDist);
  binSel.addEventListener("change", drawDist);

  /* relationship explorer + heatmap */
  const xSel = el(`<select class="input" data-x>${CORR_FEATURES.map((f) => `<option value="${f.key}" ${f.key === "cr" ? "selected" : ""}>${f.name}</option>`).join("")}</select>`);
  const ySel = el(`<select class="input" data-y>${CORR_FEATURES.map((f) => `<option value="${f.key}" ${f.key === "egfr" ? "selected" : ""}>${f.name}</option>`).join("")}</select>`);
  const relStats = el(`<div class="row small muted tabnum"></div>`);
  const relCard = el(`<div class="card">
    <div class="card-head row-between">
      <h3 class="card-title">${icon("sigma")} Relationship explorer</h3>
      <div class="toolbar" data-rel-tools><label class="xsmall muted">x</label><label class="xsmall muted">y</label></div>
    </div>
    <div class="card-pad" style="padding-top:0;">
      <div class="chart-box chart-h-260"><canvas id="ch-scatter"></canvas></div>
      <div style="margin-top:0.4rem;" data-rel-stats></div>
    </div>
  </div>`);
  const tools = relCard.querySelector("[data-rel-tools]");
  tools.children[0].after(xSel);   // [x label, xSel, y label]
  tools.children[2].after(ySel);   // [x label, xSel, y label, ySel]
  relCard.querySelector("[data-rel-stats]").appendChild(relStats);

  function drawScatter() {
    const xk = xSel.value, yk = ySel.value;
    const xs = num(xk), ys = num(yk);
    const pts = xs.map((x, i) => ({ x, y: ys[i] })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    const r = pearson(xs, ys), rho = spearman(xs, ys);
    const c = chartColors();
    relStats.innerHTML = `<span>Pearson r = ${fmtN(r, 3)} (p ${fmtP(corrP(r, pts.length))})</span>
      <span>Spearman ρ = ${fmtN(rho, 3)} (p ${fmtP(corrP(rho, pts.length))})</span><span>n = ${pts.length}</span>`;
    makeChart("ch-scatter", {
      type: "scatter",
      data: {
        datasets: [{
          data: pts, pointRadius: 2.5, pointHoverRadius: 4,
          backgroundColor: cssVar("--chart-1"),
        }],
      },
      options: {
        maintainAspectRatio: false, animation: { duration: 300 },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (it) => ` ${fmtN(it.parsed.x, 2)}, ${fmtN(it.parsed.y, 2)}` } },
        },
        scales: {
          x: { title: { display: true, text: labelOf(xk) } },
          y: { title: { display: true, text: labelOf(yk) } },
        },
      },
    });
  }
  xSel.addEventListener("change", drawScatter);
  ySel.addEventListener("change", drawScatter);

  const corrCard = el(`<div class="card">
    <div class="card-head"><h3 class="card-title">Correlation matrix (Pearson, 12 features)</h3></div>
    <div class="card-pad" style="padding-top:0.2rem;" data-heat></div>
  </div>`);

  {
    const cols = CORR_FEATURES.map((f) => num(f.key));
    const matrix = cols.map((a) => cols.map((b) => pearson(a, b)));
    const heat = corrCard.querySelector("[data-heat]");
    heat.innerHTML = `<div class="heat-scroll"><table class="heat">
      <thead><tr><th></th>${CORR_FEATURES.map((f) => `<th title="${f.name}">${f.name.slice(0, 5)}</th>`).join("")}</tr></thead>
      <tbody>${matrix.map((row, i) => `
        <tr><th>${CORR_FEATURES[i].name}</th>${row.map((v, j) => {
          const v2 = Number.isFinite(v) ? v : 0;
          const cls = Math.abs(v2) < 0.55 ? (i === j ? "" : "dim-cell") : "";
          return `<td class="${cls}" style="background:${heatColor(v2)}" title="${CORR_FEATURES[i].name} vs ${CORR_FEATURES[j].name}: r = ${fmtN(v, 3)}">${i === j ? "1" : fmtN(v2, 2)}</td>`;
        }).join("")}</tr>`).join("")}
      </tbody></table></div>
      <div class="heat-legend"><span>−1</span><div class="scale"></div><span>+1</span></div>`;
  }

  /* Kaplan–Meier */
  const kmCard = el(`<div class="card">
    <div class="card-head"><h3 class="card-title">Kaplan–Meier — model-predicted time to kidney failure</h3>
      <p class="card-desc">Attention-NN predicted failure time; patients at the 300-month study horizon are right-censored.
        Groups split at the cohort median eGFR. Log-rank chi² reported.</p>
    </div>
    <div class="card-pad" style="padding-top:0;">
      <div class="chart-box chart-h-260"><canvas id="ch-km"></canvas></div>
      <div style="margin-top:0.4rem;" data-lr class="row small muted tabnum"></div>
    </div>
  </div>`);

  let kmCurves = null;
  {
    const predF = rows.map((r) => r.prediction?.attnFailure ?? 300);
    const events = predF.map((t) => t < 299.5);
    const medEgfr = median(egfrs);
    const lowIdx = egfrs.map((e) => e < medEgfr);
    const kmAll = kaplanMeier(predF, events);
    const kmLow = kaplanMeier(predF.filter((_, i) => lowIdx[i]), events.filter((_, i) => lowIdx[i]));
    const kmHigh = kaplanMeier(predF.filter((_, i) => !lowIdx[i]), events.filter((_, i) => !lowIdx[i]));
    const lr = logRank(
      { times: predF.filter((_, i) => lowIdx[i]), events: events.filter((_, i) => lowIdx[i]) },
      { times: predF.filter((_, i) => !lowIdx[i]), events: events.filter((_, i) => !lowIdx[i]) }
    );
    kmCard.querySelector("[data-lr]").innerHTML =
      `<span>Median eGFR split: ${fmtN(medEgfr, 1)}</span>
       <span>Log-rank χ² = ${fmtN(lr.chi2, 2)} (1 df), p ${fmtP(lr.p)}</span>
       <span>Median survival — all: ${kmAll.median ?? "> 300"} mo · low eGFR: ${kmLow.median ?? "> 300"} mo · high eGFR: ${kmHigh.median ?? "> 300"} mo</span>`;
    kmCurves = { kmAll, kmLow, kmHigh, medEgfr };
  }

  /* model performance */
  const perfCard = el(`<div class="card">
    <div class="card-head"><h3 class="card-title">Survival model performance (study evaluation)</h3></div>
    <div class="card-pad" style="padding-top:0.2rem;">
      <p class="xsmall muted" style="margin:0 0 0.4rem;">C-index by model &amp; outcome (higher = better)</p>
      <div class="chart-box chart-h-260"><canvas id="ch-cindex"></canvas></div>
      <p class="xsmall muted" style="margin:0.8rem 0 0.4rem;">Predicted time per model — median with IQR (months)</p>
      <div class="chart-box chart-h-260"><canvas id="ch-spread"></canvas></div>
      <p class="xsmall muted" style="margin:0.8rem 0 0.4rem;">Feature importance by model (ML models)</p>
      <div class="chart-box chart-h-300"><canvas id="ch-importance"></canvas></div>
    </div>
  </div>`);

  /* metrics + importance tables */
  const tablesCard = el(`<div class="card">
    <div class="card-head"><h3 class="card-title">${icon("gauge")} Study evaluation tables</h3></div>
    <div class="card-pad" style="padding-top:0.2rem;">
      <div class="table-scroll" style="max-height:24rem;">
        <table class="plain">
          <thead><tr><th>Model</th><th>Outcome</th><th>C-index</th><th>1yr AUC</th><th>2yr AUC</th><th>3yr AUC</th><th>5yr AUC</th><th>IBS</th><th>MAE (months)</th></tr></thead>
          <tbody>${metricsJson.map((m) => `
            <tr><td class="strong">${esc(m.Model)}</td><td>${esc(m.Outcome)}</td>
              <td class="num ${m["C-index"] >= 0.9 ? "sig" : ""}">${m["C-index"].toFixed(3)}</td>
              <td class="num">${m["1yr AUC"].toFixed(3)}</td><td class="num">${m["2yr AUC"].toFixed(3)}</td>
              <td class="num">${m["3yr AUC"].toFixed(3)}</td><td class="num">${m["5yr AUC"].toFixed(3)}</td>
              <td class="num">${m["IBS"].toFixed(3)}</td><td class="num">${fmtN(m["MAE (months)"], 1)}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
      <p class="xsmall muted" style="margin:0.9rem 0 0.3rem;">Cox proportional hazards — hazard ratios (95% CI) from Feature Importance.xlsx</p>
      <div class="table-scroll" style="max-height:24rem;">
        <table class="plain">
          <thead><tr><th>Feature</th><th>Cox HR</th><th>95% CI</th><th>p</th><th>RSF</th><th>GB</th><th>NN</th><th>Attn NN</th></tr></thead>
          <tbody>${importanceJson.map((f) => `
            <tr><td class="strong">${esc(f.Feature)}</td>
              <td class="num">${f["Cox HR"].toFixed(3)}</td>
              <td class="num muted">[${f["Cox 95% CI Lower"].toFixed(2)}, ${f["Cox 95% CI Upper"].toFixed(2)}]</td>
              <td class="num">${fmtP(f["Cox p-value"])}</td>
              <td class="num">${f["RSF Importance"].toFixed(2)}</td>
              <td class="num">${f["GB Importance"].toFixed(2)}</td>
              <td class="num">${f["NN Importance"].toFixed(2)}</td>
              <td class="num">${f["Attn NN Importance"].toFixed(2)}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  </div>`);

  root.append(head, summary, testsCard, stageCard, distCard, relCard, corrCard, kmCard, perfCard, tablesCard);

  /* ---------- charts that need the DOM ready ---------- */

  drawDist();
  drawScatter();

  {
    const { kmAll, kmLow, kmHigh, medEgfr } = kmCurves;
    const kmSeries = (curve, label, color) => {
      const pts = [{ x: 0, y: 1 }, ...curve.steps.map((s) => ({ x: s.time, y: s.survival }))];
      return { label, data: pts, borderColor: color, borderWidth: 2, stepped: true, fill: false, pointRadius: 0, tension: 0 };
    };
    const c = chartColors();
    makeChart("ch-km", {
      type: "line",
      data: {
        datasets: [
          kmSeries(kmAll, "All patients", c.c1),
          kmSeries(kmLow, `Low eGFR (< ${fmtN(medEgfr, 1)})`, c.c3),
          kmSeries(kmHigh, `High eGFR (≥ ${fmtN(medEgfr, 1)})`, c.c4),
        ],
      },
      options: {
        maintainAspectRatio: false, animation: { duration: 300 },
        interaction: { mode: "nearest", intersect: false },
        scales: {
          x: { type: "linear", title: { display: true, text: "Months" } },
          y: { min: 0, max: 1.02, title: { display: true, text: "Event-free survival" }, ticks: { callback: (v) => `${Math.round(v * 100)}%` } },
        },
        plugins: { tooltip: { callbacks: { label: (it) => ` ${it.dataset.label}: t=${fmtN(it.parsed.x, 0)} mo, S=${fmtN(it.parsed.y, 3)}` } } },
      },
    });
  }

  {
    const c = chartColors();
    const counts = STAGE_ORDER.map((s) => rows.filter((r) => ckStage(r.egfr).stage === s).length);
    makeChart("ch-stage", {
      type: "bar",
      data: {
        labels: STAGE_ORDER,
        datasets: [{
          label: "Patients",
          data: counts,
          backgroundColor: STAGE_ORDER.map((s) => cssVar(`--stage-${s}`)),
          borderRadius: 4,
        }],
      },
      options: {
        maintainAspectRatio: false, animation: { duration: 300 },
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, title: { display: true, text: "Patients" } } },
      },
    });
  }

  {
    const c = chartColors();
    const outcomes = ["Kidney Failure", "Transplant"];
    makeChart("ch-cindex", {
      type: "bar",
      data: {
        labels: MODELS.map((m) => m.short),
        datasets: outcomes.map((o, i) => ({
          label: o,
          data: MODELS.map((m) => metricsJson.find((x) => x.Model === m.cKey && x.Outcome === o)?.["C-index"] ?? 0),
          backgroundColor: [c.c1, c.c2][i], borderRadius: 4,
        })),
      },
      options: {
        maintainAspectRatio: false, animation: { duration: 300 },
        scales: { y: { min: 0.7, max: 1, title: { display: true, text: "C-index" } } },
      },
    });

    const rows2 = store.allRows();
    const spread = MODELS.map((m) => {
      const f = rows2.map((r) => r.prediction?.[`${m.key}Failure`] ?? 0);
      const t = rows2.map((r) => r.prediction?.[`${m.key}Transplant`] ?? 0);
      return {
        model: m.short,
        fMed: median(f), fQ1: quantile(f, 0.25), fQ3: quantile(f, 0.75),
        tMed: median(t), tQ1: quantile(t, 0.25), tQ3: quantile(t, 0.75),
      };
    });
    makeChart("ch-spread", {
      type: "bar",
      data: {
        labels: spread.map((s) => s.model),
        datasets: [
          {
            label: "Failure (Q1–Q3)",
            data: spread.map((s) => [s.fQ1, s.fQ3]),
            backgroundColor: c.c3, borderRadius: 4, borderSkipped: false,
          },
          {
            label: "Transplant (Q1–Q3)",
            data: spread.map((s) => [s.tQ1, s.tQ3]),
            backgroundColor: c.c2, borderRadius: 4, borderSkipped: false,
          },
          {
            label: "Median (failure)",
            data: spread.map((s) => s.fMed),
            type: "scatter",
            pointRadius: 4, pointStyle: "line", pointBorderColor: c.c1, borderWidth: 2,
          },
          {
            label: "Median (transplant)",
            data: spread.map((s) => s.tMed),
            type: "scatter",
            pointRadius: 4, pointStyle: "line", pointBorderColor: c.c4, borderWidth: 2,
          },
        ],
      },
      options: {
        maintainAspectRatio: false, animation: { duration: 300 },
        scales: { y: { beginAtZero: true, title: { display: true, text: "Months" } } },
      },
    });

    makeChart("ch-importance", {
      type: "bar",
      data: {
        labels: importanceJson.map((f) => f.Feature),
        datasets: [
          { label: "RSF", data: importanceJson.map((f) => f["RSF Importance"]), backgroundColor: c.c1 },
          { label: "Gradient Boosted", data: importanceJson.map((f) => f["GB Importance"]), backgroundColor: c.c2 },
          { label: "Neural Network", data: importanceJson.map((f) => f["NN Importance"]), backgroundColor: c.c4 },
          { label: "Attention NN", data: importanceJson.map((f) => f["Attn NN Importance"]), backgroundColor: c.c5 },
        ].map((d) => ({ ...d, borderRadius: 3 })),
      },
      options: {
        indexAxis: "y", maintainAspectRatio: false, animation: { duration: 300 },
        scales: { x: { beginAtZero: true, title: { display: true, text: "Importance" } } },
      },
    });
  }

  head.querySelector("[data-refresh]").addEventListener("click", () => {
    if (ctx.rerender) ctx.rerender();
    else drawDist(), drawScatter();
  });
}
