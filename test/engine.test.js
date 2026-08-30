/**
 * Reconciliation tests. Run with:  npm test   (node --test, no dependencies)
 *
 * The fixture is the workbook's own cached output for the configuration it ships with.
 * If any of these fail, the engine no longer reproduces Gold Standard and Verra v1.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { engine, hydrate, sumRow, YEARS } from "../shared/engine.mjs";

const DATA = JSON.parse(readFileSync(new URL("../public/data/snapshot-2026-08-14.json", import.meta.url)));
const ROWS = hydrate(DATA);

const base = {
  country: "Tanzania", target: "Single-year", method: "Annual Adjustments/Trajectory",
  invYear: 2024, scope: "All", inputs: { 3: {}, 4: {}, 5: {}, 6: {}, 9: {} },
};
const vals = (res, row) => YEARS.map(y => res.v[row][y]);

test("dataset integrity", () => {
  assert.equal(DATA.n, 601);
  assert.equal(ROWS.length, 601);
  assert.equal(ROWS.reduce((a, r) => a + r.vol, 0), 23_240_850);
  assert.equal(new Set(ROWS.map(r => r.cty)).size, 14);
});

test("Tanzania fixture matches the workbook cached values", () => {
  const r = engine(ROWS, base, "compat");
  assert.deepEqual(vals(r, 7),  [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(vals(r, 8),  [0, 0, 0, 0, 180_867, 142_504]);
  assert.deepEqual(vals(r, 10), [0, 0, 0, 0, 180_867, 142_504]);
  assert.deepEqual(vals(r, 11), ["N/A", "N/A", "N/A", "N/A", "N/A", "N/A"]);
  assert.deepEqual(vals(r, 12), [0, 67_497, 230_126, 25_748, 0, 0]);
  assert.deepEqual(vals(r, 13), [0, 0, 0, 0, 180_867, 323_371]);
  assert.deepEqual(vals(r, 14), [0, -67_497, -230_126, -25_748, "", ""]);
});

test("all fourteen Parties, trajectory election, all authorisations", () => {
  const expected = {
    Benin:          [0, 500_903, 500_903, 500_903],
    Cambodia:       [0, 3_369_411, 3_369_411, 3_369_411],
    Gambia:         [0, 0, 196_652, 0],
    Lao:            [1_276_305, 0, 1_276_305, 1_276_305],
    Madagascar:     [2_822_091, 0, 2_822_091, 2_822_091],
    Malawi:         [0, 1_778_475, 1_778_475, 1_778_475],
    Morocco:        [5_417, 0, 5_417, 5_417],
    Nigeria:        [2_464_516, 38_183, 2_502_699, 2_502_699],
    Rwanda:         [1_748_718, 5_568_783, 7_317_501, 7_317_501],
    "Sierra Leone": [0, 0, 2_078, 0],
    Tanzania:       [0, 323_371, 323_371, 323_371],
    Togo:           [0, 506_009, 506_009, 506_009],
    Uzbekistan:     [1_568_083, 0, 1_568_083, 1_568_083],
    Zimbabwe:       [1_071_855, 0, 1_071_855, 1_071_855],
  };
  for (const [country, [r7, r8, r12, r13]] of Object.entries(expected)) {
    const r = engine(ROWS, { ...base, country }, "compat");
    assert.equal(sumRow(r, 7), r7, `${country} row 7`);
    assert.equal(sumRow(r, 8), r8, `${country} row 8`);
    assert.equal(sumRow(r, 12), r12, `${country} row 12`);
    assert.equal(r.v[13][2026], r13, `${country} row 13 at 2026`);
  }
});

test("CARP scope sensitivity", () => {
  const expected = {
    Benin: [500_903, 0], Lao: [1_276_305, 0], Morocco: [5_417, 0],
    Nigeria: [2_502_699, 0], Rwanda: [7_317_501, 1_415_982], Togo: [506_009, 0],
  };
  for (const [country, [all, carp]] of Object.entries(expected)) {
    assert.equal(sumRow(engine(ROWS, { ...base, country, scope: "All" }, "compat"), 12), all, country);
    assert.equal(sumRow(engine(ROWS, { ...base, country, scope: "CARP" }, "compat"), 12), carp, country);
  }
});

test("corrected mode removes the Gambia and Sierra Leone contradiction", () => {
  for (const country of ["Gambia", "Sierra Leone"]) {
    const compat = engine(ROWS, { ...base, country }, "compat");
    const fixed = engine(ROWS, { ...base, country }, "corrected");
    assert.equal(sumRow(compat, 7) + sumRow(compat, 8), 0, `${country} reports no first transfers`);
    assert.ok(sumRow(compat, 12) > 0, `${country} still books an adjustment under v1`);
    assert.equal(sumRow(fixed, 12), 0, `${country} adjustment cleared under corrected mode`);
  }
});

test("averaging election spreads the adjustment evenly to the inventory year", () => {
  const r = engine(ROWS, { ...base, country: "Rwanda", method: "Averaging" }, "corrected");
  const inWindow = YEARS.filter(y => y <= base.invYear);
  const first = r.v[12][inWindow[0]];
  for (const y of inWindow) assert.equal(r.v[12][y], first, `year ${y}`);
  for (const y of YEARS.filter(y => y > base.invYear)) assert.equal(r.v[12][y], "", `year ${y} blank`);
  assert.equal(Math.round(first * inWindow.length), sumRow(engine(ROWS, { ...base, country: "Rwanda" }, "corrected"), 10));
});

test("emissions balance needs an inventory figure in corrected mode", () => {
  const cfg = { ...base, country: "Rwanda", inputs: { 3: {}, 4: {}, 5: { 2023: "12500000" }, 6: {}, 9: {} } };
  const r = engine(ROWS, cfg, "corrected");
  assert.equal(r.v[14][2021], "");
  assert.equal(r.v[14][2023], 12_500_000 - r.v[12][2023]);
});
