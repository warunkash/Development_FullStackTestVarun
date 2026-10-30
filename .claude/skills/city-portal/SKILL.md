---
name: city-portal
description: Build, verify, translate, publish and maintain a unified citizen portal of government websites for any city, town or district (local + state + national), as a static site on GitHub Pages with sector/department/area/status grouping, language toggle, emergency helplines and a weekly link-check. Use when the user asks for a "portal", "directory" or "one place" for the government sites/services of a named location (e.g. "do the same for Karimnagar"), or to extend/refresh an existing portal made with this skill.
argument-hint: <location> [state] [languages]
---

# City Portal

Delivers the same thing built for Warangal (see `warangal-portal/` in this repo as the worked example): a static, searchable, bilingual directory of official sites for one location, grouped by **sector, department, area and link status**, deployed to GitHub Pages and kept honest by a weekly link check.

The template, validator and link checker live in this skill (`template/`, `scripts/`). Read `reference/lessons.md` before researching: it records what went wrong and what worked.

## Inputs (collect, with defaults, then proceed)
Ask only for what you cannot infer; otherwise state your assumptions and go.
- **Location** (city/district) and nearby places it should cover (e.g. twin cities, new/old district names).
- **State/province and country** (default: infer from the location; national starter list is India's).
- **Extra languages** besides English (default: the state's main language). English is always present.
- **Target repo/branch/folder** (default: current repo, folder `<location>-portal/`).
- **Merge policy**: merge your own PRs only if the user has said so in this conversation or a standing instruction; otherwise stop at a ready PR and ask once.

## Workflow

### 1. Scaffold
```
python3 -I .claude/skills/city-portal/scripts/scaffold.py --out <slug>-portal \
  --location "<Name>" --local-places "<A & B>" --state "<State>" [--country India] \
  --lang <code>:<native name>   # repeat per extra language
```
Creates `config.js`, `data.js` (17 starter national sites + 8 helplines), `index.html`, `lang-en.js`, `check-links.js`, `validate.js`, `README.md` and `.github/workflows/link-check-<slug>.yml`. Non-India: delete the starter national sites and helplines and research your own.

### 2. Research sources (see `reference/research-playbook.md`)
Order of trust: the **official district/city site's own navigation and "external links"** > the state portal directory > national portals > web-search snippets (hints only, often wrong or stale). Use WebFetch on the official district site: it lists departments, public-utility pages and the external services it endorses, and it usually loads even when `curl` from the sandbox is blocked. Capture for every site: title, one-sentence purpose, URL, area, department, sector.

Include only government/public-body sites a resident would use. Leave out private colleges, news articles, wikis and anything whose official URL you cannot establish. Note renamed or replaced services (e.g. Dharani → Bhu Bharati) and use the current one.

### 3. Fill `data.js`
Schema and taxonomy: `reference/taxonomy.md`. Areas must equal the three strings in `config.js`. Write English `n`/`d` first, then add translations under `tr.<code>.{n,d}` for every site and `tr.<code>` for every helpline. Reuse the standard sector names so labels group well.

### 4. Language files
For each extra language copy `template/lang-example.js` to `<slug>-portal/lang-<code>.js`, register `I18N["<code>"]`, translate every UI string, and fill `map` with a translation for every area, sector and department label used (`node validate.js` lists any missing). State in the PR and final report that the text is machine-drafted and needs native review.

### 5. Verify links honestly
- Test each URL with retries: `curl -sS -L -m 20 -A 'Mozilla/5.0' -w '%{http_code}'`, 3 tries before calling it unreachable. In this sandbox Indian government hosts often fail with connection reset: that is **geo/proxy blocking, not proof of a dead link**.
- Status: `ok` (answered), `blocked` (401/403/406/429), `down` (no response). Only a **404/410 is "dead"**: fix or remove those.
- Fix wrong URLs from evidence (redirect targets, the official site's own link) never by guessing.
- Optionally `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node <dir>/check-links.js --update` to write statuses; it rewrites `data.js`, so review the diff.

### 6. QA before shipping
1. `node <dir>/validate.js` must print `valid` (schema, duplicate URLs, translations, label maps).
2. Headless browser test with Playwright (`require('playwright')`, chromium preinstalled): load `index.html`, switch language, switch Group-by, search, assert card counts and no `pageerror`. Take one phone-width screenshot.
3. Re-read helpline numbers; they change (Telangana moved to a unified 112 in 2025). Only include numbers you can source; say they must be confirmed locally.

### 7. Publish
- Work on a branch from the repo's real default branch (check `git remote show origin`; it was `master`, not `main`).
- GitHub Pages allows **one site per repo**. If a Pages workflow already exists, add the portal to it (copy the folder to `_site/<slug>-portal/`, exclude `check-links.js`/`README.md`, add the folder to the `paths:` trigger); never create a second Pages workflow, it would overwrite the existing site. If none exists, create `deploy-pages.yml` that uploads the folder.
- Open a PR (draft per environment rules), subscribe to its activity, fix CI/review findings. Merge only per the merge policy above, then unsubscribe.
- After merge: confirm the Pages deploy run succeeded, `curl` the live URL and key files (200, contains the language toggle), and run the link-check workflow once (`workflow_dispatch`); it should open one tracking issue listing regressions/recoveries. Read it, and update statuses via a small PR if warranted.

### 8. Report
Give the live URL and facts, not adjectives: number of sites by status, what was verified vs only sourced, what was left out and why, and the user's remaining actions (check links from inside the country, native-language review, confirm helplines). Offer the next increments: sibling district site, more departments, PWA/offline, "suggest a site" link.

## Maintaining an existing portal
Add sites in `data.js` → `validate.js` → PR. Status changes come from the weekly issue: confirm manually before editing. A site that is `down` but recovers is the useful signal; do not turn `down` into "removed" without a 404/410 or an official replacement.

## Do not
- Mark a site dead because the sandbox could not reach it.
- Invent URLs, helplines, department names or translations and present them as verified.
- Add private/commercial sites, or personal data of any official.
- Create a second Pages workflow in a repo that already deploys Pages.
- Merge without the stated permission, or change repo/org settings beyond the task.
