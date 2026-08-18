import { describe, it, expect } from 'vitest';
import {
  calculateDuration,
  calculateTimeCost,
  calculateExtrasTotal,
  calculateSessionTotal,
  calculateChange,
  calculateClientAccountDebit,
  calculateClientRecharge,
  calculateFinancialStats,
  formatDH,
} from './calculations';
import { SessionExtra } from '../types';

describe('calculateDuration', () => {
  it('should calculate correct hours, minutes, seconds and formatted string', () => {
    const start = new Date('2026-08-16T10:00:00Z');
    const end = new Date('2026-08-16T12:35:45Z');
    const result = calculateDuration(start, end);

    expect(result.hours).toBe(2);
    expect(result.minutes).toBe(35);
    expect(result.seconds).toBe(45);
    expect(result.durationMinutes).toBe(155);
    expect(result.durationHours).toBeCloseTo(2.5833, 3);
    expect(result.formatted).toBe('02:35:45');
  });

  it('should handle zero elapsed time', () => {
    const start = new Date('2026-08-16T10:00:00Z');
    const result = calculateDuration(start, start);

    expect(result.durationMinutes).toBe(0);
    expect(result.formatted).toBe('00:00:00');
  });

  it('should prevent negative elapsed time if end is before start', () => {
    const start = new Date('2026-08-16T12:00:00Z');
    const end = new Date('2026-08-16T11:00:00Z');
    const result = calculateDuration(start, end);

    expect(result.diffMs).toBe(0);
    expect(result.durationMinutes).toBe(0);
    expect(result.formatted).toBe('00:00:00');
  });
});

describe('calculateTimeCost', () => {
  it('should return 0 when rate per hour is 0 (consumption-only table)', () => {
    expect(calculateTimeCost(120, 0)).toBe(0);
  });

  it('should return 0 when duration is 0', () => {
    expect(calculateTimeCost(0, 20)).toBe(0);
  });

  it('should apply 1 hour minimum charge for short sessions (< 60 minutes)', () => {
    // 15 minutes at 20 DH/h => charged for 1h (20 DH)
    expect(calculateTimeCost(15, 20)).toBe(20);
    // 45 minutes at 25 DH/h => charged for 1h (25 DH)
    expect(calculateTimeCost(45, 25)).toBe(25);
    // Exactly 60 minutes at 20 DH/h => 20 DH
    expect(calculateTimeCost(60, 20)).toBe(20);
  });

  it('should calculate proportional cost for sessions exceeding 1 hour', () => {
    // 90 minutes (1.5h) at 20 DH/h => 30 DH
    expect(calculateTimeCost(90, 20)).toBe(30);
    // 75 minutes (1.25h) at 20 DH/h => 25 DH
    expect(calculateTimeCost(75, 20)).toBe(25);
    // 135 minutes (2.25h) at 30 DH/h => 67.50 DH
    expect(calculateTimeCost(135, 30)).toBe(67.5);
  });

  it('should avoid floating point inaccuracy with precise decimal rounding', () => {
    // 40 minutes (0.66666666... billed as 1h min) at 15 DH/h => 15 DH
    expect(calculateTimeCost(40, 15)).toBe(15);
    // 80 minutes (1.33333333h) at 15 DH/h => 20.00 DH
    expect(calculateTimeCost(80, 15)).toBe(20);
  });
});

describe('calculateExtrasTotal', () => {
  it('should return 0 for empty, null, or undefined extras', () => {
    expect(calculateExtrasTotal(null)).toBe(0);
    expect(calculateExtrasTotal(undefined)).toBe(0);
    expect(calculateExtrasTotal([])).toBe(0);
  });

  it('should accurately compute sum of products with quantities and prices', () => {
    const extras: SessionExtra[] = [
      { id: '1', name: 'Espresso', price: 15, qty: 2, quantity: 2 },
      { id: '2', name: 'Croissant', price: 12.5, qty: 1, quantity: 1 },
      { id: '3', name: 'Eau Minérale', price: 8, qty: 3 },
    ];
    // 2 * 15 (30) + 1 * 12.5 (12.5) + 3 * 8 (24) = 66.50 DH
    expect(calculateExtrasTotal(extras)).toBe(66.5);
  });

  it('should safely ignore invalid quantities or negative prices', () => {
    const extras = [
      { id: '1', name: 'Valid Item', price: 20, quantity: 2 },
      { id: '2', name: 'Negative Qty', price: 15, quantity: -1 },
      { id: '3', name: 'NaN Price', price: NaN, quantity: 1 },
    ] as SessionExtra[];
    expect(calculateExtrasTotal(extras)).toBe(40);
  });
});

