/**
 * Page 1 · Register Patient — every column of Patient Data.xlsx, grouped by
 * panel. Saving stores the record locally (GitHub Pages has no server), scores
 * all five survival models and refreshes the portal. Includes JSON
 * export/import so entries can be moved between browsers or back into the
 * study data pipeline.
 */

import { store } from "../store.js";
import { PATIENT_COLUMNS, NUMERIC_COLUMNS, SECTIONS, RANGES, DEFAULTS } from "../columns.js";
import { el, icon, esc, toast, openDialog } from "../ui.js";
import { triggerDownload } from "../xlsx.js";

function blankForm() {
  const f = {};
  for (const c of PATIENT_COLUMNS) if (c.kind !== "id") f[c.key] = String(DEFAULTS[c.key] ?? "");
  return f;
}

export function renderRegister(root) {
  const state = { form: blankForm(), errors: {}, result: null, nextId: store.nextId() };

  root.innerHTML = "";

  /* ---------- head ---------- */
  const head = el(`<div class="page-head">
    <div>
      <h1 class="page-title">Page 1 · Register Patient</h1>
      <p class="page-desc">Every column of <b>Patient Data.xlsx</b> is captured. On save the record is written to
        the portal's local Patient Data store and all five survival models are scored instantly.
        Entries persist in this browser and can be exported below.</p>
    </div>
    <div class="head-actions">
      <span class="badge badge-mono">Next ID: ${state.nextId}</span>
      <button class="btn btn-outline btn-sm" data-fill>${icon("wand")} Fill example</button>
    </div>
  </div>`);

  /* ---------- result card (hidden until save) ---------- */
  const resultCard = el(`<div class="card card-accent" hidden></div>`);

  function showResult(patient, engine) {
    const models = [
      ["Cox PH", engine.predictions.coxFailure, engine.predictions.coxTransplant],
      ["RSF", engine.predictions.rsfFailure, engine.predictions.rsfTransplant],
      ["Gradient Boost", engine.predictions.gbFailure, engine.predictions.gbTransplant],
      ["Neural Net", engine.predictions.nnFailure, engine.predictions.nnTransplant],
      ["Attention NN", engine.predictions.attnFailure, engine.predictions.attnTransplant],
    ];
    resultCard.innerHTML = `
      <div class="card-head">
        <h3 class="card-title" style="color:var(--primary);">${icon("check")} Saved as ${esc(patient.patientId)}</h3>
        <p class="card-desc">Attention risk score ${engine.attention.riskScore.toFixed(3)} (${engine.attention.riskLabel}).
          Predicted times from all five models:</p>
      </div>
      <div class="card-pad" style="padding-top:0.4rem;">
        <div class="model-grid">
          ${models.map(([label, f, t]) => `
            <div class="model-card">
              <div class="m-name muted">${label}</div>
              <div class="m-val">${f}<span class="m-cap"> mo fail</span></div>
              <div class="m-val" style="font-size:0.9rem;">${t}<span class="m-cap"> mo transp.</span></div>
            </div>`).join("")}
        </div>
        <div class="row" style="margin-top:0.8rem;">
          <a class="btn btn-outline btn-sm" href="#/explore">${icon("table")} View in Data Explorer</a>
          <button class="btn btn-ghost btn-sm" data-another>${icon("userPlus")} Register another</button>
        </div>
      </div>`;
    resultCard.hidden = false;
    resultCard.querySelector("[data-another]").addEventListener("click", () => {
      state.result = null;
      resultCard.hidden = true;
    });
  }

  /* ---------- form ---------- */
  const formEl = el(`<div class="grid-2"></div>`);
  const inputs = {};

  for (const section of SECTIONS) {
    const cols = PATIENT_COLUMNS.filter((c) => c.kind !== "id" && c.section === section);
    const card = el(`<div class="card">
      <div class="card-head" style="padding-bottom:0.3rem;"><h3 class="card-title" style="font-size:0.85rem;">${section}</h3></div>
      <div class="card-pad" style="padding-top:0.2rem;"><div class="form-grid"></div></div>
    </div>`);
    const grid = card.querySelector(".form-grid");

    for (const c of cols) {
      const field = el(`<div class="field${c.key === "sex" ? " span-2" : ""}">
        <label class="lbl" for="f-${c.key}">
          ${c.label}${c.unit ? `<span class="unit">(${c.unit})</span>` : ""}
          ${c.modelFeature ? `<span class="model-tag">model input</span>` : ""}
        </label>
        ${c.kind === "select"
          ? `<select id="f-${c.key}" class="input" aria-label="${c.label}">
               ${c.options.map((o) => `<option value="${o}">${o}</option>`).join("")}
             </select>`
          : `<input id="f-${c.key}" class="input" type="number" inputmode="decimal"
               step="${c.step ?? "any"}" min="${c.min ?? ""}" max="${c.max ?? ""}"
               placeholder="${c.min}–${c.max}" aria-label="${c.label}" />`}
        <p class="field-hint" data-hint></p>
      </div>`);
      const input = field.querySelector("input, select");
      inputs[c.key] = { input, hint: field.querySelector("[data-hint]"), def: c };
      input.addEventListener("input", () => {
        state.form[c.key] = input.value;
        input.classList.remove("invalid");
        state.errors[c.key] && (delete state.errors[c.key]);
      });
      grid.appendChild(field);
    }
    formEl.appendChild(card);
  }

  function syncInputs() {
    for (const [key, { input }] of Object.entries(inputs)) {
      input.value = state.form[key] ?? "";
      input.classList.remove("invalid");
      const hintEl = inputs[key].hint;
      if (state.errors[key]) {
        input.classList.add("invalid");
        hintEl.textContent = state.errors[key];
        hintEl.className = "field-error";
      } else {
        const h = inputs[key].def.hint;
        hintEl.textContent = h || "";
        hintEl.className = "field-hint";
      }
    }
  }

  /* ---------- actions ---------- */
  const actions = el(`<div>
    <hr class="sep" />
    <div class="row-between">
      <p class="xsmall muted">Validation follows the cohort range of each feature. Study rows CKD-0001–0500 remain read-only.</p>
      <div class="row">
        <button class="btn btn-ghost" data-reset>${icon("rotate")} Reset</button>
        <button class="btn btn-primary" data-save>${icon("userPlus")} Save patient &amp; score models</button>
      </div>
    </div>
  </div>`);

  /* ---------- data management ---------- */
  const dataCard = el(`<div class="card">
    <div class="card-head"><h3 class="card-title">${icon("database")} Patient Data store (browser-local)</h3>
      <p class="card-desc">GitHub Pages serves static files only, so portal entries are stored in this browser's
        localStorage and merged with the 500 study rows across every page. Export regularly to keep a copy.</p>
    </div>
    <div class="card-pad row" style="padding-top:0.3rem;">
      <button class="btn btn-outline btn-sm" data-export-json>${icon("download")} Export portal entries (JSON)</button>
      <button class="btn btn-outline btn-sm" data-export-full>${icon("download")} Download full dataset (JSON)</button>
      <button class="btn btn-outline btn-sm" data-import>${icon("upload")} Import entries (JSON)</button>
      <button class="btn btn-ghost btn-sm" data-clear>${icon("trash")} Clear portal entries</button>
      <span class="badge badge-soft" data-entry-count></span>
    </div>
  </div>`);

  function refreshCount() {
    dataCard.querySelector("[data-entry-count]").textContent =
      `${store.entries.length} portal entr${store.entries.length === 1 ? "y" : "ies"} · ${store.studyCount} study rows`;
  }

  dataCard.querySelector("[data-export-json]").addEventListener("click", () => {
    const stamp = new Date().toISOString().slice(0, 10);
    triggerDownload(new Blob([store.exportAllJson()], { type: "application/json" }), `ckd-portal-entries-${stamp}.json`);
    toast("Export ready", "Portal entries saved as JSON.");
  });

  dataCard.querySelector("[data-export-full]").addEventListener("click", () => {
    const stamp = new Date().toISOString().slice(0, 10);
    triggerDownload(new Blob([JSON.stringify({ rows: store.allRows() }, null, 1)], { type: "application/json" }), `ckd-patient-data-${stamp}.json`);
    toast("Export ready", `Full merged dataset (${store.allRows().length} rows) saved as JSON.`);
  });

  dataCard.querySelector("[data-import]").addEventListener("click", () => {
    const file = document.createElement("input");
    file.type = "file";
    file.accept = "application/json,.json";
    file.addEventListener("change", async () => {
      const f = file.files && file.files[0];
      if (!f) return;
      try {
        const added = store.importEntries(await f.text());
        toast("Import complete", `${added} new portal entr${added === 1 ? "y" : "ies"} added.`);
      } catch (e) {
        toast("Import failed", String(e.message || e), true);
      }
    });
    file.click();
  });

  dataCard.querySelector("[data-clear]").addEventListener("click", () => {
    openDialog(
      "Clear portal entries?",
      "The 500 study rows stay untouched.",
      `<div class="right" style="margin-top:0.5rem;">
         <button class="btn btn-ghost" data-cancel>Cancel</button>
         <button class="btn btn-danger" data-ok>${icon("trash")} Delete all portal entries</button>
       </div>`
    );
    const dlg = document.querySelector(".dialog");
    dlg.querySelector("[data-cancel]").addEventListener("click", () => dlg.closest(".dialog-backdrop").querySelector("[data-close]").click());
    dlg.querySelector("[data-ok]").addEventListener("click", () => {
      store.clearEntries();
      toast("Cleared", "All portal entries were removed from this browser.");
      dlg.closest(".dialog-backdrop").querySelector("[data-close]").click();
    });
  });

  /* ---------- behaviour ---------- */
  head.querySelector("[data-fill]").addEventListener("click", () => {
    const next = { sex: Math.random() > 0.5 ? "Male" : "Female" };
    for (const c of NUMERIC_COLUMNS) {
      const [lo, hi] = RANGES[c.key] ?? [c.min ?? 0, c.max ?? 100];
      const v = lo + Math.random() * (hi - lo);
      next[c.key] = v.toFixed(c.step && c.step < 1 ? c.decimals : 0);
    }
    state.form = next;
    state.errors = {};
    syncInputs();
    toast("Example values filled", "Typical cohort ranges — edit anything before saving.");
  });

  actions.querySelector("[data-reset]").addEventListener("click", () => {
    state.form = blankForm();
    state.errors = {};
    state.result = null;
    resultCard.hidden = true;
    syncInputs();
  });

  actions.querySelector("[data-save]").addEventListener("click", async () => {
    const btn = actions.querySelector("[data-save]");
    btn.disabled = true;
    const res = await store.addPatient(state.form);
    btn.disabled = false;
    if (!res.ok) {
      state.errors = res.errors;
      syncInputs();
      toast("Please fix the highlighted fields", "", true);
      return;
    }
    state.result = res;
    state.nextId = store.nextId();
    head.querySelector(".badge-mono").textContent = `Next ID: ${state.nextId}`;
    showResult(res.patient, res.engine);
    toast(`Patient ${res.patient.patientId} saved`, "All five models were scored and the analytics were refreshed.");
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  syncInputs();
  refreshCount();
  root.append(head, resultCard, formEl, actions, dataCard);
}
