const $ = (id) => document.getElementById(id);
const inr = (n) => (n < 0 ? "−" : "") + "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN");
const pct = (x) => (x * 100).toFixed(1) + "%";
const cls = (n) => (n < 0 ? "neg" : "pos");

function render() {
  const m = +$("month").value;
  const s = summary(m);
  $("monthVal").textContent = m;

  $("out").innerHTML = [
    ["Payout you receive", inr(s.payout)],
    ["Discount from the ₹2,50,000 pool", inr(s.discount)],
    ["Paid before and in month " + m, inr(s.paidBefore)],
    ["Still to pay after", inr(s.paidAfter)],
    ["Total you pay over 31 months", inr(s.totalPaid)],
    ["Net (payout − total paid)", `<span class="${cls(s.net)}">${inr(s.net)}</span>`],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");

  if (s.annualRate === null) {
    $("rate").innerHTML = "No single rate";
    $("note").textContent = "You save for " + m + " months, then repay for " + (31 - m) + ". Neither a pure loan nor a pure deposit, so see the value comparison below.";
  } else {
    $("rate").innerHTML = `<span class="${s.net < 0 ? "neg" : "pos"}">${pct(s.annualRate)} a year</span>`;
    $("note").textContent = s.net < 0
      ? "Effective yearly cost of using the chit as a loan."
      : "Effective yearly return on your instalments.";
  }

  const a = (+$("alt").value || 0) / 100;
  const v = s.npvAt(a);
  $("npv").innerHTML = `<span class="${cls(v)}">${inr(v)}</span>`;

  document.querySelectorAll("#rows tr").forEach((tr) => tr.classList.toggle("sel", +tr.dataset.m === m));
}

function buildTable() {
  $("rows").innerHTML = CHIT.payouts.map((_, i) => {
    const s = summary(i + 1);
    return `<tr data-m="${i + 1}"><td>${i + 1}</td><td>${inr(s.payout)}</td>` +
      `<td class="${cls(s.net)}">${inr(s.net)}</td>` +
      `<td>${s.annualRate === null ? "—" : pct(s.annualRate)}</td></tr>`;
  }).join("");
  $("rows").addEventListener("click", (e) => {
    const tr = e.target.closest("tr");
    if (tr) { $("month").value = tr.dataset.m; render(); }
  });
}

$("month").addEventListener("input", render);
$("alt").addEventListener("input", render);
buildTable();
render();
