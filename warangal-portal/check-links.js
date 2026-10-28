// Usage: node check-links.js  — reports HTTP status for every site in data.js
global.window = {};
require("./data.js");
(async () => {
  for (const s of window.SITES) {
    try {
      const r = await fetch(s.u, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(15000) });
      console.log(r.status, s.n, s.u);
    } catch (e) { console.log("ERR", s.n, s.u, e.cause?.code || e.message); }
  }
})();
