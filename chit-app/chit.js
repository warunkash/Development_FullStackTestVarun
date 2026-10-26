// Core chit maths, shared by the page and the node test.
const CHIT = {
  installment: 6250,
  members: 40,
  payouts: [
    150000, 151250, 152500, 154000, 155500, 157000, 159000, 161000, 163000,
    165000, 167500, 170000, 172500, 175500, 177500, 180000, 183250, 186250,
    189250, 192500, 196000, 199500, 203500, 207500, 211500, 216000, 220500,
    225000, 230000, 235250, 240000,
  ],
};

// NPV at monthly rate r of: -installment every month 1..N, +payout in month m.
function npv(r, m, c = CHIT) {
  const n = c.payouts.length;
  let v = 0;
  for (let t = 1; t <= n; t++) v -= c.installment / Math.pow(1 + r, t);
  return v + c.payouts[m - 1] / Math.pow(1 + r, m);
}

// Monthly IRR: every sign change of NPV on a rate grid is refined by
// bisection. Mid-term wins (pay, receive, pay) can have more than one
// root, so all are returned, smallest first.
function monthlyRates(m, c = CHIT) {
  const roots = [];
  let lo = -0.2, flo = npv(lo, m, c);
  for (let i = 1; i <= 2000; i++) {
    const hi = -0.2 + i * 0.0005; // up to 80% a month
    const fhi = npv(hi, m, c);
    if (flo === 0) roots.push(lo);
    else if (flo * fhi < 0) {
      let a = lo, b = hi, fa = flo;
      for (let k = 0; k < 100; k++) {
        const mid = (a + b) / 2, fm = npv(mid, m, c);
        if (fa * fm <= 0) b = mid; else { a = mid; fa = fm; }
      }
      roots.push((a + b) / 2);
    }
    lo = hi; flo = fhi;
  }
  return roots;
}

function summary(m, c = CHIT) {
  const n = c.payouts.length;
  const payout = c.payouts[m - 1];
  const pool = c.installment * c.members;
  const totalPaid = c.installment * n;
  // Drop spurious roots (below -50% a year); of the rest the smallest is the
  // meaningful one. Months 12-18 have no root at all: the member is a saver
  // before winning and a borrower after, and no single rate balances that.
  const annuals = monthlyRates(m, c)
    .map((r) => Math.pow(1 + r, 12) - 1)
    .filter((a) => a > -0.5);
  const annualRate = annuals.length ? annuals[0] : null;
  return {
    month: m, payout, pool, discount: pool - payout, totalPaid,
    net: payout - totalPaid,
    paidBefore: c.installment * m, // incl. the winning month's instalment
    paidAfter: c.installment * (n - m),
    annualRate,
  };
}

if (typeof module !== "undefined") module.exports = { CHIT, npv, monthlyRates, summary };
