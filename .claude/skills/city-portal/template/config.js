// Edit these once per location. The three area strings are stored on every site in data.js, so keep them in sync.
window.PORTAL = {
  location: "{{LOCATION}}",            // short name used in the title, e.g. "Warangal"
  localPlaces: "{{LOCAL_PLACES}}",     // places served, e.g. "Warangal & Hanumakonda"
  stateName: "{{STATE}}",              // e.g. "Telangana"
  countryName: "{{COUNTRY}}",          // e.g. "India"
  localArea: "{{LOCAL_AREA}}",         // area label for city/district sites
  stateArea: "{{STATE_AREA}}",         // area label for state-level sites
  centralArea: "{{CENTRAL_AREA}}",     // area label for national sites
  accent: "{{ACCENT}}",                // accent colour (light mode); dark mode uses accentDark
  accentDark: "{{ACCENT_DARK}}",
  // English is always present. Add one entry per extra language and a matching lang-<code>.js file.
  languages: {{LANGUAGES_JSON}}
};
