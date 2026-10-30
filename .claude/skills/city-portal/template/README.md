# {{LOCATION}} Citizen Portal

Static, dependency-free directory of government websites for {{LOCAL_PLACES}}: local, {{STATE}} state and {{COUNTRY}} national. Open `index.html`, or serve with `python3 -m http.server`.

- `config.js` — location names, area labels, accent colour, languages.
- `data.js` — `SITES` (title `n`, purpose `d`, `u`, `area`, `dept`, `sector`, `status`, `tr.<lang>.{n,d}`) and `HELPLINES`.
- `lang-*.js` — UI strings and label translations per language.
- `node validate.js` — structure and translation checks (run before every commit).
- `node check-links.js [--report f] [--update]` — link status; see the file header.

Status: `ok` = responded; `blocked` = server answered 401/403/406/429 to automation; `down` = no response from the checking environment (may be geo-blocking, not proof the site is dead).
Telugu/other-language text is machine-drafted unless noted: have a native speaker review it.
