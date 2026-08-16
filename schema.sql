-- Enable the "uuid-ossp" extension to generate UUIDs if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Enable pgcrypto so we can verify bcrypt hashes inside Postgres
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

-- 2.1 Maps an anonymous auth session to the staff member it belongs to
CREATE TABLE staff_sessions (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
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
-- ROW LEVEL SECURITY (RLS) & HELPER FUNCTIONS
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE cafes ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Resolves "what café does the current caller belong to" for BOTH
-- owners (via cafes.owner_id) and staff (via staff_sessions)
CREATE OR REPLACE FUNCTION current_cafe_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM cafes WHERE owner_id = auth.uid()
  UNION
  SELECT cafe_id FROM staff_sessions WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- RLS POLICIES
DROP POLICY IF EXISTS "Cafes access" ON cafes;
DROP POLICY IF EXISTS "Staff access" ON staff;
DROP POLICY IF EXISTS "Client accounts access" ON client_accounts;
DROP POLICY IF EXISTS "Products access" ON products;
DROP POLICY IF EXISTS "Sessions access" ON sessions;
DROP POLICY IF EXISTS "Balance transactions access" ON balance_transactions;
DROP POLICY IF EXISTS "Audit log access" ON audit_log;

CREATE POLICY "Cafes access" ON cafes
  FOR ALL USING (id = current_cafe_id()) WITH CHECK (id = current_cafe_id());

CREATE POLICY "Staff access" ON staff
  FOR ALL USING (cafe_id = current_cafe_id()) WITH CHECK (cafe_id = current_cafe_id());

CREATE POLICY "Client accounts access" ON client_accounts
  FOR ALL USING (cafe_id = current_cafe_id()) WITH CHECK (cafe_id = current_cafe_id());

CREATE POLICY "Products access" ON products
  FOR ALL USING (cafe_id = current_cafe_id()) WITH CHECK (cafe_id = current_cafe_id());

CREATE POLICY "Sessions access" ON sessions
  FOR ALL USING (cafe_id = current_cafe_id()) WITH CHECK (cafe_id = current_cafe_id());

CREATE POLICY "Balance transactions access" ON balance_transactions
  FOR ALL USING (cafe_id = current_cafe_id()) WITH CHECK (cafe_id = current_cafe_id());

CREATE POLICY "Audit log access" ON audit_log
  FOR ALL USING (cafe_id = current_cafe_id()) WITH CHECK (cafe_id = current_cafe_id());

-- ==========================================
-- AUTHENTICATION & LOGIN RPCs
-- ==========================================

-- Public: look up a café by invite code, minimal fields only
CREATE OR REPLACE FUNCTION lookup_cafe_by_invite(p_code TEXT)
RETURNS TABLE(id UUID, name TEXT, setup_complete BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, setup_complete FROM cafes WHERE invite_code = p_code;
$$;

-- Public: list active staff names for a café (no pin_hash)
CREATE OR REPLACE FUNCTION list_staff_for_login(p_cafe_id UUID)
RETURNS TABLE(id UUID, name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name FROM staff WHERE cafe_id = p_cafe_id AND active = TRUE;
$$;

-- Must be called AFTER supabase.auth.signInAnonymously(), so auth.uid()
-- is the anonymous session we're about to link. Verifies the PIN server-
-- side and creates the staff_sessions link on success — pin_hash never
-- leaves the database.
CREATE OR REPLACE FUNCTION staff_pin_login(p_cafe_id UUID, p_staff_id UUID, p_pin TEXT)
RETURNS TABLE(id UUID, name TEXT, permissions JSONB)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT pin_hash INTO v_hash FROM staff
    WHERE id = p_staff_id AND cafe_id = p_cafe_id AND active = TRUE;

  IF v_hash IS NULL OR crypt(p_pin, v_hash) <> v_hash THEN
    RAISE EXCEPTION 'invalid_pin';
  END IF;

  INSERT INTO staff_sessions (user_id, staff_id, cafe_id)
  VALUES (auth.uid(), p_staff_id, p_cafe_id)
  ON CONFLICT (user_id) DO UPDATE SET staff_id = EXCLUDED.staff_id, cafe_id = EXCLUDED.cafe_id;

  UPDATE staff SET last_login_at = NOW() WHERE id = p_staff_id;

  RETURN QUERY SELECT staff.id, staff.name, staff.permissions FROM staff WHERE staff.id = p_staff_id;
END;
$$;

-- ==========================================
-- REALTIME SUBSCRIPTIONS
-- ==========================================
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
