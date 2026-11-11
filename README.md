# CKD Survival Portal — static build for GitHub Pages

A fully static, dependency-light portal for the **500-patient chronic kidney disease (CKD) cohort**
("Patient Data.xlsx") with **light / dark mode**, deployed as plain files on GitHub Pages —
no server, no build step, no database required.

> Research demonstrator — **not** for clinical decision-making.

## Pages

| Page | Route | What it does |
| --- | --- | --- |
| Overview | `#/overview` | Cohort counters, CKD-stage strip, entry points to all pages |
| 1 · Register Patient | `#/register` | Form with **every column of Patient Data.xlsx** (25 fields, grouped by panel). Saving scores all five survival models and stores the record locally |
| 2 · Data Explorer | `#/explore` | All patients (study + your entries), text search, sex/stage/source filters, per-feature min/max filters, sortable columns, column chooser, per-row detail dialog, **CSV + Excel download of the filtered subset** |
| 3 · Analytics | `#/analytics` | Live EDA & tests: Welch t / Mann-Whitney U, one-way ANOVA across CKD stages, stage distribution, distribution & relationship explorers, Pearson heatmap, Kaplan–Meier with log-rank, model performance (C-index, predicted-time spread, feature importance) |
| 4 · Prediction Platform | `#/predict` | Enter a new patient profile → **time to kidney failure** and **time to transplant** from each learning model (Cox PH, Random Survival Forest, Gradient Boosting, Neural Network, Attention NN), attention-weight interpretability, kNN reference set |

## How data storage works on a static host

GitHub Pages cannot run a database, so:

- The **500 study rows** (with their published model predictions and attention internals)
  ship as `data/cohort.json`.
- Patients registered on **Page 1** are stored in your **browser's localStorage** and merged
  client-side with the study rows across every page. A "Next ID" badge assigns `CKD-0501`, `CKD-0502`, …
- Use **Page 1 → Patient Data store** to:
  - *Export portal entries (JSON)* — carry entries to another browser or machine
  - *Download full dataset (JSON)* — the merged Patient Data file
  - *Import entries (JSON)* — load an exported entries file
  - Study rows `CKD-0001…0500` are always read-only.
- The prediction engine (Attention NN + Cox coefficients + kNN surrogates) runs **entirely in the
  browser**, and the kNN reference pool grows as you add patients.
- All analytics (Page 3) recompute **live** whenever a patient is added or removed.

## Deploy to GitHub Pages

1. Create a repository and push the contents of this folder (all files, including `.nojekyll`) to the
   `main` branch root (or to a `gh-pages` branch):

   ```bash
   git init
   git add .
   git commit -m "CKD Survival Portal"
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```

2. In the repository: **Settings → Pages → Build and deployment → Source:
   "Deploy from a branch" → main / (root) → Save**.

3. Your portal goes live at `https://<user>.github.io/<repo>/`.

> Deploying to a **subdirectory** (e.g. `/repo/`) works out of the box: all asset and data URLs are
> relative, and routing is hash-based (`#/explore`), so no 404 workaround is needed.

### Run locally

Any static server works — ES modules don't load from `file://` URLs:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Project structure

```
index.html              SPA shell (header, nav, footer, dialogs, toasts)
css/styles.css          design system + light/dark tokens (clinical teal palette)
js/
  app.js                hash router + theme toggle (persisted, respects OS preference)
  store.js              cohort.json load + localStorage entries + shared filtering
  columns.js            Patient Data.xlsx column metadata, model list, export columns
  stats.js              Welch t, Mann-Whitney U, ANOVA, Pearson/Spearman, KM, log-rank
  engine.js             five survival models (Attention NN, Cox, RSF/GB/NN surrogates)
  xlsx.js               dependency-free CSV + genuine .xlsx export writer
  ui.js                 icons, toasts, dialogs, popovers, Chart.js theming
  pages/                overview / register / explore / analytics / predict
  vendor/chart.umd.min.js   Chart.js v4 (vendored, MIT — no CDN needed)
data/
  cohort.json           500 study rows + study model predictions + attention internals
  model-params.json     fitted attention / Cox / baseline parameters
  metrics.json          study evaluation (C-index, AUCs, IBS, MAE per model & outcome)
  importance.json       feature importance + Cox hazard ratios
  architecture.json     Attention NN architecture description
.nojekyll               bypass Jekyll processing on GitHub Pages
```

## Data provenance

- **Patient Data.xlsx** — 500-patient CKD cohort (CKD-0001…0500), 25 columns.
- **Model Prediction.xlsx** — study-published per-patient predictions of the five models.
- **Attention Neural Network Details / Architecture.xlsx** — per-patient attention weights,
  risk scores and the network description.
- **Feature Importance.xlsx** — Cox hazard ratios and ML feature importances.

## Credits & license notes

- Charts: [Chart.js](https://www.chartjs.org) v4 (MIT), vendored in `js/vendor/`.
- All statistics and model inference are computed client-side in plain JavaScript.

## Disclaimer

This portal is a research demonstrator built on a synthetic/study cohort. Predictions are
central estimates with substantial model uncertainty and must **not** be used for clinical
decision-making.
