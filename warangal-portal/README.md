# Warangal Citizen Portal

Static, dependency-free directory of government websites useful to residents of Warangal and Hanumakonda (local, Telangana state, Government of India). Open `index.html`, or serve with `python3 -m http.server`.

- Add or edit sites in `data.js` (`c` category, `l` level: local/state/central).
- `node check-links.js` reports HTTP status for each link (Node 18+; needs direct internet access).
- Links were compiled from public listings and not all were live-verified; run the checker before publishing.

## Link status (checked 2026-10-28)
Each site in `data.js` has `area`, `dept`, `sector` and `status` fields; the page can group by any of them.
- `ok` (25): responded 200.
- `blocked` (4): server answered 403/406 to the automated check (ABDM, TGBIE, IRCTC, Voters' portal); likely fine in a browser.
- `down` (16): no response from the cloud sandbox used for checking (GWMC, NIT Warangal, Kakatiya Univ., Aarogyasri, MeeSeva, Tourism, Registration, Civil Supplies, Agriculture, Health, SSC Board, eCourts, PM-JAY, PM-KISAN, plus the unconfirmed Bhu Bharati and Warangal Police URLs). Likely geo-blocking, so this is not proof they are dead.
Dharani was replaced by Bhu Bharati (Apr 2025). Run `node warangal-portal/check-links.js` from an Indian/unrestricted network to refresh statuses, then update `status` in `data.js`.

## Language & hosting
- English/Telugu toggle (`i18n.js` for UI + label translations; `tn`/`td` in `data.js` for site titles/purposes). Telugu is machine-drafted — please have a native speaker review it. Use `?lang=te` to open in Telugu.
- Deployed via `.github/workflows/deploy-pages.yml` to `https://<owner>.github.io/<repo>/warangal-portal/` alongside the other apps (one Pages site per repo).

## Weekly link check
`.github/workflows/link-check.yml` runs `check-links.js` every Monday (and on demand from the Actions tab). It compares each live result with the recorded `status` and opens/updates one issue, "Warangal portal: weekly link check", listing: dead links (404/410), regressions (was `ok`, now failing) and recoveries (was not working, now `ok`). With no changes it stays quiet and closes an open issue. It never edits `data.js` itself — GitHub runners are outside India, so a human confirms before changing a status.