describe('calculateSessionTotal', () => {
  it('should sum time cost and extras total', () => {
    const result = calculateSessionTotal(30, 25, 0);
    expect(result.rawTotal).toBe(55);
    expect(result.totalAmount).toBe(55);
  });

  it('should enforce minimum cafe rate if raw total is below minimum', () => {
    // raw = 15 time + 0 extras = 15 DH, but minimum rate is 25 DH
    const result = calculateSessionTotal(15, 0, 25);
    expect(result.rawTotal).toBe(15);
    expect(result.totalAmount).toBe(25);
  });

  it('should not clamp if raw total exceeds minimum rate', () => {
    const result = calculateSessionTotal(40, 20, 25);
    expect(result.rawTotal).toBe(60);
    expect(result.totalAmount).toBe(60);
  });

  it('should handle floating point numbers cleanly without precision drift', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754
    const result = calculateSessionTotal(0.1, 0.2, 0);
    expect(result.rawTotal).toBe(0.3);
    expect(result.totalAmount).toBe(0.3);
  });
});

describe('calculateChange', () => {
  it('should return exact change when given excess cash', () => {
    const result = calculateChange(34.5, 50);
    expect(result.isSufficient).toBe(true);
    expect(result.change).toBe(15.5);
    expect(result.shortfall).toBe(0);
  });

  it('should return 0 change when exact cash is provided', () => {
    const result = calculateChange(50, 50);
    expect(result.isSufficient).toBe(true);
    expect(result.change).toBe(0);
    expect(result.shortfall).toBe(0);
  });

  it('should indicate shortfall and 0 change when insufficient cash is provided', () => {
    const result = calculateChange(50, 30);
    expect(result.isSufficient).toBe(false);
    expect(result.change).toBe(0);
    expect(result.shortfall).toBe(20);
  });
});

describe('calculateClientAccountDebit & calculateClientRecharge', () => {
  it('should calculate debit when balance is sufficient', () => {
    const result = calculateClientAccountDebit(150, 45.5);
    expect(result.canAfford).toBe(true);
    expect(result.newBalance).toBe(104.5);
    expect(result.shortfall).toBe(0);
  });

  it('should calculate shortfall and negative balance when client balance is insufficient', () => {
    const result = calculateClientAccountDebit(20, 55);
    expect(result.canAfford).toBe(false);
    expect(result.newBalance).toBe(-35);
    expect(result.shortfall).toBe(35);
  });

  it('should calculate recharge correctly', () => {
    expect(calculateClientRecharge(50, 100)).toBe(150);
    expect(calculateClientRecharge(0, 200.5)).toBe(200.5);
    // Ignore invalid/negative recharge
    expect(calculateClientRecharge(50, -20)).toBe(50);
  });
});

describe('calculateFinancialStats', () => {
  it('should aggregate only completed sessions and compute correct averages', () => {
    const sessions = [
      {
        status: 'completed',
        total_amount: 50,
        time_cost: 30,
        extras_total: 20,
        duration_minutes: 90,
        payment_method: 'cash',
      },
      {
        status: 'completed',
        total_amount: 100,
        time_cost: 60,
        extras_total: 40,
        duration_minutes: 180,
        payment_method: 'card',
      },
      {
        status: 'active', // Should be ignored
        total_amount: 40,
        time_cost: 20,
        extras_total: 20,
        duration_minutes: 60,
        payment_method: 'cash',
      },
      {
        status: 'cancelled', // Should be ignored
        total_amount: 0,
        duration_minutes: 10,
      },
    ];

    const stats = calculateFinancialStats(sessions);

    expect(stats.totalSessions).toBe(2);
    expect(stats.totalRevenue).toBe(150);
    expect(stats.timeRevenue).toBe(90);
    expect(stats.extrasRevenue).toBe(60);
    expect(stats.totalMinutes).toBe(270);
    expect(stats.averageDurationMinutes).toBe(135);
    expect(stats.averageTicket).toBe(75);
    expect(stats.paymentBreakdown['cash']).toEqual({ count: 1, total: 50 });
    expect(stats.paymentBreakdown['card']).toEqual({ count: 1, total: 100 });
  });

  it('should handle empty session list gracefully without dividing by zero', () => {
    const stats = calculateFinancialStats([]);
    expect(stats.totalSessions).toBe(0);
    expect(stats.totalRevenue).toBe(0);
    expect(stats.averageDurationMinutes).toBe(0);
    expect(stats.averageTicket).toBe(0);
  });
});

describe('formatDH', () => {
  it('should format numbers with DH and 2 decimals', () => {
    expect(formatDH(25)).toBe('25.00 DH');
    expect(formatDH(12.5)).toBe('12.50 DH');
    expect(formatDH(0)).toBe('0.00 DH');
    expect(formatDH(null)).toBe('0.00 DH');
    expect(formatDH(undefined)).toBe('0.00 DH');
  });
});
