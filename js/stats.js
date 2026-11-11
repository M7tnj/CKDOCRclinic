/**
 * Self-contained statistical routines for the analytics page.
 * Welch t-test, Mann-Whitney U (tie-corrected), one-way ANOVA,
 * Pearson/Spearman correlation, Kaplan–Meier estimator and log-rank test.
 * Ported 1:1 from the Next.js app's src/lib/stats.ts.
 */

/* ---------- special functions ---------- */

function logGamma(x) {
  const g = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < g.length; i++) a += g[i] / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function betacf(a, b, x) {
  const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b). */
export function ibeta(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  const bt = Math.exp(lbeta);
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

export function erf(x) {
  // Abramowitz & Stegun 7.1.26 (|err| < 1.5e-7)
  const s = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return s * y;
}

export function normalCdf(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Two-tailed p-value of Student t with df degrees of freedom. */
export function tTestP(t, df) {
  return ibeta(df / 2, 0.5, df / (df + t * t));
}

/** Upper-tail p-value of F(d1, d2). */
export function fTestP(f, d1, d2) {
  if (f <= 0) return 1;
  const x = (d1 * f) / (d1 * f + d2);
  return 1 - ibeta(d1 / 2, d2 / 2, x);
}

/** Upper-tail p-value of chi-square with 1 df. */
export function chi2P1df(x) {
  return 2 * (1 - normalCdf(Math.sqrt(Math.max(x, 0))));
}

/* ---------- descriptive ---------- */

export function mean(a) {
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN;
}

export function std(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
}

export function median(a) {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function quantile(a, q) {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export function minOf(a) { return a.length ? Math.min(...a) : NaN; }
export function maxOf(a) { return a.length ? Math.max(...a) : NaN; }

/** Pearson correlation. */
export function pearson(x, y) {
  const n = x.length;
  if (n < 3) return NaN;
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}

function ranksOf(a) {
  const order = a.map((v, i) => ({ v, i })).sort((p, q) => p.v - q.v);
  const r = new Array(a.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].v === order[i].v) j++;
    const mid = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[order[k].i] = mid;
    i = j + 1;
  }
  return r;
}

export function spearman(x, y) {
  return pearson(ranksOf(x), ranksOf(y));
}

/** Two-tailed p-value for a Pearson/Spearman r via the t approximation. */
export function corrP(r, n) {
  if (!Number.isFinite(r) || n < 4) return NaN;
  const t = Math.abs(r) >= 1 ? Infinity : Math.abs(r) * Math.sqrt((n - 2) / (1 - r * r));
  return t === Infinity ? 0 : tTestP(t, n - 2);
}

/* ---------- group tests ---------- */

/** Welch's t-test + Mann-Whitney U between two independent samples. */
export function twoGroupTests(variable, a, b, groupA, groupB) {
  const n1 = a.length, n2 = b.length;
  const m1 = mean(a), m2 = mean(b);
  const v1 = std(a) ** 2, v2 = std(b) ** 2;
  const se = Math.sqrt(v1 / n1 + v2 / n2);
  const t = se > 0 ? (m1 - m2) / se : 0;
  const df =
    v1 / n1 + v2 / n2 > 0
      ? (v1 / n1 + v2 / n2) ** 2 / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1))
      : 1;
  const welchP = tTestP(Math.abs(t), df);

  // Mann-Whitney with midranks + tie correction
  const all = [...a, ...b];
  const order = all.map((v, i) => ({ v, i })).sort((x, y) => x.v - y.v);
  const ranks = new Array(all.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].v === order[i].v) j++;
    const midrank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[order[k].i] = midrank;
    i = j + 1;
  }
  const R1 = ranks.slice(0, n1).reduce((s, v) => s + v, 0);
  const U1 = R1 - (n1 * (n1 + 1)) / 2;
  const N = n1 + n2;
  const muU = (n1 * n2) / 2;
  const counts = new Map();
  for (const v of all) counts.set(v, (counts.get(v) ?? 0) + 1);
  const tieTerm = [...counts.values()].reduce((s, tj) => s + (tj * (tj ** 2 - 1)) / (N * (N - 1)), 0);
  const sigmaU = Math.sqrt((n1 * n2 / 12) * (N + 1 - tieTerm));
  const z = sigmaU > 0 ? (U1 - muU) / sigmaU : 0;
  const mwP = 2 * (1 - normalCdf(Math.abs(z)));

  return {
    variable, groupA, groupB,
    meanA: m1, meanB: m2, medianA: median(a), medianB: median(b),
    sdA: std(a), sdB: std(b), nA: n1, nB: n2,
    welchT: t, welchDf: df, welchP,
    mannWhitneyU: U1, mannWhitneyP: mwP,
  };
}

