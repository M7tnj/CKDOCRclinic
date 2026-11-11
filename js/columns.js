/**
 * Column metadata for the CKD portal — mirrors "Patient Data.xlsx" (25 columns)
 * plus the 12 model-input features used by the survival models.
 */

export const PATIENT_COLUMNS = [
  { key: "patientId", label: "Patient ID", unit: "", kind: "id", decimals: 0, section: "Demographics" },
  { key: "sex", label: "Sex", unit: "", kind: "select", options: ["Female", "Male"], decimals: 0, section: "Demographics", modelFeature: "Sex" },
  { key: "age", label: "Age", unit: "years", kind: "number", min: 1, max: 120, step: 1, decimals: 0, section: "Demographics", modelFeature: "Age" },
  { key: "wbc", label: "WBC", unit: "×10⁹/L", kind: "number", min: 0.1, max: 100, step: 0.1, decimals: 1, section: "Hematology" },
  { key: "hb", label: "Hb", unit: "g/dL", kind: "number", min: 1, max: 25, step: 0.1, decimals: 1, section: "Hematology", modelFeature: "Hb" },
  { key: "plt", label: "PLT", unit: "×10⁹/L", kind: "number", min: 1, max: 1000, step: 1, decimals: 0, section: "Hematology" },
  { key: "fbs", label: "FBS", unit: "mg/dL", kind: "number", min: 20, max: 800, step: 1, decimals: 0, section: "Glucose panel" },
  { key: "ppg2h", label: "PPG2h", unit: "mg/dL", kind: "number", min: 20, max: 800, step: 1, decimals: 0, section: "Glucose panel" },
  { key: "t", label: "T", unit: "°C", kind: "number", min: 30, max: 45, step: 0.1, decimals: 1, section: "Demographics", hint: "Body temperature" },
  { key: "h", label: "H", unit: "cm", kind: "number", min: 50, max: 250, step: 1, decimals: 0, section: "Demographics", hint: "Height" },
  { key: "lymphocyte", label: "Lymphocyte", unit: "%", kind: "number", min: 0, max: 100, step: 0.1, decimals: 1, section: "Hematology" },
  { key: "bun", label: "BUN", unit: "mg/dL", kind: "number", min: 1, max: 300, step: 0.1, decimals: 1, section: "Renal panel", modelFeature: "BUN" },
  { key: "cr", label: "Cr", unit: "mg/dL", kind: "number", min: 0.1, max: 30, step: 0.01, decimals: 2, section: "Renal panel", modelFeature: "Cr" },
  { key: "ca", label: "Ca", unit: "mg/dL", kind: "number", min: 1, max: 20, step: 0.1, decimals: 1, section: "Renal panel", modelFeature: "Ca" },
  { key: "p", label: "P", unit: "mg/dL", kind: "number", min: 0.5, max: 15, step: 0.1, decimals: 1, section: "Renal panel", modelFeature: "P" },
  { key: "alb", label: "Alb", unit: "g/dL", kind: "number", min: 0.5, max: 8, step: 0.1, decimals: 1, section: "Renal panel", modelFeature: "Alb" },
  { key: "tsh", label: "TSH", unit: "mIU/L", kind: "number", min: 0.01, max: 100, step: 0.01, decimals: 2, section: "Glucose panel" },
  { key: "hba1c", label: "HbA1c", unit: "%", kind: "number", min: 2, max: 20, step: 0.1, decimals: 1, section: "Glucose panel" },
  { key: "microalb", label: "MicroAlb", unit: "mg/L", kind: "number", min: 0.1, max: 1000, step: 0.1, decimals: 1, section: "Urine panel", modelFeature: "LogMicroAlb", hint: "log₁₀ used by models" },
  { key: "na", label: "Na", unit: "mEq/L", kind: "number", min: 100, max: 180, step: 1, decimals: 0, section: "Renal panel" },
  { key: "k", label: "K", unit: "mEq/L", kind: "number", min: 1, max: 10, step: 0.1, decimals: 1, section: "Renal panel", modelFeature: "K" },
  { key: "ast", label: "AST", unit: "U/L", kind: "number", min: 1, max: 1000, step: 1, decimals: 0, section: "Liver panel" },
  { key: "alt", label: "ALT", unit: "U/L", kind: "number", min: 1, max: 1000, step: 1, decimals: 0, section: "Liver panel" },
  { key: "pro", label: "Pro", unit: "g/24h", kind: "number", min: 0, max: 20, step: 0.01, decimals: 2, section: "Urine panel", modelFeature: "Pro", hint: "Proteinuria — 0 allowed" },
  { key: "egfr", label: "eGFR", unit: "mL/min/1.73m²", kind: "number", min: 1, max: 200, step: 0.1, decimals: 1, section: "Renal panel", modelFeature: "eGFR" },
];

export const NUMERIC_COLUMNS = PATIENT_COLUMNS.filter((c) => c.kind === "number");

