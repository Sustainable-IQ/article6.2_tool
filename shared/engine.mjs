/**
 * Article 6.2 structured summary calculation engine.
 *
 * Canonical implementation. Reconciled cell for cell against
 * Article-6.2-CA-Reporting-Tool_v1.xlsx (Gold Standard and Verra, v1.0, 20 August 2026).
 *
 * Row numbers below are the workbook's own sheet rows on the 'Structured Summary' tab,
 * which map to Table 4 of the annex to Decision 5/CMA.3 rows 1 to 12 in order.
 */

export const YEARS = [2021, 2022, 2023, 2024, 2025, 2026];
export const RECOGNISED = new Set(["Authorisation", "Issuance"]);
export const INPUT_ROWS = [3, 4, 5, 6, 9];

export const num = (x) => {
  const n = parseFloat(String(x ?? "").replace(/[, ]/g, ""));
  return isFinite(n) ? n : 0;
};

/** Expand the compact columnar snapshot into row objects. */
export function hydrate(DATA) {
  const { d: D, c: C } = DATA;
  const rows = [];
  for (let i = 0; i < DATA.n; i++) {
    rows.push({
      i,
      prog: D.prog[C.prog[i]], pid: C.pid[i], vol: C.vol[i], sn: C.sn[i],
      vin: C.vin[i], cty: D.cty[C.cty[i]], ftd: D.ftd[C.ftd[i]],
      ay: C.ay[i], idt: C.idt[i], iy: C.iy[i],
      ndc: C.ndc[i] === 1, oimp: C.oimp[i] === 1,
      ca: D.ca[C.ca[i]], carp: C.carp[i] === 1,
      url: C.url[i] < 0 ? null : D.url[C.url[i]],
    });
  }
  return rows;
}

/**
 * @param rows   hydrated credit blocks
 * @param cfg    {country, target, method, invYear, scope, inputs}
 * @param mode   "corrected" | "compat"
 */
export function engine(rows, cfg, mode) {
  const pool = rows.filter(r => r.cty === cfg.country && (cfg.scope === "All" || r.carp));
  const corrected = mode === "corrected";
  const keep = r => (corrected ? RECOGNISED.has(r.ftd) : true);
  const ftYear = (r, y) =>
    (r.ftd === "Authorisation" && r.ay === y) || (r.ftd === "Issuance" && r.iy === y);

  const v = { 7: {}, 8: {}, 9: {}, 10: {}, 11: {}, 12: {}, 13: {}, 14: {} };
  const con = { 7: {}, 8: {}, 12: {} };
  const inputs = cfg.inputs || { 3: {}, 4: {}, 5: {}, 6: {}, 9: {} };

  for (const y of YEARS) {
    const c7 = pool.filter(r => r.ndc && ftYear(r, y));
    const c8 = pool.filter(r => !r.ndc && ftYear(r, y));
    con[7][y] = c7; con[8][y] = c8;
    v[7][y] = c7.reduce((a, r) => a + r.vol, 0);
    v[8][y] = c8.reduce((a, r) => a + r.vol, 0);
    v[9][y] = num(inputs[9]?.[y]);
    v[10][y] = (v[7][y] + v[8][y]) - v[9][y];
  }

  const averaging = cfg.target === "Single-year" && cfg.method === "Averaging";
  const elapsed = YEARS.filter(y => y <= cfg.invYear).length;
  const avg = elapsed ? YEARS.reduce((a, y) => a + v[10][y], 0) / elapsed : 0;
  for (const y of YEARS) {
    if (cfg.target === "Multi-year" || cfg.method === "Annual Adjustments/Trajectory") v[11][y] = "N/A";
    else if (averaging && y <= cfg.invYear) v[11][y] = avg;
    else v[11][y] = "";
  }

  for (const y of YEARS) {
    if (averaging) { v[12][y] = v[11][y]; con[12][y] = []; }
    else {
      const c = pool.filter(r => r.vin === y && keep(r));
      con[12][y] = c;
      v[12][y] = c.reduce((a, r) => a + r.vol, 0) - v[9][y];
    }
  }

  let run = 0;
  for (const y of YEARS) { run += v[10][y]; v[13][y] = run; }

  // Corrected mode suppresses a balance for any year with no inventory figure entered.
  // Workbook v1 reports zero minus the adjustment instead.
  const invEntered = y => {
    const x = inputs[5]?.[y];
    return x !== undefined && String(x).trim() !== "";
  };
  for (const y of YEARS) {
    const show = typeof v[12][y] === "number" && y <= cfg.invYear && (corrected ? invEntered(y) : true);
    v[14][y] = show ? num(inputs[5][y]) - v[12][y] : "";
  }

  return { v, con, pool };
}

export const sumRow = (res, row) =>
  YEARS.reduce((a, y) => a + (typeof res.v[row][y] === "number" ? res.v[row][y] : 0), 0);
