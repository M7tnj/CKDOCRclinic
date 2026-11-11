/**
 * Client-side data store for the static GitHub Pages build.
 *
 * The Next.js app stores patients in SQLite via API routes; on GitHub Pages we
 * have no server, so the 500 study rows come from data/cohort.json and every
 * patient registered through Page 1 is appended to this browser's localStorage.
 * The merged dataset (study + portal entries) feeds the explorer, the
 * analytics and the prediction engine, and can be exported to JSON / CSV /
 * Excel so entries can be carried to another browser or back into the study
 * Patient Data file.
 */

import { NUMERIC_COLUMNS } from "./columns.js";
import { ensureReady, predictAll, rowToPool } from "./engine.js";

const LS_ENTRIES = "ckd-portal-entries-v1";

let cohortRows = [];
let entries = [];
let version = 0;
const listeners = new Set();

/* ---------- localStorage ---------- */

function loadEntries() {
  try {
    const raw = localStorage.getItem(LS_ENTRIES);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function persistEntries() {
  try {
    localStorage.setItem(LS_ENTRIES, JSON.stringify(entries));
  } catch (e) {
    console.error("Could not persist portal entries", e);
  }
}

function notify() {
  version++;
  for (const fn of listeners) {
    try { fn(); } catch { /* noop */ }
  }
}

/* ---------- boot ---------- */

async function boot() {
  const res = await fetch("data/cohort.json");
  if (!res.ok) throw new Error(`cohort.json failed: ${res.status}`);
  const json = await res.json();
  cohortRows = json.rows;
  entries = loadEntries();
}

export const ready = boot();

/* ---------- public API ---------- */

export const store = {
  ready,
  get version() { return version; },
  get studyCount() { return cohortRows.length; },
  get entries() { return [...entries]; },

  /** Subscribe to any data change; returns an unsubscribe function. */
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** All rows: study cohort first, then portal entries. */
  allRows() {
    return [...cohortRows, ...entries];
  },

  /** Next free patient ID (CKD-####). */
  nextId() {
    let maxNum = 500;
    for (const r of this.allRows()) {
      const m = /^CKD-(\d+)$/.exec(r.patientId);
      if (m) maxNum = Math.max(maxNum, Number(m[1]));
    }
    return `CKD-${String(maxNum + 1).padStart(4, "0")}`;
  },

  /**
   * Validate + register a new patient. Returns {ok, patient?, engine?, error?}.
   * The record is stored locally and scored by all five models immediately.
   */
  async addPatient(form) {
    await ensureReady();
    const errors = {};
    for (const c of NUMERIC_COLUMNS) {
      const raw = String(form[c.key] ?? "").trim();
      if (raw === "") { errors[c.key] = "Required"; continue; }
      const v = Number(raw);
      if (!Number.isFinite(v)) { errors[c.key] = "Must be a number"; continue; }
      if (c.min !== undefined && v < c.min) errors[c.key] = `Min ${c.min}`;
      else if (c.max !== undefined && v > c.max) errors[c.key] = `Max ${c.max}`;
    }
    if (!["Female", "Male"].includes(form.sex)) errors.sex = "Required";
    if (Object.keys(errors).length) return { ok: false, errors };

    const num = (k) => Number(form[k]);
    const input = {
      sex: form.sex, age: num("age"), egfr: num("egfr"), microalb: num("microalb"),
      bun: num("bun"), ca: num("ca"), p: num("p"), alb: num("alb"), cr: num("cr"),
      hb: num("hb"), k: num("k"), pro: num("pro"),
    };
    const pool = this.allRows().map(rowToPool);
    const engine = predictAll(input, pool);

    const patient = {
      patientId: this.nextId(),
      sex: form.sex,
      age: num("age"), wbc: num("wbc"), hb: num("hb"), plt: num("plt"),
      fbs: num("fbs"), ppg2h: num("ppg2h"), t: num("t"), h: num("h"),
      lymphocyte: num("lymphocyte"), bun: num("bun"), cr: num("cr"), ca: num("ca"),
      p: num("p"), alb: num("alb"), tsh: num("tsh"), hba1c: num("hba1c"),
      microalb: num("microalb"), na: num("na"), k: num("k"), ast: num("ast"),
      alt: num("alt"), pro: num("pro"), egfr: num("egfr"),
      attnRisk: String(engine.attention.riskScore),
      attnHead1: engine.attention.head1,
      attnHead2: engine.attention.head2,
      source: "portal",
      createdAt: new Date().toISOString(),
      prediction: { ...engine.predictions, engine: "engine-v1" },
    };
    entries.push(patient);
    persistEntries();
    notify();
    return { ok: true, patient, engine };
  },

  /** Delete a portal-registered entry (study rows are read-only). */
  deleteEntry(patientId) {
    const before = entries.length;
    entries = entries.filter((r) => r.patientId !== patientId);
    if (entries.length !== before) {
      persistEntries();
      notify();
      return true;
    }
    return false;
  },

  /** Import portal entries from an exported JSON payload. */
  importEntries(jsonText) {
    const data = JSON.parse(jsonText);
    const rows = Array.isArray(data) ? data : data.entries;
    if (!Array.isArray(rows)) throw new Error("Unexpected file format");
    const seen = new Set(this.allRows().map((r) => r.patientId));
    let added = 0;
    for (const r of rows) {
      if (!r || typeof r.patientId !== "string" || !/^CKD-\d+$/.test(r.patientId)) continue;
      if (r.source !== "portal") continue; // study rows are immutable
      if (seen.has(r.patientId)) continue;
      seen.add(r.patientId);
      entries.push({
        ...r,
        attnHead1: Array.isArray(r.attnHead1) ? r.attnHead1 : JSON.parse(r.attnHead1 || "null"),
        attnHead2: Array.isArray(r.attnHead2) ? r.attnHead2 : JSON.parse(r.attnHead2 || "null"),
        prediction: r.prediction || null,
        source: "portal",
      });
      added++;
    }
    persistEntries();
    notify();
    return added;
  },

  clearEntries() {
    entries = [];
    persistEntries();
    notify();
  },

  /** Export the whole merged dataset (study + portal) as JSON text. */
  exportAllJson() {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        meta: { cohort: "Patient Data.xlsx study rows + portal entries" },
        entries,
      },
      null,
      2
    );
  },
};

