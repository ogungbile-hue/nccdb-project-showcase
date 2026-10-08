import { describe, it, expect } from 'vitest';
import {
  evaluatePriceAnomaly,
  calculateBaselineAverage,
  calculatePriceDeviation
} from '../src/backend/utils/anomalyEngine';

describe('Statistical Anomaly Engine (NCCDB Price Ingestion & Moderation)', () => {
  const historicalBaseline = [10000, 10200, 9800]; // Mean = 10,000

  describe('calculateBaselineAverage & calculatePriceDeviation', () => {
    it('calculates mean historical price correctly', () => {
      const avg = calculateBaselineAverage([10000, 10500, 9500]);
      expect(avg).toBe(10000);
    });

    it('returns 0 when historical price list is empty', () => {
      expect(calculateBaselineAverage([])).toBe(0);
    });

    it('computes exact percentage deviation delta', () => {
      const deviation = calculatePriceDeviation(11000, 10000);
      expect(deviation).toBe(10);
    });
  });

  describe('Price Malformation & Non-positive Inputs (CORRUPTED Status)', () => {
    it('flags price <= 0 as CORRUPTED (zero price)', () => {
      const result = evaluatePriceAnomaly(0, historicalBaseline);
      expect(result.status).toBe('CORRUPTED');
      expect(result.isQuarantined).toBe(true);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('positive numeric value');
    });

    it('flags negative price as CORRUPTED', () => {
      const result = evaluatePriceAnomaly(-5000, historicalBaseline);
      expect(result.status).toBe('CORRUPTED');
      expect(result.isQuarantined).toBe(true);
      expect(result.isValid).toBe(false);
    });

    it('flags NaN / invalid number input as CORRUPTED', () => {
      const result = evaluatePriceAnomaly(Number.NaN, historicalBaseline);
      expect(result.status).toBe('CORRUPTED');
      expect(result.isQuarantined).toBe(true);
    });
  });

  describe('Variance Delta <= 10% (Standard Queue / Fast-Track)', () => {
    it('approves a price within 5% variance directly', () => {
      const result = evaluatePriceAnomaly(10500, historicalBaseline); // delta = 5%
      expect(result.status).toBe('APPROVED');
      expect(result.deviationRate).toBe(5);
      expect(result.requiresJustificationNote).toBe(false);
      expect(result.isQuarantined).toBe(false);
    });

    it('routes price exactly on 10.0% boundary to standard queue without notes', () => {
      const result = evaluatePriceAnomaly(11000, historicalBaseline); // delta = 10%
      expect(result.status).toBe('APPROVED');
      expect(result.deviationRate).toBe(10);
      expect(result.requiresJustificationNote).toBe(false);
      expect(result.isQuarantined).toBe(false);
    });

    it('routes downward price variance within 10% to standard queue', () => {
      const result = evaluatePriceAnomaly(9200, historicalBaseline); // delta = 8%
      expect(result.status).toBe('APPROVED');
      expect(result.deviationRate).toBe(8);
      expect(result.requiresJustificationNote).toBe(false);
    });
  });

  describe('10% < Variance Delta <= 20% (Soft-Lock / Mandatory Notes Required)', () => {
    it('applies soft-lock status requiring mandatory justification note when notes are missing', () => {
      const result = evaluatePriceAnomaly(11500, historicalBaseline, ''); // delta = 15%
      expect(result.status).toBe('PENDING');
      expect(result.deviationRate).toBe(15);
      expect(result.requiresJustificationNote).toBe(true);
      expect(result.isQuarantined).toBe(false);
      expect(result.systemWarning).toContain('Mandatory justification notes required');
    });

    it('approves soft-locked price when valid auditor justification notes are supplied', () => {
      const result = evaluatePriceAnomaly(
        11500,
        historicalBaseline,
        'Fuel and interstate haulage tariff surge confirmed by transport union.'
      );
      expect(result.status).toBe('APPROVED');
      expect(result.deviationRate).toBe(15);
      expect(result.requiresJustificationNote).toBe(true);
      expect(result.isQuarantined).toBe(false);
      expect(result.systemWarning).toBeUndefined();
    });

    it('enforces soft-lock at upper boundary of 20.0%', () => {
      const result = evaluatePriceAnomaly(12000, historicalBaseline); // delta = 20%
      expect(result.requiresJustificationNote).toBe(true);
      expect(result.status).toBe('PENDING');
      expect(result.isQuarantined).toBe(false);
    });
  });

  describe('Variance Delta > 20% (Hard-Lock System Quarantine / FLAGGED)', () => {
    it('quarantines price with > 20% variance (e.g. 25%) to FLAGGED status', () => {
      const result = evaluatePriceAnomaly(12500, historicalBaseline); // delta = 25%
      expect(result.status).toBe('FLAGGED');
      expect(result.deviationRate).toBe(25);
      expect(result.isQuarantined).toBe(true);
      expect(result.systemWarning).toContain('exceeded 20% safe threshold');
    });

    it('forces FLAGGED status even if auditor notes are attached', () => {
      const result = evaluatePriceAnomaly(
        13000, // delta = 30%
        historicalBaseline,
        'Auditor note claiming valid price spike'
      );
      expect(result.status).toBe('FLAGGED');
      expect(result.deviationRate).toBe(30);
      expect(result.isQuarantined).toBe(true);
    });

    it('flags extreme upward pricing outliers (e.g. 100% markup)', () => {
      const result = evaluatePriceAnomaly(20000, historicalBaseline); // delta = 100%
      expect(result.status).toBe('FLAGGED');
      expect(result.deviationRate).toBe(100);
      expect(result.isQuarantined).toBe(true);
    });
  });

  describe('Baseline Edge Cases', () => {
    it('sets PENDING without quarantine when baseline has no prior approved prices', () => {
      const result = evaluatePriceAnomaly(15000, []);
      expect(result.status).toBe('PENDING');
      expect(result.deviationRate).toBeNull();
      expect(result.requiresJustificationNote).toBe(false);
      expect(result.isQuarantined).toBe(false);
    });
  });
});
