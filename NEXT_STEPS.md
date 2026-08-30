# Next steps

Working folder: `~/Projects/MyScripts/article6.2_tool`. Run everything below in the VSCode terminal.

All git commands are yours to run, not Cowork's. Cowork cannot delete files on this machine, and git
deletes constantly (lock files, temp objects). Every time Cowork has run git here it has left a lock
behind that blocked the next commit. Restoring files is safe; running git is not.

## What state this folder is in

The zip downloaded on 2026-08-30 was verified byte-identical to `Article6_workbench_repo.zip`, the
bundle from the 25 August session. All thirteen files matched exactly. It was the same build, not a
newer one.

That zip did not include `.gitignore`, `docs/`, `data/source/` or `reference/`. Those have been
restored from `MyDrive/cowork_files/Article6_gs_verra/`. The tree now holds 22 files. Tests pass:
14 of 14.

## 1. Clear the lock and initialise git

Cowork left `.git/index.lock` while checking what git would stage. Remove it first.

```bash
cd ~/Projects/MyScripts/article6.2_tool
rm -f .git/*.lock
git status                       # should list untracked files, no errors
```

`.git` exists and `origin` is already set to the right repository, so `git init` and
`git remote add` are not needed. If you run them anyway, git will say "reinitialized" and
"remote origin already exists"; both are harmless.

## 2. Check what will be committed, before committing

This is the step that matters. `npm install` has already run, so `node_modules/` is on disk with
thousands of files. The restored `.gitignore` excludes it.

```bash
git add -A
git status --short | wc -l       # expect 22, not thousands
```

If that number is in the thousands, stop: `.gitignore` is not being read. Do not push.

## 3. Commit and push

```bash
git commit -m "Article 6.2 corresponding adjustments workbench"
git branch -M main
git push -u origin main
```

GitHub should then show 22 files.

## 4. Deploy the real thing

Skip the small drag-and-drop demo zip. Its `index.html` is byte-identical to `public/index.html`,
and `npm run deploy` publishes `public/` for you.

```bash
npx wrangler login
npx wrangler d1 create article6      # copy database_id into wrangler.jsonc, replacing PASTE_DATABASE_ID_HERE
npm run db:migrate
npm run db:seed
npm run deploy
```

Verify the data landed:

```bash
npx wrangler d1 execute article6 --remote --command "SELECT COUNT(*), SUM(volume) FROM credit_blocks"
```

Expect 601 and 23,240,850. Then open `https://<your-worker-url>/api/parties`, which should return
fourteen Parties. The API routes actually implemented in `src/index.js` are `/api/health`,
`/api/snapshots`, `/api/dataset`, `/api/parties`, `/api/credits` and `/api/notes`.

## 5. Custom domain

Cloudflare dashboard, open the project, Custom domains, add `article6.sustainableiq.tech`. Worth
doing before showing Gold Standard or Verra.

## 6. Only then, clear the Drive fallback

`MyDrive/cowork_files/Article6_gs_verra/_to_delete/` is the safety net that made today's recovery
possible. Leave it until the push has succeeded and the site is live. Keep
`Article6_gs_verra/article6_tool/` permanently: it holds the source workbook.

## What is in this repo beyond the application

```
docs/handover_2026-08-25.md            verified calculation logic, Tanzania fixture, fourteen-country
                                       regression set, findings, architecture decision. Not reproducible.
docs/SIQ_MSI_Spec_CAToolRebuild_v1.md  rebuild specification
docs/marketing_headline_draft.md       positioning draft
data/source/                           the source workbook and its extracted metadata
reference/engine.py                    verified Python engine, the specification of record
reference/UNTESTED_prototype.html      first-session layout sketch, never run
```

If `shared/engine.mjs` and `reference/engine.py` ever disagree, the Python is right until proven
otherwise. It is the implementation that was reconciled cell by cell against the workbook.
