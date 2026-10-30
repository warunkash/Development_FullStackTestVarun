// Usage: node check-links.js [--report report.md] [--update]
// Fetches every site in data.js, compares with its recorded `status`, and prints a markdown report.
//   --report <file>  also write the report (empty file when nothing changed)
//   --update         rewrite `status` and CHECKED in data.js to the fresh results (use for the first fill, and
//                    after a human has reviewed a weekly report; never run it from a geo-blocked network and trust it)
// Outcomes: ok (2xx/3xx) · blocked (401/403/406/429) · gone (404/410) · down (other errors / no response).
// `gone` is written as `down`. Always exits 0; the weekly workflow turns findings into a GitHub issue.
const fs = require("fs");
const path = require("path");

const UA = "Mozilla/5.0 (compatible; CityPortalLinkCheck/1.0)";
const DATA = path.join(__dirname, "data.js");

function classify(status) {
  if (status >= 200 && status < 400) return "ok";
  if ([401, 403, 406, 429].includes(status)) return "blocked";
  if (status === 404 || status === 410) return "gone";
  return "down";
}

async function probe(url, fetchFn = fetch) {
  let last = { outcome: "down", detail: "no response" };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetchFn(url, {
        redirect: "follow",
        headers: { "user-agent": UA, accept: "text/html,*/*" },
        signal: AbortSignal.timeout(20000),
      });
      last = { outcome: classify(r.status), detail: String(r.status) };
      if (last.outcome === "ok" || last.outcome === "gone") break;
    } catch (e) {
      last = { outcome: "down", detail: e.cause?.code || e.name || e.message };
    }
  }
  return last;
}

// Compare recorded status with the fresh result. `gone` is always reported; the rest only when they differ.
function compare(site, res) {
  const rec = site.status;
  if (res.outcome === "gone") return "gone";
  if (rec === "ok" && res.outcome !== "ok") return "regression";
  if (rec !== "ok" && res.outcome === "ok") return "recovered";
  return null;
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

function writeData(sites, helplines, checked) {
  const head = fs.readFileSync(DATA, "utf8").split("\nwindow.CHECKED")[0];
  fs.writeFileSync(DATA,
    `${head}\nwindow.CHECKED = ${JSON.stringify(checked)};\nwindow.SITES = ${JSON.stringify(sites, null, 1)};\nwindow.HELPLINES = ${JSON.stringify(helplines, null, 1)};\n`);
}

async function main() {
  global.window = {};
  require(DATA);
  const sites = window.SITES;
  const results = await pool(sites, 6, async s => ({ s, res: await probe(s.u) }));
  const groups = { gone: [], regression: [], recovered: [] };
  for (const { s, res } of results) {
    const k = compare(s, res);
    if (k) groups[k].push({ s, res });
  }
  const line = ({ s, res }) => `- [${s.n}](${s.u}) — recorded \`${s.status}\`, now \`${res.outcome}\` (${res.detail})`;
  const sec = (title, note, arr) => arr.length ? `### ${title} (${arr.length})\n${note}\n\n${arr.map(line).join("\n")}\n` : "";
  const body = [
    sec("Dead links (404/410)", "These addresses no longer exist. Find the new URL and update `data.js`.", groups.gone),
    sec("Regressions", "Recorded as working, but failed this week. Re-check manually before changing `status`; the runner may be geo-blocked.", groups.regression),
    sec("Recovered", "Recorded as not working, but responded this week. Consider setting `status` to `ok` in `data.js`.", groups.recovered),
  ].filter(Boolean).join("\n");
  const counts = results.reduce((a, { res }) => (a[res.outcome] = (a[res.outcome] || 0) + 1, a), {});
  const today = new Date().toISOString().slice(0, 10);
  const summary = `Checked ${sites.length} sites on ${today}: ` +
    ["ok", "blocked", "down", "gone"].map(k => `${counts[k] || 0} ${k}`).join(", ") + ".";
  const report = body ? `${summary}\n\n${body}` : "";
  console.log(summary);
  console.log(body || "No changes to report.");
  const i = process.argv.indexOf("--report");
  if (i > -1) fs.writeFileSync(path.resolve(process.argv[i + 1]), report);
  if (process.argv.includes("--update")) {
    for (const { s, res } of results) s.status = res.outcome === "gone" ? "down" : res.outcome;
    writeData(sites, window.HELPLINES, today);
    console.log("data.js updated.");
  }
}

module.exports = { classify, compare, probe };
if (require.main === module) main();
