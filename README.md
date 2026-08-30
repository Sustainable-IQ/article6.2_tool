# Article 6.2 Corresponding Adjustments Workbench

A web rebuild of the Gold Standard and Verra *Article 6.2 Corresponding Adjustments Reporting Tool*
(`Article-6.2-CA-Reporting-Tool_v1.xlsx`, version 1.0, 20 August 2026, data cutoff 14 August 2026).

One Cloudflare Worker serves the whole product: a JSON API under `/api/*` backed by D1, and a static
front end for everything else. There are no runtime dependencies and no build step. The only dev
dependency is `wrangler`.

## Why it is not a spreadsheet

| | Workbook v1 | This tool |
|---|---|---|
| Data currency | Frozen at 14 August 2026, no way to tell a user their copy is stale | Snapshot-versioned in D1; a new cutoff is an insert, not a redistribution |
| Traceability | Reconstruct a SUMIFS across 601 rows by hand | Select any figure to see the exact credit blocks behind it, with a link to each authorisation |
| Accounting elections | Pick one, see one answer | Every permitted election side by side with the deltas |
| Failure modes | A mistyped country name returns a page of clean zeros | Closed list, and unresolved first transfer definitions raise a visible check |
| Audit output | The full credit list on a separate tab | An audit annex naming every block behind rows 5, 6 and 10 of Table 4 |

A Party's own inventory, trajectory and ITMO-use figures are computed in the browser and never reach
the Worker.

## Layout

```
wrangler.jsonc                   Worker, D1 binding, static assets binding
src/index.js                     Worker: /api/* plus asset fallthrough
shared/engine.mjs                calculation engine, canonical implementation
public/index.html                the front end, self-contained, snapshot embedded
public/data/snapshot-*.json      build-time snapshot, also the offline fallback
migrations/0001_schema.sql       D1 schema
migrations/0002_seed_*.sql       generated seed, 601 credit blocks
tools/extract.py                 workbook to snapshot JSON and CSV
tools/make_seed.py               snapshot JSON to D1 seed migration
test/engine.test.js              reconciliation against the workbook's own values
test/api.test.js                 Worker API against in-memory SQLite
```

## Deploy

```bash
npm install                       # wrangler only
npm test                          # 14 tests, no network needed

npx wrangler d1 create article6   # paste the returned database_id into wrangler.jsonc
npm run db:migrate
npm run db:seed
npm run deploy
```

Or connect this repository in the Cloudflare dashboard under **Workers and Pages**, and every push
builds and deploys. The database steps are still run once from a terminal.

The site works before the database exists: `/api/*` returns 503 and the front end falls back to the
snapshot embedded in `public/index.html`.

## Refreshing the data

When Gold Standard and Verra publish a new workbook version:

```bash
python3 tools/extract.py <new-workbook.xlsx>          # writes credits.json, credits.csv, tool_meta.json
python3 tools/make_seed.py <new-snapshot.json> 2026-11-30
npx wrangler d1 execute article6 --remote --file=./migrations/0003_seed_2026-11-30.sql
```

Snapshots coexist. `is_current` selects the default, and `/api/dataset?snapshot=2026-08-14` still
returns the old one, so a Party can see exactly what changed between the cutoff it reported against
and today.

## API

| Endpoint | Returns |
|---|---|
| `GET /api/health` | liveness |
| `GET /api/snapshots` | every loaded snapshot with its cutoff and source version |
| `GET /api/dataset[?snapshot=]` | the compact columnar payload the front end consumes |
| `GET /api/parties[?snapshot=]` | per-Party totals: blocks, volume, volume on the CARP, (O)IMP-only volume |
| `GET /api/credits?party=&scope=All\|CARP` | credit blocks, up to 5000 |
| `GET /api/notes[?snapshot=]` | programme notes per Party |

All responses are JSON, cached for five minutes, CORS open. Read only.

## Calculation modes

**Workbook v1** reproduces the source workbook exactly, including its defects, so a user can
reconcile against a copy a colleague sent them.

**Corrected** is the default and applies four changes, each visible as an outlined cell wherever the
two differ:

1. Credit blocks whose first transfer definition the workbook logic cannot resolve are excluded from
   row 10 as well as rows 5 and 6. Under v1 they are excluded from rows 5 and 6 but still counted in
   row 10, which produces a structured summary reporting zero first transfers alongside a non-zero
   adjustment. This affects Gambia and Sierra Leone in the current snapshot.
2. The Party is a closed list. In the workbook it is free text, and a typo returns clean zeros.
3. Row 7 of Table 4, ITMOs received and used towards the NDC, is presented as an explicit input. The
   workbook instructions tell users to fill rows 1 to 4 only, yet row 7 feeds rows 8 and 10.
4. The emissions balance is suppressed for any year with no inventory figure entered, rather than
   reported as zero minus the adjustment.

The single-year accounting election is cited to **Decision 2/CMA.3, annex, paragraph 7(a)**. The
workbook cites Decision 3/CMA.3 on one sheet and Decision 5/CMA.3 on another; neither is correct.

## Known limits

Authorisation terms are not modelled. The workbook tells Parties to check that adjustment volumes are
consistent with the terms of each authorisation, but holds no cap, window, vintage restriction or
condition field, and neither does this tool yet. That is the next substantive feature.

Coverage is Gold Standard and Verra only, as published. Units authorised under other standards or
bilateral arrangements are absent, and the schema does not yet carry a source or confidence field.

## Provenance

Not an authoritative record. Parties must validate against their own records, the terms of each
authorisation, and any guidance from their designated national authority. The underlying dataset is
Gold Standard and Verra's interpretation of host country authorisations, and by their own statement
may include credits that carry no Article 6 label on either registry.
