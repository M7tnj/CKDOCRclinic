/**
 * CKD survival prediction engine — client-side port of the Next.js app's
 * src/lib/prediction-engine.ts. Implements the five study models for NEW
 * patient inputs:
 *  - Attention-Based NN Survival: faithful to "Attention NN Architecture.xlsx"
 *    (z-normalized inputs -> 4 feature groups -> 2 attention heads with fitted
 *    Q/K score models -> risk score driven by the study's Cox linear predictor,
 *    capped at 0.42 -> time = base_median(eGFR) × exp(-risk × 0.6), ±5% band).
 *  - Cox PH: log(HR) coefficients from "Feature Importance.xlsx" + fitted
 *    log-linear baseline median.
 *  - RSF / Gradient Boosted / NN: calibrated k-nearest-neighbour surrogates
 *    over the study's published predictions (k=10, inverse-distance weighted).
 */

import { MODEL_FEATURES } from "./columns.js";

let paramsPromise = null;
let PARAMS = null;

/** Load and cache the fitted model parameters (data/model-params.json). */
export function loadParams() {
  if (!paramsPromise) {
    paramsPromise = fetch("data/model-params.json")
      .then((r) => r.json())
      .then((p) => { PARAMS = p; return p; });
  }
  return paramsPromise;
}

export async function ensureReady() {
  await loadParams();
  return PARAMS;
}

/** Raw model-space vector: Sex as -1/+1, MicroAlb as log10. */
export function rawVector(input) {
  const logAlb = Math.log10(Math.max(input.microalb, 0.1));
  return [
    input.age, input.sex === "Male" ? 1 : -1, input.egfr, logAlb,
    input.bun, input.ca, input.p, input.alb, input.cr, input.hb, input.k, input.pro,
  ];
}

/** Cox linear predictor: same raw vector but Sex coded 0/1 (HR is "Sex (Male)"). */
export function coxEta(raw) {
  const v = [...raw];
  v[1] = (v[1] + 1) / 2; // -1/+1 -> 0/1
  let eta = 0;
  PARAMS.cox.betaRaw.forEach((b, i) => (eta += b * v[i]));
  return eta;
}

export function normalize(raw) {
  return PARAMS.features.map((f, i) => (raw[i] - f.mu) / f.sigma);
}

function softmax4(scores) {
  const m = Math.max(...scores);
  const ex = scores.map((s) => Math.exp(s - m));
  const sum = ex.reduce((a, b) => a + b, 0);
  return ex.map((e) => e / sum);
}

/** Multi-head self-attention weights (2 heads × 4 feature groups). */
export function attentionWeights(xn) {
  const heads = [[], []];
  for (let h = 0; h < 2; h++) {
    const scores = [];
    for (let g = 0; g < 4; g++) {
      const mdl = PARAMS.attention.find((a) => a.head === h + 1 && a.group === g);
      const idx = [3 * g, 3 * g + 1, 3 * g + 2];
      const s = mdl.coef.reduce((acc, c, j) => acc + c * xn[idx[j]], mdl.intercept);
      scores.push(s);
    }
    heads[h] = softmax4(scores);
  }
  return { head1: heads[0], head2: heads[1] };
}

function interpLog(egfr, curve) {
  const { knots, logBase } = curve;
  if (egfr <= knots[0]) return logBase[0];
  if (egfr >= knots[knots.length - 1]) return logBase[logBase.length - 1];
  for (let i = 1; i < knots.length; i++) {
    if (egfr <= knots[i]) {
      const t = (egfr - knots[i - 1]) / (knots[i] - knots[i - 1]);
      return logBase[i - 1] + t * (logBase[i] - logBase[i - 1]);
    }
  }
  return logBase[logBase.length - 1];
}

export function baseMedian(egfr, outcome) {
  return Math.exp(interpLog(egfr, PARAMS.baseMedian[outcome]));
}

function knn(pool, xn, k = PARAMS.knn.k) {
  const scored = pool.map((row) => {
    const v = [row.age, row.sex, row.egfr, row.logMicroAlb, row.bun, row.ca, row.p, row.alb, row.cr, row.hb, row.k, row.pro];
    const zn = PARAMS.features.map((f, i) => (v[i] - f.mu) / f.sigma);
    let d2 = 0;
    for (let i = 0; i < 12; i++) d2 += (zn[i] - xn[i]) ** 2;
    return { row, d: Math.sqrt(d2) };
  });
  scored.sort((a, b) => a.d - b.d);
  const near = scored.slice(0, k);
  const weights = near.map((n) => 1 / (n.d + 1e-6));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const agg = (sel) => near.reduce((acc, n, i) => acc + (weights[i] / wsum) * sel(n.row), 0);
  return {
    neighbours: near.map((n) => ({
      patientId: n.row.patientId,
      distance: Math.round(n.d * 1000) / 1000,
      rsfFailure: n.row.rsfFailure, rsfTransplant: n.row.rsfTransplant,
      gbFailure: n.row.gbFailure, gbTransplant: n.row.gbTransplant,
      nnFailure: n.row.nnFailure, nnTransplant: n.row.nnTransplant,
    })),
    rsfFailure: agg((r) => r.rsfFailure), rsfTransplant: agg((r) => r.rsfTransplant),
    gbFailure: agg((r) => r.gbFailure), gbTransplant: agg((r) => r.gbTransplant),
    nnFailure: agg((r) => r.nnFailure), nnTransplant: agg((r) => r.nnTransplant),
  };
}

