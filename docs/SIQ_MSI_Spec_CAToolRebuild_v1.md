---
title: Article 6.2 Corresponding Adjustments Reporting Tool
subtitle: Build specification for the web rebuild of the Gold Standard and Verra Excel tool
author: Robin
date: 2026-08-25
version: 1.0
status: Draft for review
source_files: Article-6.2-CA-Reporting-Tool_v1.xlsx; marktingheadline.md
---

# Purpose and scope

Gold Standard and Verra released a joint Excel workbook on 20 August 2026 that gives Article 6.2 host countries a pre-built basis for the corresponding adjustments section of their 2026 Biennial Transparency Report (1). This project rebuilds that workbook as a web application hosted on Cloudflare, serving anyone who needs to produce or check a structured summary, and produces the positioning content that accompanies it.

The specification covers four things: what the source workbook actually does, verified line by line against its own cached results; the defects and internal contradictions found in version 1; the design of the replacement; and the decisions still open.

Scope excludes the Article 6.4 mechanism, CORSIA labelling, and any registry integration beyond reading published authorisation records.

# Source material

The workbook is `Article-6.2-CA-Reporting-Tool_v1.xlsx`, version 1.0, dated 20 August 2026, with a stated data cutoff of 14 August 2026 (2). It was created by David Hynes (Gold Standard) and last edited by Liz Guinessey (Verra). It contains six sheets: `Introduction`, `Structured Summary`, `Detailed Credit Data`, `Country List`, `Notes`, and `Change Log`.

The credit dataset holds 601 rows covering 23,240,850 credits across 14 host countries and 98 projects. Gold Standard contributes 244 rows, Verra 357. Volume by country: Rwanda 7,317,501; Cambodia 3,369,411; Madagascar 2,822,091; Nigeria 2,502,699; Malawi 1,778,475; Uzbekistan 1,568,083; Lao 1,276,305; Zimbabwe 1,071,855; Togo 506,009; Benin 500,903; Tanzania 323,371; Gambia 196,652; Morocco 5,417; Sierra Leone 2,078.

The workbook is explicit that it represents the two programmes' interpretation of the reporting requirements, not an authoritative account, and that host countries must validate it against their own records (2).

# What the Excel tool does

## Input surface

The user supplies five answers on the `Introduction` sheet:

| Field | Type | Options |
|---|---|---|
| Country name | Free text (no validation) | Any string |
| NDC target type | Dropdown | Single-year; Multi-year |
| Accounting method under paragraph 7(a) | Cascading dropdown | Single-year: Averaging or Annual Adjustments/Trajectory. Multi-year: Annual Adjustments/Trajectory only |
| Latest GHG inventory year in BTR 2026 | Dropdown | 2021 through 2025 |
| Authorisation scope | Dropdown | All; Uploaded to the CARP |

The user then supplies numeric inputs on the `Structured Summary` sheet: the indicative trajectory or budget (row 3 or row 4, depending on target type), the national GHG inventory figures (rows 5 and 6), and the quantity of ITMOs received from other Parties and used towards the NDC (row 9). Everything else calculates.

## Credit dataset schema

Fifteen columns, one row per serial number block. Field names are reproduced verbatim from the workbook.

| Column | Field | Notes |
|---|---|---|
| A | Programme | GS or Verra |
| B | Project ID | 98 distinct values |
| C | Volume | Integer tCO2e, sums to 23,240,850 |
| D | Credit Serial Number | 601 rows, 600 distinct values |
| E | Vintage | 2021 through 2025 |
| F | Country | 14 values |
| G | OIMP First Transfer Definition | Authorisation (381); Issuance (205); First international transfer (15) |
| H | Authorisation Year | 2021, 2023, 2024, 2025, 2026 |
| I | Issuance Date | Range 2022 to 29 June 2026 |
| J | Issuance Year | Calculated from column I |
| K | Authorised for NDC? | Yes (324); No (277) |
| L | Authorised for (O)IMP? | Yes on all 601 rows |
| M | Cooperative Approach ID | 12 CA identifiers plus NA (239 rows) |
| N | Authorisation uploaded to the CARP | Yes (414); No (187) |
| O | Link to authorisation | Hyperlink to Gold Standard Assurance Platform, Verra registry, or UNFCCC submissions archive |

No column contains blanks. Five of the 601 rows carry display text in column O without a hyperlink target.

## Calculation engine

The engine has been reimplemented independently in Python and reconciles exactly to the workbook's own cached values for the shipped Tanzania configuration across every calculated row. The logic below is therefore verified, not inferred.

Row 7, annual quantity of ITMOs first transferred:

    sum of Volume where Country = X and Authorised for NDC = Yes
      and First Transfer Definition = Authorisation and Authorisation Year = Y
    plus
    sum of Volume where Country = X and Authorised for NDC = Yes
      and First Transfer Definition = Issuance and Issuance Year = Y

Row 8, mitigation outcomes authorised only for other international mitigation purposes: identical to row 7 with `Authorised for NDC = No`.

Row 9: user input. Row 10: (row 7 plus row 8) minus row 9.

