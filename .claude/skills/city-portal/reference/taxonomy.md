# Data schema and taxonomy

## Site entry (`data.js` → `window.SITES`)
```json
{ "n": "Title", "d": "One sentence on what a resident does here.",
  "u": "https://official.example.gov.in/", "area": "<config area>",
  "dept": "Department", "sector": "Sector", "status": "ok|blocked|down",
  "tr": { "te": { "n": "…", "d": "…" } } }
```
- `n`: official name, shortened if needed; `d`: purpose in ≤ 160 chars, verb-led, no marketing.
- `area`: exactly one of `config.js` `localArea`, `stateArea`, `centralArea`.
- URLs: https where the site supports it; unique (validator rejects duplicates, ignoring trailing slash).
- Deep links into an official district site are good entries (one page per department).

## Helpline (`window.HELPLINES`)
`{ "num": "112", "n": "Emergency (Police, Fire, Ambulance)", "tr": { "te": "…" } }`. Only numbers you can source.

## Sectors (reuse; add sparingly)
Governance · Education · Employment · Health · Utilities · Transport · Land & Revenue · Citizen Services · Welfare & Agriculture · Identity & Taxes · Grievance & Rights · Tourism & Culture.

## Departments
Free text but consistent: use the department's English name as the official site gives it, with the acronym in brackets when residents know it (e.g. "Municipal Administration (GWMC)"). Reuse the exact string across entries so grouping works. Every department string needs a translation in each `lang-*.js` `map`.

## Areas
Three levels, always in this order: local (city/district, optionally "A / B" for twin places), state, national.

## Status
`ok` answered normally · `blocked` answered 401/403/406/429 to automation (likely fine in a browser) · `down` no response from the checking environment. Footer text must say status comes from an automated check from outside the country.
