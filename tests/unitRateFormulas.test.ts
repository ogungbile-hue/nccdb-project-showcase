import { describe, it, expect } from 'vitest';
import {
  calculateUnitRate,
  roundToCurrencyPrecision,
  UnitRateInputs
} from '../src/backend/utils/unitRateEngine';

describe('Parametric Unit Rate Formulas (BOQ Cost Engine)', () => {
  describe('Standard Parametric Rate Build-up Calculation', () => {
    it('calculates composite rate with standard 15% overhead and 10% profit correctly', () => {
      // Base: Material = 1000, Labor = 500, Plant = 200 => SubTotal = 1700
      // With 15% overhead: 1700 * 1.15 = 1955.00 (Overhead Cost = 255.00)
      // With 10% profit: 1955 * 1.10 = 2150.50 (Profit Cost = 195.50)
      // Total Unit Rate = 2150.50
      const inputs: UnitRateInputs = {
        materialCost: 1000,
        laborCost: 500,
        plantCost: 200,
        overheadPct: 15,
        profitPct: 10
      };

      const result = calculateUnitRate(inputs);

      expect(result.subTotal).toBe(1700.00);
      expect(result.overheadCost).toBe(255.00);
      expect(result.profitCost).toBe(195.50);
      expect(result.totalUnitRate).toBe(2150.50);
    });

    it('matches realistic 1m3 Grade 25 concrete assembly rate build-up', () => {
      // 1m3 Reinforced Concrete C25:
      // Cement, sand, aggregate, water = ₦68,450.00
      // Mixing, placing, curing labor = ₦14,200.00
      // Concrete mixer, poker vibrator plant = ₦8,350.00
      // Prime cost = ₦91,000.00
      // Overhead @ 12.5% = ₦11,375.00 -> ₦102,375.00
      // Profit @ 8.0% = ₦8,190.00 -> ₦110,565.00
      const inputs: UnitRateInputs = {
        materialCost: 68450.00,
        laborCost: 14200.00,
        plantCost: 8350.00,
        overheadPct: 12.5,
        profitPct: 8.0
      };

      const result = calculateUnitRate(inputs);

      expect(result.materialSum).toBe(68450.00);
      expect(result.laborSum).toBe(14200.00);
      expect(result.plantSum).toBe(8350.00);
      expect(result.subTotal).toBe(91000.00);
      expect(result.overheadCost).toBe(11375.00);
      expect(result.profitCost).toBe(8190.00);
      expect(result.totalUnitRate).toBe(110565.00);
    });
  });

  describe('Edge Cases: 0% Markup Conditions', () => {
    it('returns exact base subtotal when both overhead and profit are 0%', () => {
      const inputs: UnitRateInputs = {
        materialCost: 45000,
        laborCost: 15000,
        plantCost: 5000,
        overheadPct: 0,
        profitPct: 0
      };

      const result = calculateUnitRate(inputs);

      expect(result.subTotal).toBe(65000);
      expect(result.overheadCost).toBe(0);
      expect(result.profitCost).toBe(0);
      expect(result.totalUnitRate).toBe(65000);
    });

    it('handles 0% overhead with non-zero profit correctly', () => {
      const inputs: UnitRateInputs = {
        materialCost: 1000,
        laborCost: 0,
        plantCost: 0,
        overheadPct: 0,
        profitPct: 10
      };

      const result = calculateUnitRate(inputs);

      expect(result.subTotal).toBe(1000);
      expect(result.overheadCost).toBe(0);
      expect(result.profitCost).toBe(100);
      expect(result.totalUnitRate).toBe(1100);
    });

    it('handles non-zero overhead with 0% profit correctly', () => {
      const inputs: UnitRateInputs = {
        materialCost: 2000,
        laborCost: 0,
        plantCost: 0,
        overheadPct: 15,
        profitPct: 0
      };

      const result = calculateUnitRate(inputs);

      expect(result.subTotal).toBe(2000);
      expect(result.overheadCost).toBe(300);
      expect(result.profitCost).toBe(0);
      expect(result.totalUnitRate).toBe(2300);
    });
  });

  describe('Negative Input Guards & Validations', () => {
    it('throws an error if materialCost is negative', () => {
      expect(() =>
        calculateUnitRate({
          materialCost: -100,
          laborCost: 50,
          plantCost: 20,
          overheadPct: 10,
          profitPct: 5
        })
      ).toThrow('materialCost cannot be negative');
    });

    it('throws an error if laborCost is negative', () => {
      expect(() =>
        calculateUnitRate({
          materialCost: 100,
          laborCost: -50,
          plantCost: 20,
          overheadPct: 10,
          profitPct: 5
        })
      ).toThrow('laborCost cannot be negative');
    });

    it('throws an error if plantCost is negative', () => {
      expect(() =>
        calculateUnitRate({
          materialCost: 100,
          laborCost: 50,
          plantCost: -20,
          overheadPct: 10,
          profitPct: 5
        })
      ).toThrow('plantCost cannot be negative');
    });

    it('throws an error if overheadPct is negative', () => {
      expect(() =>
        calculateUnitRate({
          materialCost: 100,
          laborCost: 50,
          plantCost: 20,
          overheadPct: -10,
          profitPct: 5
        })
      ).toThrow('overheadPct cannot be negative');
    });

    it('throws an error if profitPct is negative', () => {
      expect(() =>
        calculateUnitRate({
          materialCost: 100,
          laborCost: 50,
          plantCost: 20,
          overheadPct: 10,
          profitPct: -5
        })
      ).toThrow('profitPct cannot be negative');
    });
  });

  describe('Decimal Rounding & Fixed-Point Precision (DECIMAL(12,2))', () => {
    it('rounds fractional currency values to two decimal places', () => {
      expect(roundToCurrencyPrecision(10.555)).toBe(10.56);
      expect(roundToCurrencyPrecision(10.554)).toBe(10.55);
      expect(roundToCurrencyPrecision(100.1)).toBe(100.10);
    });

    it('preserves clean 2-decimal arithmetic on odd fractional rates', () => {
      const inputs: UnitRateInputs = {
        materialCost: 33.333,
        laborCost: 66.666,
        plantCost: 11.111,
        overheadPct: 13.75,
        profitPct: 9.25
      };

      const result = calculateUnitRate(inputs);

      // Verify that all results have at most 2 decimal places
      const decimals = (val: number) => {
        const parts = val.toString().split('.');
        return parts[1] ? parts[1].length : 0;
      };

      expect(decimals(result.subTotal)).toBeLessThanOrEqual(2);
      expect(decimals(result.overheadCost)).toBeLessThanOrEqual(2);
      expect(decimals(result.profitCost)).toBeLessThanOrEqual(2);
      expect(decimals(result.totalUnitRate)).toBeLessThanOrEqual(2);
    });
  });
});