Row 11, averaging: returns "N/A" for a multi-year target or the trajectory method. Under averaging it returns the sum of row 10 across all six years divided by the count of years at or before the latest inventory year, written into every year at or before that cutoff.

Row 12, total corresponding adjustments: under averaging it equals row 11. Otherwise it is the sum of Volume where Country = X and Vintage = Y, minus row 9.

Row 13: running cumulative total of row 10. Row 14, emissions balance: row 5 minus row 12, blanked for any year after the latest inventory year.

The CARP scope answer applies as a filter to every one of these aggregations.

Two structural points matter for the rebuild. First, rows 7 and 8 key on the year of first transfer and filter on the NDC authorisation flag, while row 12 keys on vintage year and filters on nothing except country and CARP scope. They are different populations, not two views of the same one. Second, the CARP scope switch is far more consequential than it appears: restricting to authorisations uploaded to the CARP reduces Rwanda from 7,317,501 to 1,415,982 and takes Benin, Lao, Morocco, Nigeria, and Togo to zero.

# Defects and divergences in version 1

Eight issues were identified. The first seven are structural. The eighth is material to the numbers a country would submit.

## 1. Both citations for the accounting choice are wrong

The `Introduction` sheet attributes the single-year accounting choice to "Paragraph 7 of the annex to Decision 3/CMA.3". The `Structured Summary` sheet attributes the same paragraph to "decision Decision 5/CMA.3". The two disagree with each other, and neither is correct: Decision 3/CMA.3 governs the Article 6.4 mechanism and Decision 5/CMA.3 governs transparency modalities. The choice between an indicative multi-year trajectory and the average annual approach sits at Decision 2/CMA.3, annex, paragraph 7(a) (3), which is confirmed by the UNFCCC Article 6.2 Reference Manual (4) and is the decision every other citation in the workbook points to.

## 2. Row 9 is an undeclared input

The instructions say to input data into rows 3 to 6. Row 9, the quantity of ITMOs used towards NDC achievement, is also a user entry, feeds rows 10 and 12, and is neither shaded as an input cell nor driven by a formula. A user following the written instructions leaves it empty and understates nothing, but a user who does not know it exists will not realise that received ITMOs are missing from the balance.

## 3. The country selector is unvalidated free text

`Introduction!B5` accepts any string despite a `Country List` sheet existing. A typo produces a structured summary of clean zeros with no error, which is the most dangerous possible failure mode for a compliance submission.

## 4. The first transfer dropdown does not match the data

The validation list offers "Authorisation, Issuance, Use". The data contains "First international transfer" on 15 rows and zero instances of "Use".

## 5. Vintage validation skips the Verra block

The vintage dropdown is applied to rows 2 to 229 and 587 to 4999, omitting rows 230 to 586, which is exactly the Verra portion of the dataset.

## 6. Freeze panes are set mid-dataset

Panes freeze at row 252 rather than under the header row, so the column headers scroll away.

## 7. Duplicate serial number

601 rows contain 600 distinct serial numbers.

## 8. Gambia and Sierra Leone produce a self-contradictory report

The `Notes` sheet states that because both countries define first transfer as "first international transfer", and Verra treats that as occurring at retirement, "data does not currently populate for Gambia or Sierra Leone in this report" (2).

That is true of rows 7, 8, 10, and 13, because neither SUMIFS in rows 7 and 8 matches the "First international transfer" value. It is not true of row 12. Row 12 carries no first transfer definition filter, so it sums the full national volume by vintage regardless. Running the verified engine produces the following for both countries:

| Country | Row 7 | Row 8 | Row 10 | Row 12 total | Row 13 cumulative |
|---|---|---|---|---|---|
| Gambia | 0 | 0 | 0 | 196,652 | 0 |
| Sierra Leone | 0 | 0 | 0 | 2,078 | 0 |

A country submitting this would report zero first transfers, zero net ITMOs, and zero cumulative ITMOs, while simultaneously reporting a corresponding adjustment of 196,652 tCO2e that reduces its reported emissions balance by the same amount. The structured summary would be internally inconsistent on its face, and the emissions balance would be wrong. This is the single most important thing the rebuild must handle differently.

# Design of the web tool

## Fidelity versus correction

The rebuild has to take a position on whether it reproduces the Excel exactly or corrects it. The recommendation is a dual-mode engine with a single default.

Compatibility mode reproduces version 1 output byte for byte, including defect 8, and exists so that a user can reconcile against the workbook a colleague sent them. Corrected mode is the default: it applies the fixes below and shows a diff against compatibility mode wherever the two differ, so nothing is corrected silently.

Corrections in the default mode: first transfer definitions outside the recognised set raise a blocking warning rather than falling through to zero; row 12 respects the same population as rows 7 and 8; the country selector is a closed list; row 9 is presented as an explicit required input; and every cell that depends on a Gold Standard or Verra assumption is marked for designated national authority sign-off before export.

## Architecture

Cloudflare Workers with static assets, serving a compiled single-page application from one Worker. Pages is the alternative but Workers with static assets is the direction Cloudflare is consolidating on and it keeps the API routes and the front end in one deployment (5).

