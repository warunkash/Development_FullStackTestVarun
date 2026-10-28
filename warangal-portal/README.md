# Warangal Citizen Portal

Static, dependency-free directory of government websites useful to residents of Warangal and Hanumakonda (local, Telangana state, Government of India). Open `index.html`, or serve with `python3 -m http.server`.

- Add or edit sites in `data.js` (`c` category, `l` level: local/state/central).
- `node check-links.js` reports HTTP status for each link (Node 18+; needs direct internet access).
- Links were compiled from public listings and not all were live-verified; run the checker before publishing.

## Link verification (2026-10-28)
Checked from a cloud sandbox with `curl`. 200: warangal/hanumakonda district sites, telangana.gov.in, TGSRTC, Transport, TGNPDCL, TG ePASS, TGPSC, SCR, UIDAI, DigiLocker, UMANG, Passport, Income Tax, GST, CPGRAMS, RTI, MyGov, Parivahan, ASI. 403 (bot-blocked, likely fine): ABDM, TGBIE, IRCTC, UNESCO.
Unreachable from the sandbox (connection refused/reset — likely network policy or geo-blocking, not proof they are dead): GWMC, NIT Warangal, Kakatiya Univ., Aarogyasri, MeeSeva, Tourism, Registration, Civil Supplies, Agriculture, Health, SSC Board, eCourts, PM-JAY, PM-KISAN, Voters' portal, India.gov.in.
Changes: Dharani was deactivated and replaced by Bhu Bharati (Apr 2025); police link now `warangalpolice.telangana.gov.in` (per Wikipedia). Both new URLs are unverified — please open them.