export const MODEL_FEATURES = [
  "Age", "Sex", "eGFR", "LogMicroAlb", "BUN", "Ca", "P", "Alb", "Cr", "Hb", "K", "Pro",
];

export const FEATURE_GROUPS = [
  { name: "Age / Sex / eGFR", features: ["Age", "Sex", "eGFR"], color: "var(--chart-1)" },
  { name: "LogMicroAlb / BUN / Ca", features: ["LogMicroAlb", "BUN", "Ca"], color: "var(--chart-2)" },
  { name: "P / Alb / Cr", features: ["P", "Alb", "Cr"], color: "var(--chart-3)" },
  { name: "Hb / K / Pro", features: ["Hb", "K", "Pro"], color: "var(--chart-4)" },
];

export const SECTIONS = ["Demographics", "Hematology", "Glucose panel", "Renal panel", "Liver panel", "Urine panel"];

/** Cohort-observed ranges used by "Fill example" on the register page. */
export const RANGES = {
  age: [22, 78], wbc: [3, 15.3], hb: [6.8, 17.6], plt: [80, 356], fbs: [60, 237],
  ppg2h: [70, 331], t: [35.8, 37.5], h: [147, 194], lymphocyte: [8, 47.5],
  bun: [5, 65.1], cr: [0.5, 6.53], ca: [7, 11], p: [2.2, 7.3], alb: [1.5, 5],
  tsh: [0.1, 10.9], hba1c: [4.7, 10.7], microalb: [3, 351], na: [131, 149],
  k: [3.4, 6.1], ast: [5, 53], alt: [3, 63], pro: [0, 4.5], egfr: [6.8, 129.8],
};

export const DEFAULTS = {
  sex: "Female", age: 60, wbc: 7.5, hb: 11.0, plt: 220, fbs: 100, ppg2h: 140,
  t: 36.6, h: 165, lymphocyte: 25.0, bun: 32.0, cr: 2.5, ca: 8.9, p: 4.6,
  alb: 3.5, tsh: 3.5, hba1c: 6.5, microalb: 120, na: 139, k: 4.7, ast: 25,
  alt: 22, pro: 1.2, egfr: 35.0,
};

/** The five study models. */
export const MODELS = [
  { key: "cox", label: "Cox PH", short: "Cox PH", cKey: "Cox PH" },
  { key: "rsf", label: "Random Survival Forest", short: "RSF", cKey: "Random Survival Forest" },
  { key: "gb", label: "Gradient Boosted", short: "Grad. Boost", cKey: "Gradient Boosted Survival" },
  { key: "nn", label: "Neural Network", short: "Neural Net", cKey: "Neural Network Survival" },
  { key: "attn", label: "Attention NN", short: "Attention NN", cKey: "Attention-Based NN Survival" },
];

export function ckStage(egfr) {
  if (egfr >= 90) return { stage: "G1", label: "Normal / high" };
  if (egfr >= 60) return { stage: "G2", label: "Mild decrease" };
  if (egfr >= 45) return { stage: "G3a", label: "Mild–moderate" };
  if (egfr >= 30) return { stage: "G3b", label: "Moderate–severe" };
  if (egfr >= 15) return { stage: "G4", label: "Severe" };
  return { stage: "G5", label: "Kidney failure" };
}

export const STAGE_ORDER = ["G1", "G2", "G3a", "G3b", "G4", "G5"];

export function fmt(v, decimals = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number(v).toFixed(decimals);
}

/** Export column order — exact Patient Data.xlsx order + model predictions. */
export function exportHeader() {
  return PATIENT_COLUMNS.map((c) => (c.unit ? `${c.label} (${c.unit})` : c.label)).concat([
    "Cox Failure (mo)", "Cox Transplant (mo)", "RSF Failure (mo)", "RSF Transplant (mo)",
    "GB Failure (mo)", "GB Transplant (mo)", "NN Failure (mo)", "NN Transplant (mo)",
    "Attn NN Failure (mo)", "Attn NN Transplant (mo)", "Attention Risk Score", "Data Source",
  ]);
}

/** Export row values in the same order. */
export function exportRow(r) {
  const p = r.prediction || {};
  return [
    r.patientId, r.sex, r.age, r.wbc, r.hb, r.plt, r.fbs, r.ppg2h, r.t, r.h,
    r.lymphocyte, r.bun, r.cr, r.ca, r.p, r.alb, r.tsh, r.hba1c, r.microalb,
    r.na, r.k, r.ast, r.alt, r.pro, r.egfr,
    p.coxFailure ?? "", p.coxTransplant ?? "",
    p.rsfFailure ?? "", p.rsfTransplant ?? "",
    p.gbFailure ?? "", p.gbTransplant ?? "",
    p.nnFailure ?? "", p.nnTransplant ?? "",
    p.attnFailure ?? "", p.attnTransplant ?? "",
    r.attnRisk ?? "", r.source,
  ];
}