Front end: Vite with TypeScript and Preact. The calculation engine is a pure TypeScript module with no DOM or network dependency, unit tested with Vitest against fixtures extracted from the workbook, including the full Tanzania reconciliation used to verify the Python implementation.

Data: the dataset is 601 rows and roughly 384 KB of JSON, which compresses to well under 100 KB. It ships as a versioned static asset (for example `/data/credits-2026-08-14.json`) alongside a manifest listing available snapshots. A Worker route resolves the current snapshot so clients are never pinned to a stale cache. D1 is not required at this size and should be introduced only when an admin update interface or snapshot diffing at scale justifies it.

Compute: entirely client side. National GHG inventory figures, trajectory data, and ITMO use data never leave the browser. For a government user this is the decisive property of the design, and it is also the clearest line of differentiation from any server-side alternative.

Export: SheetJS generates an .xlsx that reproduces the structured summary layout a country actually submits, plus CSV and a print stylesheet for PDF. Every export carries a provenance block naming the data snapshot date, the tool version, the selected configuration, and the list of assumptions requiring sign-off.

Persistence: configuration encodes into the URL, with a local draft in browser storage. No server-side storage of user figures in version 1.

## Capabilities the Excel cannot offer

1. Drill down from any Table 4 cell to the exact serial number blocks that produced it, with links to each underlying authorisation.
2. Side by side comparison of the all-authorisations and CARP-only scopes, which currently requires re-running the workbook and manually diffing.
3. A validation panel that lists every interpretive assumption affecting the current country, drawn from the `Notes` sheet and the explanation column, as a sign-off checklist.
4. Snapshot diffing, so a country can see exactly which credits entered or left the dataset between the 14 August 2026 cutoff and any later refresh.
5. A warning surface. Silent zeros become visible errors.
6. Offline operation after first load.

## Data pipeline

The extraction from the workbook is scripted and repeatable: openpyxl parses both the cached-value and formula views, emits `credits.json` and `credits.csv` plus a `tool_meta.json` capturing the cover text, the twelve Table 4 row labels, all explanation text, every validation list, the country notes, and the change log. Re-running against a future workbook release produces a new snapshot and a diff. That script is the ingestion path until Gold Standard and Verra publish something machine readable.

# Build plan

| Stage | Output |
|---|---|
| 1 | Calculation engine in TypeScript, with the Tanzania fixture and per-country regression tests |
| 2 | Data snapshot pipeline and manifest, versioned by cutoff date |
| 3 | Application shell, country and configuration selection, structured summary view |
| 4 | Drill-down, validation panel, scope comparison |
| 5 | Export to xlsx, CSV, and PDF with the provenance block |
| 6 | Cloudflare deployment, custom domain, analytics |
| 7 | Positioning content and launch |

# Open decisions

1. Positioning. A neutral free public utility carrying light attribution reaches host countries and standards bodies fastest and builds standing with both. A branded product with gated features monetises sooner but narrows adoption among exactly the government users who most need it. This choice determines the marketing content and should be settled before stage 3.
2. Relationship with Gold Standard and Verra. Publishing a corrected engine that contradicts their released workbook on Gambia and Sierra Leone is more useful, and better received, if the finding goes to David Hynes and Liz Guinessey first. They invited exactly this kind of report (2).
3. Scope beyond the two programmes. The workbook covers Gold Standard and Verra only. Host country authorisations also exist under other standards and bilateral arrangements. Whether the tool aspires to full national coverage changes the data model, since it would need a source field and a confidence marker per row.
4. Naming convention. Documents in this project are named `[Source]_MSI_[ContentType]_[Descriptor]_v[N]`. This document uses `SIQ` as the source for material we author and would use `GSVerra` for material that reproduces their content. Confirm or correct.

# References

1. Verra. Gold Standard and Verra Launch Tool to Support Article 6.2 Reporting. 20 August 2026. https://verra.org/gold-standard-and-verra-launch-tool-to-support-article-6-2-reporting/
2. Gold Standard and Verra. Article-6.2-CA-Reporting-Tool_v1.xlsx, version 1.0, 20 August 2026, data cutoff 14 August 2026.
3. UNFCCC. Decision 2/CMA.3, Guidance on cooperative approaches referred to in Article 6, paragraph 2, of the Paris Agreement, annex, section III.B. https://unfccc.int/sites/default/files/resource/cma3_auv_12a_PA_6.2.pdf
4. UNFCCC. Article 6.2 Reference Manual for the accounting, reporting and review of cooperative approaches. https://unfccc.int/sites/default/files/resource/Article_6.2_Reference_Manual.pdf
5. Cloudflare. Workers developer documentation. https://developers.cloudflare.com/workers/
6. UNFCCC. Decision 5/CMA.3, Guidance operationalizing the modalities, procedures and guidelines for the transparency framework, annex, Table 4. https://unfccc.int/sites/default/files/resource/cma3_auv_5_transparency.pdf
7. UNFCCC. Second Biennial Transparency Reports. https://unfccc.int/second-biennial-transparency-reports
8. UNFCCC. Technical expert review report, Zimbabwe, 2025. https://unfccc.int/sites/default/files/resource/irterr2025_ZWEa01.pdf
