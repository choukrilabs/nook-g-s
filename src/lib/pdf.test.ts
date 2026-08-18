import { describe, it, expect } from 'vitest';
import { generateReceiptText } from './pdf';
import { Cafe, Session } from '../types';

describe('generateReceiptText', () => {
  const mockCafe = {
    id: 'cafe-1',
    owner_id: 'owner-1',
    name: 'Nook Coworking & Cafe',
    address: '12 Rue Hassan II, Casablanca',
    phone: '+212 522 000 000',
    city: 'Casablanca',
    invite_code: 'NOOK01',
    total_seats: 20,
    default_rate: 20,
    premium_rate: 0,
    long_session_alert_hours: 3,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  } as unknown as Cafe;

  it('should generate formatted receipt text with time cost, extras, and total', () => {
    const mockSession = {
      id: 'sess-1',
      cafe_id: 'cafe-1',
      seat_number: 4,
      customer_name: 'Karim',
      customer_phone: '+212600000000',
      client_account_id: null,
      status: 'completed',
      started_at: '2026-08-16T10:00:00Z',
      ended_at: '2026-08-16T12:00:00Z',
      duration_minutes: 120,
      rate_per_hour: 25,
      time_cost: 50,
      extras: [
        { id: 'p1', name: 'Cafe Latte', price: 18, quantity: 2, qty: 2 },
        { id: 'p2', name: 'Cookie', price: 10, qty: 1 },
      ],
      extras_total: 46,
      total_amount: 96,
      payment_method: 'cash',
      created_at: '2026-08-16T10:00:00Z',
    } as unknown as Session;

    const encoded = generateReceiptText(mockCafe, mockSession);
    const decoded = decodeURIComponent(encoded);

    expect(decoded).toContain('Nook Coworking & Cafe');
    expect(decoded).toContain('12 Rue Hassan II, Casablanca');
    expect(decoded).toContain('Place 4');
    expect(decoded).toContain('Karim');
    expect(decoded).toContain('Temps: 120m  -> 50.00 DH');
    expect(decoded).toContain('- 2x Cafe Latte: 36.00 DH');
    expect(decoded).toContain('- 1x Cookie: 10.00 DH');
    expect(decoded).toContain('*TOTAL : 96.00 DH*');
  });

  it('should format consumption-only session without time line', () => {
    const mockSession = {
      id: 'sess-2',
      cafe_id: 'cafe-1',
      seat_number: 2,
      customer_name: 'Sara',
      customer_phone: null,
      client_account_id: null,
      status: 'completed',
      started_at: '2026-08-16T14:00:00Z',
      ended_at: '2026-08-16T15:00:00Z',
      duration_minutes: 60,
      rate_per_hour: 0,
      time_cost: 0,
      extras: [{ id: 'p1', name: 'The a la Menthe', price: 15, quantity: 1, qty: 1 }],
      extras_total: 15,
      total_amount: 15,
      payment_method: 'card',
      created_at: '2026-08-16T14:00:00Z',
    } as unknown as Session;

    const encoded = generateReceiptText(mockCafe, mockSession);
    const decoded = decodeURIComponent(encoded);

    expect(decoded).toContain('Place 2');
    expect(decoded).not.toContain('Temps:');
    expect(decoded).toContain('- 1x The a la Menthe: 15.00 DH');
    expect(decoded).toContain('*TOTAL : 15.00 DH*');
  });
});
