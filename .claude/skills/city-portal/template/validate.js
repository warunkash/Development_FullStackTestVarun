// Usage: node validate.js   — structural + translation checks on data.js and lang-*.js. Exit 1 on errors.
const fs = require("fs");
const path = require("path");
global.window = {};
const dir = __dirname;
require(path.join(dir, "config.js"));
require(path.join(dir, "data.js"));
require(path.join(dir, "lang-en.js"));
const P = window.PORTAL;
const langs = P.languages.filter(l => l.code !== "en").map(l => l.code);
for (const c of langs) {
  if (!fs.existsSync(path.join(dir, `lang-${c}.js`))) { console.error(`ERROR missing lang-${c}.js`); process.exit(1); }
  require(path.join(dir, `lang-${c}.js`));
}
const errors = [], warns = [];
const E = m => errors.push(m), W = m => warns.push(m);
const areas = [P.localArea, P.stateArea, P.centralArea];
const status = ["ok", "blocked", "down"];
const seen = new Map();
const labels = { area: new Set(), sector: new Set(), dept: new Set() };

window.SITES.forEach((s, i) => {
  const id = `#${i} ${s.n || "?"}`;
  for (const k of ["n", "d", "u", "area", "dept", "sector", "status"]) if (!s[k] || typeof s[k] !== "string") E(`${id}: missing/invalid "${k}"`);
  if (s.u && !/^https?:\/\/[^\s]+$/.test(s.u)) E(`${id}: bad url ${s.u}`);
  if (s.u) { const key = s.u.replace(/\/+$/, "").toLowerCase(); if (seen.has(key)) E(`${id}: duplicate url of #${seen.get(key)}`); else seen.set(key, i); }
  if (s.area && !areas.includes(s.area)) E(`${id}: area "${s.area}" not one of config areas`);
  if (s.status && !status.includes(s.status)) E(`${id}: status "${s.status}" not in ${status}`);
  if (s.d && s.d.length > 200) W(`${id}: purpose is long (${s.d.length} chars)`);
  for (const k of ["area", "sector", "dept"]) if (s[k]) labels[k].add(s[k]);
  for (const c of langs) {
    const t = s.tr && s.tr[c];
    if (!t || !t.n || !t.d) E(`${id}: missing tr.${c}.n / tr.${c}.d`);
  }
});
window.HELPLINES.forEach((h, i) => {
  if (!h.num || !h.n) E(`helpline #${i}: needs num and n`);
  for (const c of langs) if (!h.tr || !h.tr[c]) E(`helpline ${h.num}: missing tr.${c}`);
});
const enKeys = Object.keys(window.I18N.en).sort().join();
for (const c of langs) {
  const L = window.I18N[c];
  if (!L) { E(`lang-${c}.js did not register I18N.${c}`); continue; }
  const miss = Object.keys(window.I18N.en).filter(k => !(k in L));
  if (miss.length) E(`lang-${c}.js missing keys: ${miss.join(", ")}`);
  for (const k of ["area", "sector", "dept"]) for (const v of labels[k]) if (!L.map || !L.map[v]) E(`lang-${c}.js map missing ${k} label "${v}"`);
}
const counts = window.SITES.reduce((a, s) => (a[s.status] = (a[s.status] || 0) + 1, a), {});
console.log(`${window.SITES.length} sites, ${window.HELPLINES.length} helplines, languages: en${langs.map(c => "," + c).join("")}; status ${JSON.stringify(counts)}`);
warns.forEach(m => console.log("warn  " + m));
errors.forEach(m => console.error("ERROR " + m));
if (errors.length) { console.error(`${errors.length} error(s)`); process.exit(1); }
console.log("valid");
