/**
 * Page 2 · Data Explorer — all patients, search by any feature, inspect
 * records, download the filtered subset as CSV or Excel.
 */

import { store, applyFilters } from "../store.js";
import { PATIENT_COLUMNS, NUMERIC_COLUMNS, ckStage, STAGE_ORDER, exportHeader, exportRow } from "../columns.js";
import { el, icon, esc, toast, attachPopover, openDialog } from "../ui.js";
import { downloadCsv, downloadXlsx } from "../xlsx.js";

const STAGE_VAR = {
  G1: "--stage-g1", G2: "--stage-g2", G3a: "--stage-g3a",
  G3b: "--stage-g3b", G4: "--stage-g4", G5: "--stage-g5",
};

const DEFAULT_VISIBLE = [
  "patientId", "sex", "age", "hb", "bun", "cr", "ca", "alb", "k", "microalb", "pro", "egfr",
];
const EXTRA_TOGGLEABLE = ["wbc", "plt", "fbs", "ppg2h", "t", "h", "lymphocyte", "tsh", "hba1c", "na", "ast", "alt"];

const MODEL_COL_PREFIX = {
  coxFailure: "Cox F", coxTransplant: "Cox T",
  rsfFailure: "RSF F", rsfTransplant: "RSF T",
  gbFailure: "GB F", gbTransplant: "GB T",
  nnFailure: "NN F", nnTransplant: "NN T",
  attnFailure: "Attn F", attnTransplant: "Attn T",
};

