/**
 * GST (Goods and Services Tax) and ITC (Input Tax Credit) calculations
 * for a multi-stage supply chain: manufacturer -> wholesaler -> retailer -> consumer.
 */

export interface GstBreakdown {
  salePrice: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
}

export interface StageInput {
  name: string;
  salePrice: number;
  gstRate: number;
}

export interface StageResult extends GstBreakdown {
  name: string;
  itcClaimed: number;
  netDeposit: number;
}

export interface SupplyChainResult {
  stages: StageResult[];
  totalGstToGovernment: number;
}

export interface CgstSgstSplit {
  cgst: number;
  sgst: number;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function assertNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative number, got ${value}`);
  }
}

function assertValidRate(rate: number): void {
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new RangeError(`gstRate must be between 0 and 100, got ${rate}`);
  }
}

/**
 * GST charged on a single sale: sale price + GST at the given rate.
 */
export function calculateGst(salePrice: number, gstRate: number): GstBreakdown {
  assertNonNegative(salePrice, "salePrice");
  assertValidRate(gstRate);

  const gstAmount = round2(salePrice * (gstRate / 100));
  const totalAmount = round2(salePrice + gstAmount);

  return { salePrice, gstRate, gstAmount, totalAmount };
}

/**
 * Walks a supply chain end to end. Each stage claims ITC equal to the GST its
 * immediate seller charged it, and deposits only the difference (its GST
 * collected minus that ITC) to the government. The sum of every stage's net
 * deposit always equals the GST charged on the final sale.
 */
export function calculateSupplyChain(stages: StageInput[]): SupplyChainResult {
  if (stages.length === 0) {
    throw new RangeError("stages must contain at least one entry");
  }

  const results: StageResult[] = [];
  let previousGstAmount = 0;

  for (const stage of stages) {
    const { gstAmount, totalAmount } = calculateGst(stage.salePrice, stage.gstRate);
    const itcClaimed = previousGstAmount;
    const netDeposit = round2(gstAmount - itcClaimed);

    results.push({
      name: stage.name,
      salePrice: stage.salePrice,
      gstRate: stage.gstRate,
      gstAmount,
      totalAmount,
      itcClaimed,
      netDeposit,
    });

    previousGstAmount = gstAmount;
  }

  const totalGstToGovernment = round2(
    results.reduce((sum, stage) => sum + stage.netDeposit, 0)
  );

  return { stages: results, totalGstToGovernment };
}

/**
 * Splits an intra-state GST amount evenly between Central (CGST) and State (SGST).
 */
export function splitIntraStateGst(gstAmount: number): CgstSgstSplit {
  assertNonNegative(gstAmount, "gstAmount");

  const cgst = round2(gstAmount / 2);
  const sgst = round2(gstAmount - cgst);

  return { cgst, sgst };
}
