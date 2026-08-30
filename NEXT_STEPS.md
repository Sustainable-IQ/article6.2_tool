# Where this stands, and what is left

Last updated 2026-08-30, after the first successful deploy.

## Done

- Repository pushed to https://github.com/Sustainable-IQ/article6.2_tool, branch `main`, 23 files.
- Worker deployed and live at https://article6-ca-workbench.admindynamo.workers.dev
- D1 database `article6` created, schema applied, seed loaded.
- Data verified against the source workbook: 601 credit blocks, total volume 23,240,850. Exact match.
- Tests pass locally: 14 of 14, seven engine and seven API.

Cloudflare account in use: `1b72e4972bf0dd6b7818dd04284725ab` (admindynamo@proton.me).
D1 database id: `9fb0ecbc-f40e-4409-b3cb-693bd83565b2`. Both are pinned in `wrangler.jsonc`.

## Rules for this machine, learned the hard way

1. Run wrangler in **Terminal.app**, not the VSCode integrated terminal. VSCode's Python extension
   injects `source ~/Projects/dev-env/bin/activate` into the terminal, which steals confirmation
   prompts and kills long-running commands mid-execution. It broke `wrangler d1 execute` four times.
   To fix permanently, turn off `python.terminal.activateEnvironment` in VSCode settings.
2. `wrangler d1 execute` needs `--yes` or it will hang on a confirmation prompt.
3. Schema before seed, always. `0001_schema.sql` creates the tables; `0002_seed_*.sql` fills them.
   Running the seed first fails with `no such table: credit_blocks`. Both are safe to re-run: the
   schema opens with DROP TABLE IF EXISTS, the seed with DELETE.
4. Your shell is zsh. Do not paste command blocks that contain `#` comments; zsh passes them to the
   command as arguments rather than ignoring them.

## Step 1: confirm the site is serving live data

Open in a browser:

    https://article6-ca-workbench.admindynamo.workers.dev/api/parties

Fourteen Parties in JSON means the Worker is reading from D1. Then open the site root; it should now
show live data rather than the snapshot embedded in the page. If `/api/parties` returns 503, the
Worker lost its database binding: re-run `npm run deploy` from Terminal.app.

## Step 2: commit the configuration

`wrangler.jsonc` gained the account id and database id after the last commit. Check and commit:

    git status

If `wrangler.jsonc` or `NEXT_STEPS.md` appear as modified:

    git add wrangler.jsonc NEXT_STEPS.md
    git commit -m "Pin Cloudflare account and D1 database id, update status"
    git push

Neither id is a secret. Cloudflare's own documentation commits both.

## Step 3: decide where this tool permanently lives

The handover records Cloudflare account `5523ce34c91c1ae9a01d0d2742fd8ecd`, which the current login
cannot reach. It either belongs to a different Cloudflare login, or it was recorded wrongly. Resolve
this before showing the tool to Gold Standard or Verra, because it determines the permanent home and
the custom domain.

Check the Websites list in the Cloudflare dashboard for account `1b72e4972bf0dd6b7818dd04284725ab`.

If `sustainableiq.tech` is in this account: open the Worker, Settings, Domains and Routes, add
`article6.sustainableiq.tech`. Live in about a minute.

If it is not: either move the domain into this account, or redeploy the Worker into the account that
holds the domain. Redeploying elsewhere costs one `wrangler d1 create`, one schema run and one seed
run, roughly five minutes, and loses nothing, because the data is a SQL file in this repository.

## Step 4: clean up

Safe to delete now that the site is live and verified:

- `~/Projects/_to_delete_2026-08-30/`
- `~/MyDrive/cowork_files/Article6_gs_verra/_to_delete/`

Keep permanently: `~/MyDrive/cowork_files/Article6_gs_verra/article6_tool/`, which holds the source
workbook, and `05_marketing/` for the positioning content still to be written.

## Refreshing the data when Gold Standard and Verra publish a new workbook

    python3 tools/extract.py <new-workbook.xlsx>
    python3 tools/make_seed.py <new-snapshot.json> <new-cutoff-date>
    npx wrangler d1 execute article6 --remote --yes --file=./migrations/0003_seed_<date>.sql

Snapshots coexist in the database. `is_current` picks the default, and older snapshots stay queryable,
so a Party can see exactly what changed between the cutoff it reported against and today.

## Still open

- Coverage beyond Gold Standard and Verra: whether to model source and confidence fields ready to
  absorb ART, ACR, CAR, Article 6.4 units and national registries.
- Scenario comparison as a first-class feature rather than a later addition.
- The snapshot diff, which is the capability the tool argues for and cannot yet show.
- Whether to notify David Hynes at Gold Standard and Liz Guinessey at Verra of the defects documented
  in `docs/handover_2026-08-25.md` before or at publication.
