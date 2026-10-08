/**
 * Statistical Anomaly & Outlier Quarantine Engine
 * Architecture Showcase & Public API Contracts
 *
 * =============================================================================
 * ARCHITECTURAL SPECIFICATION & NOTICE
 * =============================================================================
 * Implements real-time statistical anomaly detection, rolling baseline
 * calculation, and 4-tier moderation routing for construction tender data:
 *   - Delta <= 10%: Standard queue / fast-track moderation
 *   - 10% < Delta <= 20%: Soft-lock queue requiring auditor justification
 *   - Delta > 20%: Hard-lock quarantine (forced FLAGGED status)
 *   - Price <= 0: Hard rejection tagged as CORRUPTED
 * =============================================================================
 * @packageDocumentation
 */

export type AnomalyStatus = 'APPROVED' | 'PENDING' | 'FLAGGED' | 'CORRUPTED';

export interface AnomalyEvaluationResult {
  status: AnomalyStatus;
  deviationRate: number | null;
  baselinePrice: number | null;
  requiresJustificationNote: boolean;
  systemWarning?: string;
  isQuarantined: boolean;
  isValid: boolean;
  error?: string;
}

/**
 * Calculates the mean average of approved historical prices.
 */
export function calculateBaselineAverage(historicalPrices: number[]): number {
  if (!historicalPrices || historicalPrices.length === 0) return 0;
  const sum = historicalPrices.reduce((acc, price) => acc + price, 0);
  return sum / historicalPrices.length;
}

/**
 * Computes the absolute percentage variance between a price and a baseline average.
 */
export function calculatePriceDeviation(currentPrice: number, baselinePrice: number): number {
  if (baselinePrice <= 0) return 0;
  return Math.abs((currentPrice - baselinePrice) / baselinePrice) * 100;
}

/**
 * Core Statistical Anomaly Engine logic for NCCDB price evaluation.
 * - price <= 0: Marked as CORRUPTED (malformed entry / negative or zero price).
 * - delta <= 10%: Standard queue (PENDING / APPROVED fast-track).
 * - 10% < delta <= 20%: Soft-lock queue (requires mandatory auditor justification note).
 * - delta > 20%: Hard-lock quarantine (forced to FLAGGED status).
 */
export function evaluatePriceAnomaly(
  currentPrice: number,
  historicalPrices: number[],
  notes?: string
): AnomalyEvaluationResult {
  // Negative or non-positive price check
  if (currentPrice === undefined || currentPrice === null || typeof currentPrice !== 'number' || isNaN(currentPrice) || currentPrice <= 0) {
    return {
      status: 'CORRUPTED',
      deviationRate: null,
      baselinePrice: null,
      requiresJustificationNote: false,
      isQuarantined: true,
      isValid: false,
      error: 'Malformed entry: Price must be a positive numeric value.',
      systemWarning: '[SYSTEM REJECT: Price non-positive or corrupted]'
    };
  }

  // If insufficient historical prices to compute a statistical baseline
  if (!historicalPrices || historicalPrices.length === 0) {
    return {
      status: 'PENDING',
      deviationRate: null,
      baselinePrice: null,
      requiresJustificationNote: false,
      isQuarantined: false,
      isValid: true,
    };
  }

  const baseline = calculateBaselineAverage(historicalPrices);
  const delta = calculatePriceDeviation(currentPrice, baseline);

  // Delta > 20%: Hard-lock quarantine
  if (delta > 20) {
    return {
      status: 'FLAGGED',
      deviationRate: Number(delta.toFixed(2)),
      baselinePrice: Number(baseline.toFixed(2)),
      requiresJustificationNote: false,
      isQuarantined: true,
      isValid: true,
      systemWarning: '[SYSTEM OVERRIDE]: Variance delta exceeded 20% safe threshold. Forced to FLAGGED status.'
    };
  }

  // 10% < Delta <= 20%: Soft-lock
  if (delta > 10) {
    const hasValidNotes = Boolean(notes && notes.trim().length > 0);
    return {
      status: hasValidNotes ? 'APPROVED' : 'PENDING',
      deviationRate: Number(delta.toFixed(2)),
      baselinePrice: Number(baseline.toFixed(2)),
      requiresJustificationNote: true,
      isQuarantined: false,
      isValid: true,
      systemWarning: hasValidNotes 
        ? undefined 
        : '[AUDIT NOTICE]: Variance exceeds 10%. Mandatory justification notes required.'
    };
  }

  // Delta <= 10%: Standard queue
  return {
    status: 'APPROVED',
    deviationRate: Number(delta.toFixed(2)),
    baselinePrice: Number(baseline.toFixed(2)),
    requiresJustificationNote: false,
    isQuarantined: false,
    isValid: true,
  };
}
