// Copy to lang-<code>.js (e.g. lang-te.js), translate every value, and list the language in config.js.
// Keep the keys identical to lang-en.js. `map` translates the English area / sector / department labels
// used in data.js (validate.js lists any that are missing). Have a native speaker review machine-drafted text.
(function () {
  const P = window.PORTAL;
  window.I18N = window.I18N || {};
  window.I18N["xx"] = {
    title: `${P.location} …`,
    sub: "…",
    search: "…",
    groupBy: "…", area: "…", status: "…", all: "…",
    sector: "…", dept: "…", areaK: "…", statusK: "…",
    none: "…", help: "…",
    sum: (t, a, b, c) => `${t} … ${a} … ${b} … ${c} …`,
    foot: d => `… ${d} …`,
    st: { ok: "…", blocked: "…", down: "…" },
    stTip: { ok: "…", blocked: "…", down: "…" },
    map: {
      // "Governance": "…", "Health": "…", "<every dept string used in data.js>": "…"
    }
  };
})();
