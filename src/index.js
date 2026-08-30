/**
 * Article 6.2 corresponding adjustments workbench.
 *
 * One Worker serves the whole product: JSON API under /api/*, static front end for
 * everything else. No runtime dependencies, no build step.
 *
 * The front end computes the structured summary in the browser, so a Party's own
 * inventory and trajectory figures never reach this Worker.
 */

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=300",
  "access-control-allow-origin": "*",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

const fail = (status, message) => json({ error: message }, status);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (request.method !== "GET") return fail(405, "Only GET is supported");
    if (!env.DB) return fail(503, "No database bound. The front end falls back to its embedded snapshot.");

    try {
      switch (url.pathname) {
        case "/api/health":    return json({ ok: true });
        case "/api/snapshots": return json(await snapshots(env));
        case "/api/dataset":   return json(await dataset(env, url.searchParams.get("snapshot")));
        case "/api/parties":   return json(await parties(env, url.searchParams.get("snapshot")));
        case "/api/credits":   return json(await credits(env, url.searchParams));
        case "/api/notes":     return json(await notes(env, url.searchParams.get("snapshot")));
        default:               return fail(404, "Unknown endpoint");
      }
    } catch (err) {
      return fail(500, String(err && err.message ? err.message : err));
    }
  },
};

async function currentSnapshot(env, requested) {
  if (requested) return requested;
  const r = await env.DB.prepare(
    "SELECT id FROM snapshots ORDER BY is_current DESC, cutoff DESC LIMIT 1"
  ).first();
  if (!r) throw new Error("No snapshots loaded. Run the seed migration.");
  return r.id;
}

async function snapshots(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, cutoff, source, source_version, published_at, is_current FROM snapshots ORDER BY cutoff DESC"
  ).all();
  return { snapshots: results };
}

async function parties(env, snap) {
  const id = await currentSnapshot(env, snap);
  const { results } = await env.DB.prepare(
    `SELECT party,
            COUNT(*)                                  AS blocks,
            SUM(volume)                               AS volume,
            SUM(CASE WHEN on_carp = 1 THEN volume END) AS volume_on_carp,
            SUM(CASE WHEN ndc = 0 THEN volume END)     AS volume_oimp_only
       FROM credit_blocks WHERE snapshot_id = ?
      GROUP BY party ORDER BY volume DESC`
  ).bind(id).all();
  return { snapshot: id, parties: results };
}

async function credits(env, params) {
  const id = await currentSnapshot(env, params.get("snapshot"));
  const party = params.get("party");
  const scope = params.get("scope") === "CARP" ? " AND on_carp = 1" : "";
  const sql = "SELECT * FROM credit_blocks WHERE snapshot_id = ?"
    + (party ? " AND party = ?" : "") + scope + " ORDER BY volume DESC LIMIT 5000";
  const stmt = party
    ? env.DB.prepare(sql).bind(id, party)
    : env.DB.prepare(sql).bind(id);
  const { results } = await stmt.all();
  return { snapshot: id, party, count: results.length, credits: results };
}

async function notes(env, snap) {
  const id = await currentSnapshot(env, snap);
  const { results } = await env.DB.prepare(
    "SELECT party, note, sources FROM party_notes WHERE snapshot_id = ?"
  ).bind(id).all();
  return { snapshot: id, notes: results };
}

/**
 * The compact columnar payload the front end consumes. Same shape as the build-time
 * snapshot file, so the page can use either without branching.
 */
async function dataset(env, snap) {
  const id = await currentSnapshot(env, snap);
  const meta = await env.DB.prepare(
    "SELECT cutoff, source_version FROM snapshots WHERE id = ?"
  ).bind(id).first();

  const { results: rows } = await env.DB.prepare(
    "SELECT * FROM credit_blocks WHERE snapshot_id = ? ORDER BY idx"
  ).bind(id).all();

  const dict = { prog: [], cty: [], ftd: [], ca: [], url: [] };
  const index = { prog: new Map(), cty: new Map(), ftd: new Map(), ca: new Map(), url: new Map() };
  const intern = (k, v) => {
    if (v === null || v === undefined) return -1;
    if (!index[k].has(v)) { index[k].set(v, dict[k].length); dict[k].push(v); }
    return index[k].get(v);
  };

  const c = { prog: [], pid: [], vol: [], sn: [], vin: [], cty: [], ftd: [], ay: [],
              idt: [], iy: [], ndc: [], oimp: [], ca: [], carp: [], url: [] };
  for (const r of rows) {
    c.prog.push(intern("prog", r.programme));
    c.pid.push(String(r.project_id));
    c.vol.push(r.volume);
    c.sn.push(r.serial);
    c.vin.push(r.vintage);
    c.cty.push(intern("cty", r.party));
    c.ftd.push(intern("ftd", r.ft_definition));
    c.ay.push(r.auth_year);
    c.idt.push(r.issuance_date);
    c.iy.push(r.issuance_year);
    c.ndc.push(r.ndc);
    c.oimp.push(r.oimp);
    c.ca.push(intern("ca", r.cooperative_approach));
    c.carp.push(r.on_carp);
    c.url.push(intern("url", r.auth_url));
  }

  const { results: t4 } = await env.DB.prepare(
    "SELECT row_no, short, src, full_label, explanation FROM table4_rows WHERE snapshot_id = ? ORDER BY row_no"
  ).bind(id).all();
  const rowmeta = {};
  for (const r of t4) {
    rowmeta[String(r.row_no)] = { short: r.short, src: r.src, full: r.full_label, explain: r.explanation || "" };
  }

  const { results: nt } = await env.DB.prepare(
    "SELECT party, note, sources FROM party_notes WHERE snapshot_id = ?"
  ).bind(id).all();

  return {
    cutoff: meta.cutoff,
    version: meta.source_version,
    snapshot: id,
    n: rows.length,
    d: dict,
    c,
    rowmeta,
    notes: nt.map(n => ({ country: n.party, note: n.note, sources: n.sources })),
  };
}
