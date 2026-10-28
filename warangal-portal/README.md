# Warangal Citizen Portal

Static, dependency-free directory of government websites useful to residents of Warangal and Hanumakonda (local, Telangana state, Government of India). Open `index.html`, or serve with `python3 -m http.server`.

- Add or edit sites in `data.js` (`c` category, `l` level: local/state/central).
- `node check-links.js` reports HTTP status for each link (Node 18+; needs direct internet access).
- Links were compiled from public listings and not all were live-verified; run the checker before publishing.

## Link status (checked 2026-10-28)
Each site in `data.js` has `area`, `dept`, `sector` and `status` fields; the page can group by any of them.
- `ok` (20): responded 200.
- `blocked` (5): server answered 403/406 to the automated check (ABDM, TGBIE, IRCTC, UNESCO, Voters' portal); likely fine in a browser.
- `down` (17): no response from the cloud sandbox used for checking (GWMC, NIT Warangal, Kakatiya Univ., Aarogyasri, MeeSeva, Tourism, Registration, Civil Supplies, Agriculture, Health, SSC Board, eCourts, PM-JAY, PM-KISAN, India.gov.in, plus the unconfirmed Bhu Bharati and Warangal Police URLs). Likely geo-blocking, so this is not proof they are dead.
Dharani was replaced by Bhu Bharati (Apr 2025). Run `node check-links.js` from an Indian/unrestricted network to refresh statuses, then update `status` in `data.js`.
