// English UI strings, built from config.js. Every other lang-<code>.js must define the same keys.
(function () {
  const P = window.PORTAL;
  window.I18N = window.I18N || {};
  window.I18N.en = {
    title: `${P.location} Citizen Portal`,
    sub: `Local, ${P.stateName} and ${P.countryName} government websites for residents of ${P.localPlaces} — grouped by sector, department, area and link status.`,
    search: "Search by title, purpose, department… e.g. property tax, ration card",
    groupBy: "Group by", area: "Area", status: "Status", all: "All",
    sector: "Sector", dept: "Department", areaK: "Area", statusK: "Status",
    none: "No matching sites.", help: "Emergency & helplines (tap to call)",
    sum: (t, a, b, c) => `${t} sites · ${a} working · ${b} reachable but block bots · ${c} not reachable (from test)`,
    foot: d => `Unofficial directory; not run by any government body. Status reflects a single automated check on ${d} from outside ${P.countryName}: "Not reachable" means no response from the test environment (often geo-blocking), not that the site is permanently down. Verify before entering personal data.`,
    st: { ok: "Working", blocked: "Reachable (blocks bots)", down: "Not reachable" },
    stTip: { ok: "Responded normally", blocked: "Server answered but rejects automated checks; likely works in a browser", down: "No response from the test environment; may be geo-blocked or moved" },
    map: {}
  };
})();
