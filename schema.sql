-- Enable the "uuid-ossp" extension to generate UUIDs if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- TABLES CREATION
-- ==========================================

-- 1. Cafes table
CREATE TABLE cafes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    city TEXT,
    invite_code TEXT UNIQUE NOT NULL,
    total_seats INTEGER DEFAULT 20,
    default_rate DECIMAL(10, 2) DEFAULT 10.0,
    premium_rate DECIMAL(10, 2) DEFAULT 15.0,
    billing_increment TEXT DEFAULT 'minute',
    long_session_alert_hours INTEGER DEFAULT 2,
    low_balance_alert DECIMAL(10, 2) DEFAULT 20.0,
    language TEXT DEFAULT 'fr',
    setup_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Staff table
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    pin_hash TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    permissions JSONB DEFAULT '{"sessions": true, "reports": false, "clients": false, "settings": false}'::jsonb,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Client Accounts table
CREATE TABLE client_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    balance DECIMAL(10, 2) DEFAULT 0.0,
    notes TEXT,
    total_visits INTEGER DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Products table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    category TEXT DEFAULT 'general',
    active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    seat_number INTEGER NOT NULL,
    rate_per_hour DECIMAL(10, 2) NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    time_cost DECIMAL(10, 2),
    extras JSONB DEFAULT '[]'::jsonb,
    extras_total DECIMAL(10, 2) DEFAULT 0.0,
    total_amount DECIMAL(10, 2) DEFAULT 0.0,
    payment_method TEXT,
    amount_received DECIMAL(10, 2),
    change_given DECIMAL(10, 2),
    client_account_id UUID REFERENCES client_accounts(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Balance Transactions table
CREATE TABLE balance_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    type TEXT NOT NULL, -- e.g., 'credit', 'debit'
    amount DECIMAL(10, 2) NOT NULL,
    balance_before DECIMAL(10, 2) NOT NULL,
    balance_after DECIMAL(10, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Audit Log table
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    is_owner BOOLEAN DEFAULT FALSE,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================
-- To allow the client side app to work without strict RLS initially,
-- you can just disable RLS or create open policies.
-- In full production, you would restrict these based on cafe_id and auth.uid().

-- Enable RLS on all tables
ALTER TABLE cafes ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Note: The following policies are set to allow FULL ACCESS for authenticated and anonymous users.
-- This is necessary since the app uses invite codes and offline sync from multiple devices.
-- If you want strict security, you should tie access to auth.uid() or a JWT claim.

CREATE POLICY "Allow all operations for cafes" ON cafes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for staff" ON staff FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for client_accounts" ON client_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for balance_transactions" ON balance_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for audit_log" ON audit_log FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- REALTIME SUBSCRIPTIONS
-- ==========================================
-- Enable Supabase Realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE cafes;
ALTER PUBLICATION supabase_realtime ADD TABLE client_accounts;

-- ==========================================
-- TRIGGERS (Auto-update updated_at)
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cafes_updated_at
    BEFORE UPDATE ON cafes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_accounts_updated_at
    BEFORE UPDATE ON client_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