/* ---------- shared filtering (port of patient-query.ts) ---------- */

const SORTABLE = new Set([
  "patientId", "sex", "age", "egfr", "cr", "bun", "alb", "hb", "microalb", "hba1c",
  "predFailure", "predTransplant", "createdAt",
]);

export function applyFilters(rows, f) {
  let out = rows;
  if (f.q) {
    const q = f.q.toLowerCase();
    out = out.filter((r) => r.patientId.toLowerCase().includes(q) || r.sex.toLowerCase() === q);
  }
  if (f.sex !== "any") out = out.filter((r) => r.sex === f.sex);
  if (f.stage !== "any") out = out.filter((r) => ckStageOf(r.egfr) === f.stage);
  if (f.source !== "any") out = out.filter((r) => r.source === f.source);
  for (const [key, range] of Object.entries(f.ranges || {})) {
    const val = (r) => r[key];
    if (range.min !== undefined && range.min !== null && range.min !== "") out = out.filter((r) => val(r) >= Number(range.min));
    if (range.max !== undefined && range.max !== null && range.max !== "") out = out.filter((r) => val(r) <= Number(range.max));
  }
  const dir = f.sortDir === "desc" ? -1 : 1;
  const sortBy = SORTABLE.has(f.sortBy) ? f.sortBy : "patientId";
  out = [...out].sort((a, b) => {
    let va, vb;
    if (sortBy === "predFailure") { va = a.prediction?.attnFailure ?? -1; vb = b.prediction?.attnFailure ?? -1; }
    else if (sortBy === "predTransplant") { va = a.prediction?.attnTransplant ?? -1; vb = b.prediction?.attnTransplant ?? -1; }
    else if (sortBy === "createdAt") { va = Date.parse(a.createdAt || "") || 0; vb = Date.parse(b.createdAt || "") || 0; }
    else { va = a[sortBy]; vb = b[sortBy]; }
    if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * dir;
    return (va - vb) * dir;
  });
  return out;
}

function ckStageOf(egfr) {
  if (egfr >= 90) return "G1";
  if (egfr >= 60) return "G2";
  if (egfr >= 45) return "G3a";
  if (egfr >= 30) return "G3b";
  if (egfr >= 15) return "G4";
  return "G5";
}