function roundClamp(v, lo = 3, hi = 300) {
  return Math.round(Math.min(hi, Math.max(lo, v)));
}

/**
 * Run all five models.
 * @param input {sex, age, egfr, microalb, bun, ca, p, alb, cr, hb, k, pro}
 * @param pool  reference rows: {patientId, age, sex(-1/1), egfr, logMicroAlb, bun, ca, p,
 *              alb, cr, hb, k, pro, rsfFailure, rsfTransplant, gbFailure, gbTransplant,
 *              nnFailure, nnTransplant}
 */
export function predictAll(input, pool) {
  const raw = rawVector(input);
  const xn = normalize(raw);
  const eta = coxEta(raw);

  // ---- Attention NN (architecture-faithful) ----
  const { head1, head2 } = attentionWeights(xn);
  const risk = Math.min(
    PARAMS.riskCap,
    Math.max(PARAMS.riskFloor, PARAMS.riskModel.kappa * ((eta - PARAMS.riskModel.etaMean) / PARAMS.riskModel.etaStd))
  );
  const multiplier = Math.exp(-0.6 * risk);
  const baseF = baseMedian(input.egfr, "failure");
  const baseT = baseMedian(input.egfr, "transplant");
  const attnFailure = roundClamp(baseF * multiplier);
  const attnTransplant = roundClamp(baseT * multiplier);

  // ---- Cox PH ----
  const clampFit = (fit) =>
    Math.exp(Math.min(Math.max(fit.slope * eta + fit.intercept, Math.log(3)), Math.log(300)));
  const coxFailure = roundClamp(clampFit(PARAMS.cox.fit.failure));
  const coxTransplant = roundClamp(clampFit(PARAMS.cox.fit.transplant));

  // ---- RSF / GB / NN (kNN surrogates) ----
  const kn = knn(pool, xn);

  const riskLabel = attnFailure < 24 ? "High" : attnFailure <= 60 ? "Moderate" : "Low";
  const ORDER = PARAMS.features.map((f) => f.name);

  return {
    normalized: Object.fromEntries(ORDER.map((n, i) => [n, Math.round(xn[i] * 1000) / 1000])),
    attention: {
      head1: head1.map((v) => Math.round(v * 10000) / 10000),
      head2: head2.map((v) => Math.round(v * 10000) / 10000),
      groups: PARAMS.groups,
      riskScore: Math.round(risk * 10000) / 10000,
      riskLabel,
      baseMedianFailure: Math.round(baseF * 10) / 10,
      baseMedianTransplant: Math.round(baseT * 10) / 10,
      multiplier: Math.round(multiplier * 10000) / 10000,
    },
    predictions: {
      coxFailure, coxTransplant,
      rsfFailure: roundClamp(kn.rsfFailure), rsfTransplant: roundClamp(kn.rsfTransplant),
      gbFailure: roundClamp(kn.gbFailure), gbTransplant: roundClamp(kn.gbTransplant),
      nnFailure: roundClamp(kn.nnFailure), nnTransplant: roundClamp(kn.nnTransplant),
      attnFailure, attnTransplant,
    },
    neighbours: kn.neighbours,
    coxLinearPredictor: Math.round(eta * 10000) / 10000,
    modelFeatures: MODEL_FEATURES,
  };
}

/** Convert a stored patient row to the engine's kNN pool shape. */
export function rowToPool(r) {
  const p = r.prediction || {};
  return {
    patientId: r.patientId,
    distance: 0,
    age: r.age, sex: r.sex === "Male" ? 1 : -1, egfr: r.egfr,
    logMicroAlb: Math.log10(Math.max(r.microalb, 0.1)),
    bun: r.bun, ca: r.ca, p: r.p, alb: r.alb, cr: r.cr, hb: r.hb, k: r.k, pro: r.pro,
    rsfFailure: p.rsfFailure ?? 0, rsfTransplant: p.rsfTransplant ?? 0,
    gbFailure: p.gbFailure ?? 0, gbTransplant: p.gbTransplant ?? 0,
    nnFailure: p.nnFailure ?? 0, nnTransplant: p.nnTransplant ?? 0,
  };
}