/** One-way ANOVA across groups. */
export function anova(variable, groups) {
  const gs = groups.filter((g) => g.values.length >= 2);
  const N = gs.reduce((s, g) => s + g.values.length, 0);
  const k = gs.length;
  const grand = mean(gs.flatMap((g) => g.values));
  const ssb = gs.reduce((s, g) => s + g.values.length * (mean(g.values) - grand) ** 2, 0);
  const ssw = gs.reduce((s, g) => s + g.values.reduce((s2, v) => s2 + (v - mean(g.values)) ** 2, 0), 0);
  const df1 = k - 1, df2 = N - k;
  const f = df1 > 0 && df2 > 0 && ssw > 0 ? (ssb / df1) / (ssw / df2) : 0;
  return {
    variable, k, N, f, df1, df2,
    p: fTestP(f, df1, df2),
    groupMeans: gs.map((g) => ({ group: g.label, mean: mean(g.values), n: g.values.length, sd: std(g.values) })),
  };
}

/* ---------- survival ---------- */

/** Kaplan–Meier estimator. `times` in months; `events` true = event observed. */
export function kaplanMeier(times, events) {
  const n = times.length;
  const rows = times.map((t, i) => ({ t, e: events[i] })).sort((a, b) => a.t - b.t);
  const steps = [];
  let surv = 1, atRisk = n;
  let i = 0;
  while (i < n) {
    const t = rows[i].t;
    let ev = 0, censored = 0;
    while (i < n && rows[i].t === t) {
      if (rows[i].e) ev++;
      else censored++;
      i++;
    }
    if (ev > 0) {
      surv *= (atRisk - ev) / atRisk;
      steps.push({ time: t, atRisk, events: ev, survival: surv });
    }
    atRisk -= ev + censored;
    if (atRisk <= 0) break;
  }
  let med = null;
  for (const s of steps) {
    if (s.survival <= 0.5) { med = s.time; break; }
  }
  return { steps, median: med };
}

/** Log-rank test between two groups (chi-square with 1 df). */
export function logRank(a, b) {
  const all = [
    ...a.times.map((t, i) => ({ t, e: a.events[i], g: 0 })),
    ...b.times.map((t, i) => ({ t, e: b.events[i], g: 1 })),
  ].sort((x, y) => x.t - y.t);
  let nA = a.times.length, nB = b.times.length;
  let Oa = 0, Ea = 0, V = 0;
  let i = 0;
  while (i < all.length && nA + nB > 0) {
    const t = all[i].t;
    let d = 0;
    const nTotal = nA + nB;
    const idxs = [];
    while (i < all.length && all[i].t === t) { idxs.push(i); if (all[i].e) d++; i++; }
    const atRiskA = nA, atRiskB = nB;
    let dA = 0;
    for (const idx of idxs) if (all[idx].e && all[idx].g === 0) dA++;
    if (d > 0 && nTotal > 1) {
      Ea += (d * atRiskA) / nTotal;
      Oa += dA;
      const p1 = atRiskA / nTotal;
      V += (d * p1 * (1 - p1) * (nTotal - d)) / (nTotal - 1);
    }
    for (const idx of idxs) {
      if (all[idx].g === 0) nA--;
      else nB--;
    }
  }
  const chi2 = V > 0 ? ((Oa - Ea) ** 2) / V : 0;
  return { chi2, p: chi2P1df(chi2), observedA: Oa, expectedA: Ea };
}
