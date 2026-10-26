const $ = (id) => document.getElementById(id);
const inr = (n) => (n < 0 ? "−" : "") + "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN");
const lakh = (n) => "₹" + (n / 100000).toFixed(2) + "L";
const pct = (x) => (x * 100).toFixed(1) + "%";
const cls = (n) => (n < 0 ? "neg" : "pos");

const all = CHIT.payouts.map((_, i) => summary(i + 1));
const pool = CHIT.installment * CHIT.members;
const totalPayout = CHIT.payouts.reduce((a, b) => a + b, 0);
const totalPaid = all[0].totalPaid;
const breakEven = all.find((s) => s.net >= 0).month;

$("tiles").innerHTML = [
  ["Collected in total", lakh(pool * all.length)],
  ["Paid out as payouts", lakh(totalPayout)],
  ["Total discount", lakh(pool * all.length - totalPayout)],
  ["Break-even month", "Month " + breakEven],
].map(([k, v]) => `<div class="tile"><b>${v}</b><span>${k}</span></div>`).join("");

// Bar chart
const W = 620, H = 220, pl = 8, pb = 20, pt = 8, min = 100000, max = 250000;
const bw = (W - pl) / all.length;
const y = (v) => pt + (H - pt - pb) * (1 - (v - min) / (max - min));
$("chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Payout by month">` +
  all.map((s, i) => {
    const x = pl + i * bw;
    return `<rect class="bar${s.net >= 0 ? " gain" : ""}" x="${x + 1}" y="${y(s.payout)}" width="${bw - 2}" height="${H - pb - y(s.payout)}" rx="2"><title>Month ${s.month}: ${inr(s.payout)}</title></rect>` +
      ((s.month === 1 || s.month % 5 === 0 || s.month === 31) ? `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${s.month}</text>` : "");
  }).join("") +
  `<line class="ref" x1="${pl}" x2="${W}" y1="${y(totalPaid)}" y2="${y(totalPaid)}"/></svg>`;

const maxP = Math.max(...CHIT.payouts);
$("rows").innerHTML = all.map((s) =>
  `<tr class="${s.month === breakEven ? "be" : ""}"><td>${s.month}</td>` +
  `<td class="bar-cell"><i style="width:${30 + 70 * ((s.payout - 100000) / (maxP - 100000))}%"></i><span>${inr(s.payout)}</span></td>` +
  `<td class="hide-s">${inr(s.discount)}</td>` +
  `<td class="${cls(s.net)}">${inr(s.net)}</td>` +
  `<td>${s.annualRate === null ? "—" : pct(s.annualRate)}</td></tr>`).join("");
