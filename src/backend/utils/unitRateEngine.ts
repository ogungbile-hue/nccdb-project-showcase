/**
 * Parametric Unit Rate Composition Pipeline
 * Architecture Showcase & Public API Contracts
 *
 * =============================================================================
 * ARCHITECTURAL SPECIFICATION & NOTICE
 * =============================================================================
 * Implements deterministic civil engineering & BOQ parametric rate compilation:
 *   Base Cost = Material + Labor + Plant
 *   Total Rate = Base Cost * (1 + Overhead% / 100) * (1 + Profit% / 100)
 * Enforces PostgreSQL DECIMAL(12,2) fixed-point rounding and non-negative guards.
 * =============================================================================
 * @packageDocumentation
 */

export interface UnitRateInputs {
  materialCost: number;
  laborCost: number;
  plantCost: number;
  overheadPct: number; // e.g. 15 for 15%
  profitPct: number;   // e.g. 10 for 10%
}

export interface UnitRateResult {
  materialSum: number;
  laborSum: number;
  plantSum: number;
  subTotal: number;
  overheadPct: number;
  profitPct: number;
  overheadCost: number;
  profitCost: number;
  totalUnitRate: number;
}

/**
 * Rounds a number to exactly two decimal places, matching PostgreSQL DECIMAL(12,2).
 */
export function roundToCurrencyPrecision(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates parametric Bill of Quantities (BOQ) composite unit rate:
 * Formula:
 *   Base Cost = Material + Labor + Plant
 *   Total Rate = Base Cost * (1 + Overhead% / 100) * (1 + Profit% / 100)
 *
 * Enforces:
 *   - Non-negative input guards
 *   - 0% markup edge cases
 *   - Strict 2-decimal precision (DECIMAL(12,2) representation)
 */
export function calculateUnitRate(inputs: UnitRateInputs): UnitRateResult {
  const { materialCost, laborCost, plantCost, overheadPct, profitPct } = inputs;

  // Negative input guards
  if (materialCost < 0) {
    throw new Error('Invalid input: materialCost cannot be negative.');
  }
  if (laborCost < 0) {
    throw new Error('Invalid input: laborCost cannot be negative.');
  }
  if (plantCost < 0) {
    throw new Error('Invalid input: plantCost cannot be negative.');
  }
  if (overheadPct < 0) {
    throw new Error('Invalid input: overheadPct cannot be negative.');
  }
  if (profitPct < 0) {
    throw new Error('Invalid input: profitPct cannot be negative.');
  }

  // Precision formatting of base components
  const materialSum = roundToCurrencyPrecision(materialCost);
  const laborSum = roundToCurrencyPrecision(laborCost);
  const plantSum = roundToCurrencyPrecision(plantCost);

  // Direct prime subtotal
  const subTotal = roundToCurrencyPrecision(materialSum + laborSum + plantSum);

  // Overhead calculation
  const overheadFactor = 1 + (overheadPct / 100);
  const costWithOverhead = subTotal * overheadFactor;
  const overheadCost = roundToCurrencyPrecision(costWithOverhead - subTotal);

  // Profit calculation compounded on cost with overhead
  const profitFactor = 1 + (profitPct / 100);
  const totalRaw = costWithOverhead * profitFactor;
  const profitCost = roundToCurrencyPrecision(totalRaw - costWithOverhead);

  const totalUnitRate = roundToCurrencyPrecision(totalRaw);

  return {
    materialSum,
    laborSum,
    plantSum,
    subTotal,
    overheadPct,
    profitPct,
    overheadCost,
    profitCost,
    totalUnitRate
  };
}
