/**
 * Integration test for the Worker API.
 *
 * Runs the real src/index.js fetch handler against an in-memory SQLite database
 * loaded from the same migrations D1 uses, through a minimal D1-compatible shim.
 * Proves that /api/dataset returns a payload the front end and the engine accept,
 * and that results from the database match results from the build-time snapshot file.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/index.js";
import { engine, hydrate, sumRow } from "../shared/engine.mjs";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");

const db = new DatabaseSync(":memory:");
db.exec(read("../migrations/0001_schema.sql"));
db.exec(read("../migrations/0002_seed_2026-08-14.sql"));

// Minimal D1 shim: prepare().bind().all() / .first()
const DB = {
  prepare(sql) {
    const stmt = db.prepare(sql);
    const api = {
      bind(...args) { api._args = args; return api; },
      all() { return Promise.resolve({ results: stmt.all(...(api._args || [])) }); },
      first() { return Promise.resolve(stmt.get(...(api._args || [])) ?? null); },
    };
    return api;
  },
};
const env = { DB, ASSETS: { fetch: () => new Response("asset", { status: 200 }) } };
const call = path => worker.fetch(new Request("https://example.com" + path), env);

test("health and snapshots", async () => {
  assert.deepEqual(await (await call("/api/health")).json(), { ok: true });
  const s = await (await call("/api/snapshots")).json();
  assert.equal(s.snapshots.length, 1);
  assert.equal(s.snapshots[0].id, "2026-08-14");
  assert.equal(s.snapshots[0].source, "Gold Standard and Verra");
});

test("parties aggregate matches the dataset", async () => {
  const { parties } = await (await call("/api/parties")).json();
  assert.equal(parties.length, 14);
  assert.equal(parties.reduce((a, p) => a + p.volume, 0), 23_240_850);
  const rwanda = parties.find(p => p.party === "Rwanda");
  assert.equal(rwanda.volume, 7_317_501);
  assert.equal(rwanda.volume_on_carp, 1_415_982);
});

test("credits filter by party and CARP scope", async () => {
  const all = await (await call("/api/credits?party=Rwanda")).json();
  assert.equal(all.count, 167);
  const carp = await (await call("/api/credits?party=Rwanda&scope=CARP")).json();
  assert.ok(carp.count < all.count);
  assert.equal(carp.credits.reduce((a, r) => a + r.volume, 0), 1_415_982);
});

test("dataset payload from D1 drives the engine identically to the snapshot file", async () => {
  const fromApi = await (await call("/api/dataset")).json();
  const fromFile = JSON.parse(read("../public/data/snapshot-2026-08-14.json"));
  assert.equal(fromApi.n, fromFile.n);
  assert.equal(fromApi.cutoff, fromFile.cutoff);

  const rowsApi = hydrate(fromApi);
  const rowsFile = hydrate(fromFile);
  assert.equal(rowsApi.reduce((a, r) => a + r.vol, 0), rowsFile.reduce((a, r) => a + r.vol, 0));

  const cfg = {
    country: "Tanzania", target: "Single-year", method: "Annual Adjustments/Trajectory",
    invYear: 2024, scope: "All", inputs: { 3: {}, 4: {}, 5: {}, 6: {}, 9: {} },
  };
  for (const country of [...new Set(rowsFile.map(r => r.cty))]) {
    const a = engine(rowsApi, { ...cfg, country }, "compat");
    const b = engine(rowsFile, { ...cfg, country }, "compat");
    for (const row of [7, 8, 10, 12, 13]) {
      assert.equal(sumRow(a, row), sumRow(b, row), `${country} row ${row}`);
    }
  }
  assert.equal(Object.keys(fromApi.rowmeta).length, 12);
  assert.equal(fromApi.notes.length, 2);
});

test("unknown endpoints and non-GET are rejected", async () => {
  assert.equal((await call("/api/nope")).status, 404);
  const post = await worker.fetch(new Request("https://example.com/api/health", { method: "POST" }), env);
  assert.equal(post.status, 405);
});

test("non-api paths fall through to static assets", async () => {
  const res = await call("/");
  assert.equal(await res.text(), "asset");
});

test("no database bound degrades to 503 rather than failing the site", async () => {
  const res = await worker.fetch(new Request("https://example.com/api/dataset"), { ASSETS: env.ASSETS });
  assert.equal(res.status, 503);
});
