# gst-itc

GST (Goods and Services Tax) and Input Tax Credit (ITC) calculation utilities
for a multi-stage supply chain, modeled on the manufacturer → wholesaler →
retailer → consumer flow.

## Install

```bash
npm install
npm test
```

## Usage

```ts
import { calculateGst, calculateSupplyChain, splitIntraStateGst } from "./src/index.js";

calculateGst(100, 18);
// { salePrice: 100, gstRate: 18, gstAmount: 18, totalAmount: 118 }

calculateSupplyChain([
  { name: "Manufacturer", salePrice: 100, gstRate: 18 },
  { name: "Wholesaler", salePrice: 150, gstRate: 18 },
  { name: "Retailer", salePrice: 200, gstRate: 18 },
]);
// {
//   stages: [
//     { name: "Manufacturer", gstAmount: 18, itcClaimed: 0,  netDeposit: 18, ... },
//     { name: "Wholesaler",   gstAmount: 27, itcClaimed: 18, netDeposit: 9,  ... },
//     { name: "Retailer",     gstAmount: 36, itcClaimed: 27, netDeposit: 9,  ... },
//   ],
//   totalGstToGovernment: 36,
// }

splitIntraStateGst(36);
// { cgst: 18, sgst: 18 }
```

Each stage in `calculateSupplyChain` claims ITC equal to the GST its
immediate seller charged it, and deposits only the difference to the
government. The net deposits always sum to the GST charged on the final
sale, no matter how many intermediate stages the chain has.

## API

- `calculateGst(salePrice, gstRate)` — GST amount and total for a single sale.
- `calculateSupplyChain(stages)` — walks a chain of sales, computing GST
  collected, ITC claimed, and net deposit at each stage.
- `splitIntraStateGst(gstAmount)` — splits a GST amount evenly into CGST and
  SGST for an intra-state supply.

All functions validate their inputs (non-negative prices/amounts, rates
between 0 and 100) and throw `RangeError` on invalid input.
