import { describe, expect, it } from "vitest";
import {
  calculateGst,
  calculateSupplyChain,
  splitIntraStateGst,
} from "../src/gst.js";

describe("calculateGst", () => {
  it("computes GST amount and total at a given rate", () => {
    expect(calculateGst(100, 18)).toEqual({
      salePrice: 100,
      gstRate: 18,
      gstAmount: 18,
      totalAmount: 118,
    });
  });

  it("handles a zero rate", () => {
    expect(calculateGst(50, 0)).toEqual({
      salePrice: 50,
      gstRate: 0,
      gstAmount: 0,
      totalAmount: 50,
    });
  });

  it("rounds to 2 decimal places", () => {
    const result = calculateGst(99.99, 18);
    expect(result.gstAmount).toBeCloseTo(18, 2);
    expect(result.totalAmount).toBeCloseTo(117.99, 2);
  });

  it("rejects a negative sale price", () => {
    expect(() => calculateGst(-1, 18)).toThrow(RangeError);
  });

  it("rejects a rate outside 0-100", () => {
    expect(() => calculateGst(100, 101)).toThrow(RangeError);
    expect(() => calculateGst(100, -5)).toThrow(RangeError);
  });
});

describe("calculateSupplyChain", () => {
  // Matches the manufacturer -> wholesaler -> retailer example at 18% GST.
  const chain = [
    { name: "Manufacturer", salePrice: 100, gstRate: 18 },
    { name: "Wholesaler", salePrice: 150, gstRate: 18 },
    { name: "Retailer", salePrice: 200, gstRate: 18 },
  ];

  it("computes GST collected, ITC claimed and net deposit per stage", () => {
    const { stages } = calculateSupplyChain(chain);

    expect(stages[0]).toMatchObject({
      name: "Manufacturer",
      gstAmount: 18,
      itcClaimed: 0,
      netDeposit: 18,
      totalAmount: 118,
    });
    expect(stages[1]).toMatchObject({
      name: "Wholesaler",
      gstAmount: 27,
      itcClaimed: 18,
      netDeposit: 9,
      totalAmount: 177,
    });
    expect(stages[2]).toMatchObject({
      name: "Retailer",
      gstAmount: 36,
      itcClaimed: 27,
      netDeposit: 9,
      totalAmount: 236,
    });
  });

  it("totals the net deposits to the GST charged on the final sale", () => {
    const { stages, totalGstToGovernment } = calculateSupplyChain(chain);

    expect(totalGstToGovernment).toBe(36);
    expect(totalGstToGovernment).toBe(stages[stages.length - 1].gstAmount);
  });

  it("is invariant to the number of stages for the same final price", () => {
    const twoStage = calculateSupplyChain([
      { name: "Manufacturer", salePrice: 100, gstRate: 18 },
      { name: "Retailer", salePrice: 200, gstRate: 18 },
    ]);

    // Same final sale price (200) -> same total GST reaching government,
    // regardless of how many intermediate stages it passed through.
    expect(twoStage.totalGstToGovernment).toBe(36);
  });

  it("rejects an empty chain", () => {
    expect(() => calculateSupplyChain([])).toThrow(RangeError);
  });
});

describe("splitIntraStateGst", () => {
  it("splits evenly between CGST and SGST", () => {
    expect(splitIntraStateGst(36)).toEqual({ cgst: 18, sgst: 18 });
  });

  it("handles an odd amount without losing a paisa", () => {
    const { cgst, sgst } = splitIntraStateGst(37);
    expect(cgst + sgst).toBe(37);
  });

  it("rejects a negative amount", () => {
    expect(() => splitIntraStateGst(-10)).toThrow(RangeError);
  });
});
