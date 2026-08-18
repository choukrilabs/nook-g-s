import { Session, Cafe, SessionExtra } from "../types";
import {
  calculateDuration,
  calculateTimeCost,
  calculateExtrasTotal,
  calculateSessionTotal,
} from "./calculations";

export interface PricingRates {
  defaultRate: number;
  premiumRate: number; // minimum rate
}

/**
 * Given a session configuration and rates, calculate the hourly rate applied.
 */
export function determineSessionRate(
  sessionMode: "time" | "consumption" | string | null,
  rates: PricingRates,
): number {
  return sessionMode === "consumption" ? 0 : rates.defaultRate;
}

/**
 * Calculates the current real-time or final cost of an active/completed session.
 */
export function calculateSessionCost(
  session: Partial<Session> & { started_at: string; rate_per_hour: number; extras_total: number },
  rates: PricingRates,
  minChargeHours: number = 1
) {
  // 1. Determine duration
  const end =
    session.status === "completed" && session.ended_at
      ? session.ended_at
      : null;
  const { durationMinutes, hours, formatted } = calculateDuration(
    session.started_at,
    end,
  );

  // 2. Calculate Time Cost
  let timeCost;
  if (session.status === "completed" && session.time_cost !== undefined) {
    timeCost = session.time_cost || 0;
  } else {
    timeCost = calculateTimeCost(
      durationMinutes,
      session.rate_per_hour,
      minChargeHours,
    );
  }

  // 3. Calculate Totals against Minimum Rate
  const { rawTotal, totalAmount } = calculateSessionTotal(
    timeCost,
    session.extras_total,
    rates.premiumRate, // Acts as minimum rate
  );

  return {
    durationMinutes,
    durationHours: hours,
    durationFormatted: formatted,
    timeCost,
    extrasTotal: session.extras_total,
    rawTotal,
    totalAmount,
    isLongSession: hours >= 3, // Logic from SessionDetailPage
  };
}

/**
 * Calculates new totals when extras are added or removed.
 */
export function calculateNewExtrasTotal(extras: SessionExtra[]): number {
  return calculateExtrasTotal(extras);
}