export function renderExplore(root) {
  const state = {
    q: "", sex: "any", stage: "any", source: "any",
    ranges: {}, sortBy: "patientId", sortDir: "asc",
    page: 1, pageSize: 25,
    visibleCols: [...DEFAULT_VISIBLE], showPredCols: true,
  };

  root.innerHTML = "";

  /* ---------- head ---------- */
  const head = el(`<div class="page-head">
    <div>
      <h1 class="page-title">Page 2 · Data Explorer</h1>
      <p class="page-desc">All patients of the Patient Data file — search by any feature, then download the filtered subset.</p>
    </div>
    <div class="head-actions">
      <button class="btn btn-outline btn-sm" data-filters>${icon("sliders")} Feature filters<span data-fcount class="badge badge-soft" style="display:none;"></span></button>
      <div class="pop-wrap">
        <button class="btn btn-primary btn-sm" data-download>${icon("download")} Download</button>
      </div>
    </div>
  </div>`);

  head.querySelector("[data-download]").addEventListener("click", (e) => {
    attachPopover(e.currentTarget, () => {
      const pop = el(`<div>
        <div class="pop-label">Export current subset (<span data-dl-count></span> rows)</div>
        <button class="pop-item" data-csv>${icon("file")} CSV file</button>
        <button class="pop-item" data-xlsx>${icon("file")} Excel workbook (.xlsx)</button>
      </div>`);
      pop.querySelector("[data-dl-count]").textContent = filtered().length;
      pop.querySelector("[data-csv]").addEventListener("click", () => { pop.remove(); doDownload("csv"); });
      pop.querySelector("[data-xlsx]").addEventListener("click", () => { pop.remove(); doDownload("xlsx"); });
      return pop;
    });
  });

  /* ---------- search bar ---------- */
  const searchCard = el(`<div class="card"><div class="card-pad toolbar">
    <div class="search-wrap">
      ${icon("search")}
      <input class="input" data-q placeholder="Search patient ID (e.g. CKD-023) or type Female / Male…" aria-label="Search patients" />
    </div>
    <select class="input" data-sex aria-label="Sex filter">
      <option value="any">Any sex</option><option>Female</option><option>Male</option>
    </select>
    <select class="input" data-stage aria-label="CKD stage filter">
      <option value="any">Any stage</option>${STAGE_ORDER.map((s) => `<option>${s}</option>`).join("")}
    </select>
    <select class="input" data-source aria-label="Source filter">
      <option value="any">Any source</option><option value="study">Study cohort</option><option value="portal">Portal entries</option>
    </select>
    <div class="row" style="gap:0.25rem;" data-page-size>
      ${[10, 25, 50, 100].map((n) => `<button class="btn btn-ghost btn-sm" data-n="${n}">${n}</button>`).join("")}
    </div>
    <div class="pop-wrap">
      <button class="btn btn-outline btn-sm" data-cols>${icon("eye")} Columns</button>
    </div>
  </div></div>`);

  /* ---------- range filters ---------- */
  const filterCard = el(`<div class="card" hidden><div class="card-pad">
    <div class="row-between" style="margin-bottom:0.6rem;">
      <p class="small strong" style="margin:0;">Filter by any feature (min / max)</p>
      <button class="btn btn-ghost btn-sm" data-clear-ranges>${icon("filterX")} Clear ranges</button>
    </div>
    <div class="toolbar" style="gap:0.5rem 1rem;">
      ${NUMERIC_COLUMNS.map((c) => `
        <div class="row" style="gap:0.3rem;flex:1 1 13rem;">
          <span class="xsmall muted" style="width:5.5rem;" title="${esc(c.label)} (${esc(c.unit)})">${c.label}</span>
          <input class="input" style="height:1.9rem;padding:0 0.4rem;font-size:0.72rem;" placeholder="min" data-rmin="${c.key}" />
          <span class="muted xsmall">–</span>
          <input class="input" style="height:1.9rem;padding:0 0.4rem;font-size:0.72rem;" placeholder="max" data-rmax="${c.key}" />
        </div>`).join("")}
    </div>
  </div></div>`);

  /* ---------- table ---------- */
  const tableCard = el(`<div class="card"><div class="table-scroll" data-scroll>
    <table class="data"><thead data-thead></thead><tbody data-tbody></tbody></table>
  </div></div>`);

  /* ---------- pagination ---------- */
  const pager = el(`<div class="row-between">
    <p class="xsmall muted" data-meta></p>
    <div class="row">
      <button class="btn btn-outline btn-sm" data-prev>${icon("chevronLeft")} Prev</button>
      <button class="btn btn-outline btn-sm" data-next>Next ${icon("chevronRight")}</button>
    </div>
  </div>`);

  root.append(head, searchCard, filterCard, tableCard, pager);

  /* ---------- rendering ---------- */

  function filtered() {
    return applyFilters(store.allRows(), {
      q: state.q, sex: state.sex, stage: state.stage, source: state.source,
      ranges: state.ranges, sortBy: state.sortBy, sortDir: state.sortDir,
    });
  }

  function shownCols() {
    const cols = PATIENT_COLUMNS.filter((c) => state.visibleCols.includes(c.key));
    const predCols = state.showPredCols
      ? Object.keys(MODEL_COL_PREFIX).map((k) => ({ key: k, label: MODEL_COL_PREFIX[k] }))
      : [];
    return [...cols, ...predCols];
  }

  function sortKeyFor(colKey) {
    if (colKey === "attnFailure") return "predFailure";
    if (colKey === "attnTransplant") return "predTransplant";
    return colKey;
  }

  function renderTable() {
    const rows = filtered();
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > pages) state.page = pages;
    const start = (state.page - 1) * state.pageSize;
    const slice = rows.slice(start, start + state.pageSize);

    // header
    const thead = tableCard.querySelector("[data-thead]");
    const cols = shownCols();
    thead.innerHTML = `<tr>
      ${cols.map((c) => {
        const k = sortKeyFor(c.key);
        const arrow = state.sortBy === k ? icon(state.sortDir === "asc" ? "arrowUp" : "arrowDown") : "";
        return `<th><button class="th-sort" data-sort="${k}">${c.label}${arrow}</button></th>`;
      }).join("")}
      <th>Stage</th><th>Src</th><th></th>
    </tr>`;

    // body
    const tbody = tableCard.querySelector("[data-tbody]");
    if (slice.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${cols.length + 3}"><div class="empty-note">No patients match the current filters.</div></td></tr>`;
    } else {
      tbody.innerHTML = slice.map((r) => {
        const stage = ckStage(r.egfr).stage;
        return `<tr class="clickable" data-id="${esc(r.patientId)}">
          ${cols.map((c) => {
            if (MODEL_COL_PREFIX[c.key]) {
              const v = r.prediction ? r.prediction[c.key] : null;
              const isAttn = c.key.startsWith("attn");
              return `<td class="num ${isAttn ? "hi" : "dim"}">${v ?? "—"}</td>`;
            }
            const v = r[c.key];
            if (c.key === "patientId") return `<td class="strong">${esc(v)}</td>`;
            if (c.key === "sex") return `<td>${v === "Male" ? "♂ M" : "♀ F"}</td>`;
            if (typeof v === "number") return `<td class="num">${Number.isInteger(v) ? v : v.toFixed(c.decimals)}</td>`;
            return `<td>${esc(v ?? "—")}</td>`;
          }).join("")}
          <td><span class="stage-chip stage-${stage}">${stage}</span></td>
          <td>${r.source === "portal" ? `<span class="badge badge-solid" style="padding:0 0.4rem;font-size:0.58rem;">NEW</span>` : `<span class="badge" style="padding:0 0.4rem;font-size:0.58rem;">study</span>`}</td>
          <td class="muted">${icon("eye")}</td>
        </tr>`;
      }).join("");
    }

    pager.querySelector("[data-meta]").textContent =
      `${total} patient${total === 1 ? "" : "s"} match · page ${state.page} of ${pages}`;
    pager.querySelector("[data-prev]").disabled = state.page <= 1;
    pager.querySelector("[data-next]").disabled = state.page >= pages;

    // active page-size button
    tableCard.closest(".page-root");
    searchCard.querySelectorAll("[data-n]").forEach((b) => {
      const active = Number(b.dataset.n) === state.pageSize;
      b.style.background = active ? "var(--secondary)" : "";
      b.style.color = active ? "var(--secondary-foreground)" : "";
    });

    // range filter count badge
    const n = Object.values(state.ranges).filter((r) => (r.min ?? "") !== "" || (r.max ?? "") !== "").length;
    const badge = head.querySelector("[data-fcount]");
    badge.style.display = n ? "inline-flex" : "none";
    badge.textContent = n;
  }

  function doDownload(fmt) {
    const rows = filtered();
    const header = exportHeader();
    const data = rows.map(exportRow);
    const stamp = new Date().toISOString().slice(0, 10);
    if (fmt === "csv") downloadCsv(header, data, `ckd-cohort-${stamp}.csv`);
    else downloadXlsx(header, data, `ckd-cohort-${stamp}.xlsx`);
    toast(`Preparing ${fmt.toUpperCase()} download`, `${rows.length} matching patients will be exported.`);
  }

  function openDetail(patientId) {
    const r = store.allRows().find((x) => x.patientId === patientId);
    if (!r) return;
    const stage = ckStage(r.egfr).stage;
    const pred = r.prediction;
    const groups = ["Age / Sex / eGFR", "LogMicroAlb / BUN / Ca", "P / Alb / Cr", "Hb / K / Pro"];
    const heads1 = Array.isArray(r.attnHead1) ? r.attnHead1 : null;
    const heads2 = Array.isArray(r.attnHead2) ? r.attnHead2 : null;

    const bodyHtml = `
      <div class="kv-grid">
        ${PATIENT_COLUMNS.filter((c) => c.kind !== "id").map((c) => `
          <div class="kv"><span class="k">${c.label}${c.unit ? ` <span class="xsmall">(${c.unit})</span>` : ""}</span>
          <span class="v">${typeof r[c.key] === "number" ? r[c.key].toFixed(c.decimals) : esc(r[c.key])}</span></div>`).join("")}
      </div>
      ${pred ? `
        <p class="xsmall muted strong" style="text-transform:uppercase;letter-spacing:0.05em;margin:1rem 0 0.4rem;">Model predictions (months)</p>
        <div class="model-grid" style="grid-template-columns:repeat(5,1fr);">
          ${["cox", "rsf", "gb", "nn", "attn"].map((m) => `
            <div class="model-card${m === "attn" ? " primary-model" : ""}">
              <div class="m-name">${m === "attn" ? "Attn NN" : m.toUpperCase()}</div>
              <div class="m-val" style="font-size:0.9rem;">${pred[`${m}Failure`]}</div>
              <div class="m-cap">failure</div>
              <div class="m-val" style="font-size:0.9rem;">${pred[`${m}Transplant`]}</div>
              <div class="m-cap">transplant</div>
            </div>`).join("")}
        </div>` : ""}
      ${heads1 && heads2 ? `
        <p class="xsmall muted strong" style="text-transform:uppercase;letter-spacing:0.05em;margin:1rem 0 0.4rem;">Study attention weights (multi-head self-attention)</p>
        <div class="grid-2" style="gap:1rem;">
          ${[["Head 1", heads1], ["Head 2", heads2]].map(([label, ws]) => `
            <div>
              <p class="small strong" style="margin:0 0 0.3rem;">${label}</p>
              ${ws.map((w, i) => wbarRow(groups[i], w)).join("")}
            </div>`).join("")}
        </div>` : ""}
      ${r.source === "portal" ? `
        <hr class="sep" style="margin-top:1rem;" />
        <div class="right"><button class="btn btn-danger btn-sm" data-del>${icon("trash")} Delete portal entry</button></div>` : ""}
    `;

    const dlg = openDialog(
      `${esc(r.patientId)} <span class="badge">${esc(r.sex)}</span>
       <span class="stage-chip stage-${stage}">CKD ${stage}</span>
       ${r.source === "portal" ? `<span class="badge badge-solid">portal entry</span>` : ""}`,
      `Full record from the Patient Data file${r.attnRisk != null ? ` · attention risk score ${r.attnRisk}` : ""}`,
      bodyHtml
    );
    const delBtn = dlg.body.querySelector("[data-del]");
    if (delBtn) {
      delBtn.addEventListener("click", () => {
        store.deleteEntry(r.patientId);
        toast(`${r.patientId} deleted`);
        dlg.close();
      });
    }
  }

  function wbarRow(label, value) {
    const pct = Math.max(0, Math.min(100, value * 100));
    return `<div class="wbar-row">
      <span class="wbar-label" title="${esc(label)}">${esc(label)}</span>
      <div class="wbar-track"><div class="wbar-fill" style="width:${pct.toFixed(1)}%"></div></div>
      <span class="wbar-val tabnum">${value.toFixed(3)}</span>
    </div>`;
  }

  /* ---------- events ---------- */

  searchCard.querySelector("[data-q]").addEventListener("input", (e) => {
    state.q = e.target.value.trim();
    state.page = 1;
    renderTable();
  });
  searchCard.querySelector("[data-sex]").addEventListener("change", (e) => { state.sex = e.target.value; state.page = 1; renderTable(); });
  searchCard.querySelector("[data-stage]").addEventListener("change", (e) => { state.stage = e.target.value; state.page = 1; renderTable(); });
  searchCard.querySelector("[data-source]").addEventListener("change", (e) => { state.source = e.target.value; state.page = 1; renderTable(); });
  searchCard.querySelectorAll("[data-n]").forEach((b) =>
    b.addEventListener("click", () => { state.pageSize = Number(b.dataset.n); state.page = 1; renderTable(); })
  );

  head.querySelector("[data-filters]").addEventListener("click", () => {
    filterCard.hidden = !filterCard.hidden;
  });
  filterCard.querySelector("[data-clear-ranges]").addEventListener("click", () => {
    state.ranges = {};
    filterCard.querySelectorAll("[data-rmin],[data-rmax]").forEach((i) => (i.value = ""));
    state.page = 1;
    renderTable();
  });
  filterCard.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.rmin !== undefined) {
      state.ranges[t.dataset.rmin] = { ...(state.ranges[t.dataset.rmin] || {}), min: t.value };
    } else if (t.dataset.rmax !== undefined) {
      state.ranges[t.dataset.rmax] = { ...(state.ranges[t.dataset.rmax] || {}), max: t.value };
    } else return;
    state.page = 1;
    renderTable();
  });

  searchCard.querySelector("[data-cols]").addEventListener("click", (e) => {
    attachPopover(e.currentTarget, () => {
      const pop = el(`<div>
        <div class="pop-label">Demographics &amp; labs</div>
        ${EXTRA_TOGGLEABLE.map((k) => {
          const col = PATIENT_COLUMNS.find((c) => c.key === k);
          return `<label class="pop-item"><input type="checkbox" class="checkbox" data-col="${k}" ${state.visibleCols.includes(k) ? "checked" : ""} />
            ${col.label} <span class="muted">(${col.unit})</span></label>`;
        }).join("")}
        <div class="pop-sep"></div>
        <label class="pop-item"><input type="checkbox" class="checkbox" data-col="__pred" ${state.showPredCols ? "checked" : ""} />
          Model prediction columns <span class="muted">(F = failure, T = transplant, months)</span></label>
      </div>`);
      pop.querySelectorAll("[data-col]").forEach((cb) =>
        cb.addEventListener("change", () => {
          const k = cb.dataset.col;
          if (k === "__pred") state.showPredCols = cb.checked;
          else if (cb.checked) state.visibleCols.push(k);
          else state.visibleCols = state.visibleCols.filter((x) => x !== k);
          renderTable();
        })
      );
      return pop;
    });
  });

  tableCard.querySelector("[data-thead]").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-sort]");
    if (!btn) return;
    const k = btn.dataset.sort;
    if (state.sortBy === k) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
    else { state.sortBy = k; state.sortDir = "asc"; }
    renderTable();
  });

  tableCard.querySelector("[data-tbody]").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) openDetail(tr.dataset.id);
  });

  pager.querySelector("[data-prev]").addEventListener("click", () => { state.page--; renderTable(); });
  pager.querySelector("[data-next]").addEventListener("click", () => { state.page++; renderTable(); });

  renderTable();
}
