"""Reimplementation of the Structured Summary calculation engine from
Article-6.2-CA-Reporting-Tool_v1.xlsx, used to reconcile against cached values."""
import json
from collections import defaultdict

YEARS = [2021, 2022, 2023, 2024, 2025, 2026]
CREDITS = json.load(open("/home/claude/article6/data/credits.json"))


def calc(country, target_type, method, latest_inventory_year, carp_scope,
         inventory=None, trajectory=None, itmos_used=None):
    """inventory/trajectory/itmos_used: dicts keyed by year (row 5, row 3/4, row 9)."""
    inventory = inventory or {}
    itmos_used = itmos_used or {}

    def rows_for(pred):
        for r in CREDITS:
            if r["Country"] != country:
                continue
            if carp_scope == "CARP" and r["Authorisation uploaded to the CARP"] != "Yes":
                continue
            if pred(r):
                yield r

    def total(pred):
        return sum(r["Volume"] for r in rows_for(pred))

    r7, r8, r9, r10, r12 = {}, {}, {}, {}, {}
    for y in YEARS:
        # Row 7: first transfers where authorised for NDC
        r7[y] = (
            total(lambda r, y=y: r["Authorised for NDC?"] == "Yes"
                  and r["OIMP First Transfer Definition"] == "Authorisation"
                  and int(r["Authorisation Year"]) == y)
            + total(lambda r, y=y: r["Authorised for NDC?"] == "Yes"
                    and r["OIMP First Transfer Definition"] == "Issuance"
                    and int(r["Issuance Year"]) == y)
        )
        # Row 8: first transfers authorised only for (O)IMP
        r8[y] = (
            total(lambda r, y=y: r["Authorised for NDC?"] == "No"
                  and r["OIMP First Transfer Definition"] == "Authorisation"
                  and int(r["Authorisation Year"]) == y)
            + total(lambda r, y=y: r["Authorised for NDC?"] == "No"
                    and r["OIMP First Transfer Definition"] == "Issuance"
                    and int(r["Issuance Year"]) == y)
        )
        r9[y] = itmos_used.get(y, 0)
        r10[y] = (r7[y] + r8[y]) - r9[y]

    # Row 11: averaging
    r11 = {}
    averaging = (target_type == "Single-year" and method == "Averaging")
    elapsed = sum(1 for y in YEARS if y <= latest_inventory_year)
    avg = sum(r10.values()) / elapsed if elapsed else 0
    for y in YEARS:
        if target_type == "Multi-year" or method == "Annual Adjustments/Trajectory":
            r11[y] = "N/A"
        elif averaging and y <= latest_inventory_year:
            r11[y] = avg
        else:
            r11[y] = ""

    # Row 12: total corresponding adjustments
    for y in YEARS:
        if averaging:
            r12[y] = r11[y]
        else:
            # NOTE: no NDC / (O)IMP / first-transfer-definition filter here.
            r12[y] = total(lambda r, y=y: int(r["Vintage"]) == y) - r9[y]

    # Row 13: cumulative net
    r13, run = {}, 0
    for y in YEARS:
        run += r10[y]
        r13[y] = run

    # Row 14: emissions balance
    r14 = {}
    for y in YEARS:
        if isinstance(r12[y], (int, float)) and y <= latest_inventory_year:
            r14[y] = inventory.get(y, 0) - r12[y]
        else:
            r14[y] = ""

    return {7: r7, 8: r8, 9: r9, 10: r10, 11: r11, 12: r12, 13: r13, 14: r14}


if __name__ == "__main__":
    meta = json.load(open("/home/claude/article6/data/tool_meta.json"))
    cached = {r["excel_row"]: r["cached_values"] for r in meta["structured_summary_rows"]}

    print("=== RECONCILIATION: Tanzania, Single-year, Annual Adjustments/Trajectory, inv 2024, All ===")
    got = calc("Tanzania", "Single-year", "Annual Adjustments/Trajectory", 2024, "All")
    ok = True
    for row in [7, 8, 10, 11, 12, 13, 14]:
        for y in YEARS:
            c = cached[row].get(str(y))
            g = got[row][y]
            c_n = 0 if c is None else c
            g_n = 0 if g == "" else g
            match = (str(c_n) == str(g_n)) or (isinstance(c_n, (int, float)) and isinstance(g_n, (int, float)) and abs(c_n - g_n) < 0.5)
            if not match:
                ok = False
                print(f"  MISMATCH row {row} {y}: workbook={c!r} engine={g!r}")
    print("  ALL ROWS MATCH" if ok else "  DIFFERENCES ABOVE")

    print("\n=== ALL COUNTRIES (single-year / trajectory / inv 2024 / All), no user inputs ===")
    print(f"{'Country':<15}{'r7 first transf':>16}{'r8 OIMP-only':>14}{'r12 total CA':>14}{'r13 cumul':>12}")
    countries = sorted({r["Country"] for r in CREDITS})
    for c in countries:
        g = calc(c, "Single-year", "Annual Adjustments/Trajectory", 2024, "All")
        print(f"{c:<15}{sum(g[7].values()):>16,}{sum(g[8].values()):>14,}"
              f"{sum(v for v in g[12].values() if isinstance(v,(int,float))):>14,}{g[13][2026]:>12,}")

    print("\n=== FIRST-TRANSFER-DEFINITION LEAKAGE CHECK ===")
    for c in countries:
        fit = sum(r["Volume"] for r in CREDITS
                  if r["Country"] == c and r["OIMP First Transfer Definition"] == "First international transfer")
        if fit:
            g = calc(c, "Single-year", "Annual Adjustments/Trajectory", 2024, "All")
            print(f"{c}: {fit:,} t under 'First international transfer' -> excluded from rows 7/8 "
                  f"(r7+r8={sum(g[7].values())+sum(g[8].values()):,}) but row 12 total = "
                  f"{sum(v for v in g[12].values() if isinstance(v,(int,float))):,}")

    print("\n=== CARP SCOPE SENSITIVITY (row 12 totals) ===")
    for c in countries:
        a = sum(v for v in calc(c, "Single-year", "Annual Adjustments/Trajectory", 2024, "All")[12].values() if isinstance(v,(int,float)))
        b = sum(v for v in calc(c, "Single-year", "Annual Adjustments/Trajectory", 2024, "CARP")[12].values() if isinstance(v,(int,float)))
        if a != b:
            print(f"{c:<15} All={a:>12,}   CARP-only={b:>12,}   delta={a-b:>12,}")
