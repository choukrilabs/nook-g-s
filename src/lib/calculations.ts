import { SessionExtra } from '../types';

/**
 * Calculates session elapsed time and duration breakdown.
 */
export function calculateDuration(
  startedAt: string | Date | number,
  endedAt: string | Date | number | null = null
): {
  diffMs: number;
  durationMinutes: number;
  durationHours: number;
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
} {
  const startMs = typeof startedAt === 'number' ? startedAt : new Date(startedAt).getTime();
  const endMs = endedAt
    ? typeof endedAt === 'number'
      ? endedAt
      : new Date(endedAt).getTime()
    : Date.now();

  const diffMs = Math.max(0, isNaN(startMs) || isNaN(endMs) ? 0 : endMs - startMs);

  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);
  const durationMinutes = Math.floor(diffMs / 60000);
  const durationHours = durationMinutes / 60;

  const formatted = `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return {
    diffMs,
    durationMinutes,
    durationHours,
    hours,
    minutes,
    seconds,
    formatted,
  };
}

/**
 * Calculates the time-based cost for a session given duration and hourly rate.
 * If ratePerHour is 0 (consumption-only session), time cost is 0.
 * If ratePerHour > 0, enforces a minimum charge of minChargeHours (default 1h).
 */
export function calculateTimeCost(
  durationMinutes: number,
  ratePerHour: number,
  minChargeHours = 1
): number {
  if (ratePerHour <= 0 || durationMinutes <= 0) {
    return 0;
  }
  const durationHours = durationMinutes / 60;
  const billedHours = Math.max(minChargeHours, durationHours);
  return Math.round(billedHours * ratePerHour * 100) / 100;
}

/**
 * Calculates the total sum of all consumed extras.
 */
export function calculateExtrasTotal(extras?: SessionExtra[] | null): number {
  if (!extras || !Array.isArray(extras) || extras.length === 0) {
    return 0;
  }
  const sum = extras.reduce((acc, item) => {
    const qty = Number(item.quantity ?? item.qty ?? 0);
    const price = Number(item.price ?? 0);
    if (isNaN(qty) || isNaN(price) || qty <= 0 || price <= 0) {
      return acc;
    }
    return acc + qty * price;
  }, 0);

  return Math.round(sum * 100) / 100;
}

/**
 * Calculates raw total (time + extras) and clamped total (against minimum cafe rate).
 */
export function calculateSessionTotal(
  timeCost: number,
  extrasTotal: number,
  minimumRate = 0
): {
  rawTotal: number;
  totalAmount: number;
} {
  const safeTimeCost = Math.max(0, isNaN(timeCost) ? 0 : timeCost);
  const safeExtrasTotal = Math.max(0, isNaN(extrasTotal) ? 0 : extrasTotal);
  const safeMinRate = Math.max(0, isNaN(minimumRate) ? 0 : minimumRate);

  const rawTotal = Math.round((safeTimeCost + safeExtrasTotal) * 100) / 100;
  const totalAmount = Math.round(Math.max(safeMinRate, rawTotal) * 100) / 100;

  return {
    rawTotal,
    totalAmount,
  };
}

/**
 * Calculates change due for cash payment.
 */
export function calculateChange(
  totalAmount: number,
  cashGiven: number
): {
  change: number;
  isSufficient: boolean;
  shortfall: number;
} {
  const safeTotal = Math.max(0, isNaN(totalAmount) ? 0 : totalAmount);
  const safeCash = Math.max(0, isNaN(cashGiven) ? 0 : cashGiven);

  const isSufficient = safeCash >= safeTotal;
  const diff = Math.round((safeCash - safeTotal) * 100) / 100;

  return {
    change: isSufficient ? diff : 0,
    isSufficient,
    shortfall: isSufficient ? 0 : Math.round((safeTotal - safeCash) * 100) / 100,
  };
}

/**
 * Calculates client balance debit for prepaid account payment.
 */
export function calculateClientAccountDebit(
  currentBalance: number,
  totalAmount: number
): {
  newBalance: number;
  canAfford: boolean;
  shortfall: number;
} {
  const safeBalance = isNaN(currentBalance) ? 0 : currentBalance;
  const safeTotal = Math.max(0, isNaN(totalAmount) ? 0 : totalAmount);

  const canAfford = safeBalance >= safeTotal;
  const newBalance = Math.round((safeBalance - safeTotal) * 100) / 100;
  const shortfall = canAfford ? 0 : Math.round((safeTotal - safeBalance) * 100) / 100;

  return {
    newBalance,
    canAfford,
    shortfall,
  };
}

/**
 * Calculates updated balance after client account recharge.
 */
export function calculateClientRecharge(
  currentBalance: number,
  rechargeAmount: number
): number {
  const safeBalance = isNaN(currentBalance) ? 0 : currentBalance;
  const safeRecharge = isNaN(rechargeAmount) || rechargeAmount <= 0 ? 0 : rechargeAmount;

  return Math.round((safeBalance + safeRecharge) * 100) / 100;
}

export const calculateClientAccountTopUp = calculateClientRecharge;

/**
 * Aggregates financial report metrics across sessions.
 */
export function calculateFinancialStats(
  sessions: Array<{
    status: string;
    total_amount?: number | null;
    time_cost?: number | null;
    extras_total?: number | null;
    duration_minutes?: number | null;
    payment_method?: string | null;
  }>
): {
  totalRevenue: number;
  totalSessions: number;
  totalMinutes: number;
  averageDurationMinutes: number;
  averageTicket: number;
  timeRevenue: number;
  extrasRevenue: number;
  paymentBreakdown: Record<string, { count: number; total: number }>;
} {
  const completed = sessions.filter((s) => s.status === 'completed');
  const totalSessions = completed.length;

  let totalRevenue = 0;
  let timeRevenue = 0;
  let extrasRevenue = 0;
  let totalMinutes = 0;
  const paymentBreakdown: Record<string, { count: number; total: number }> = {};

  for (const s of completed) {
    const amount = Number(s.total_amount || 0);
    const time = Number(s.time_cost || 0);
    const extras = Number(s.extras_total || 0);
    const duration = Number(s.duration_minutes || 0);
    const method = s.payment_method || 'other';

    totalRevenue += amount;
    timeRevenue += time;
    extrasRevenue += extras;
    totalMinutes += duration;

    if (!paymentBreakdown[method]) {
      paymentBreakdown[method] = { count: 0, total: 0 };
    }
    paymentBreakdown[method].count += 1;
    paymentBreakdown[method].total = Math.round((paymentBreakdown[method].total + amount) * 100) / 100;
  }

  totalRevenue = Math.round(totalRevenue * 100) / 100;
  timeRevenue = Math.round(timeRevenue * 100) / 100;
  extrasRevenue = Math.round(extrasRevenue * 100) / 100;

  const averageDurationMinutes =
    totalSessions > 0 ? Math.round((totalMinutes / totalSessions) * 10) / 10 : 0;
  const averageTicket =
    totalSessions > 0 ? Math.round((totalRevenue / totalSessions) * 100) / 100 : 0;

  return {
    totalRevenue,
    totalSessions,
    totalMinutes,
    averageDurationMinutes,
    averageTicket,
    timeRevenue,
    extrasRevenue,
    paymentBreakdown,
  };
}

/**
 * Formats a number to Moroccan Dirhams (DH) string with 2 decimals.
 */
export function formatDH(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0.00 DH';
  }
  return `${amount.toFixed(2)} DH`;
}
