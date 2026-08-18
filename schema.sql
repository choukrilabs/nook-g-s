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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    failed_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ
);
REVOKE SELECT (pin_hash) ON staff FROM authenticated, anon;

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
    balance DECIMAL(10, 2) DEFAULT 0.0 CHECK (balance >= 0),
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
    total_amount DECIMAL(10, 2) DEFAULT 0.0 CHECK (total_amount >= 0),
    payment_method TEXT,
    amount_received DECIMAL(10, 2),
    change_given DECIMAL(10, 2),
    client_account_id UUID REFERENCES client_accounts(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
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
DROP POLICY IF EXISTS "Cafes owner all" ON cafes;
DROP POLICY IF EXISTS "Cafes staff select" ON cafes;
DROP POLICY IF EXISTS "Staff access" ON staff;
DROP POLICY IF EXISTS "Staff select" ON staff;
DROP POLICY IF EXISTS "Staff owner manage" ON staff;
DROP POLICY IF EXISTS "Staff sessions access" ON staff_sessions;
DROP POLICY IF EXISTS "Client accounts access" ON client_accounts;
DROP POLICY IF EXISTS "Client accounts select" ON client_accounts;
DROP POLICY IF EXISTS "Client accounts insert" ON client_accounts;
DROP POLICY IF EXISTS "Client accounts update" ON client_accounts;
DROP POLICY IF EXISTS "Client accounts owner delete" ON client_accounts;
DROP POLICY IF EXISTS "Products access" ON products;
DROP POLICY IF EXISTS "Products select" ON products;
DROP POLICY IF EXISTS "Products owner manage" ON products;
DROP POLICY IF EXISTS "Sessions access" ON sessions;
DROP POLICY IF EXISTS "Sessions select" ON sessions;
DROP POLICY IF EXISTS "Sessions insert" ON sessions;
DROP POLICY IF EXISTS "Sessions update" ON sessions;
DROP POLICY IF EXISTS "Sessions owner delete" ON sessions;
DROP POLICY IF EXISTS "Balance transactions access" ON balance_transactions;
DROP POLICY IF EXISTS "Balance transactions select" ON balance_transactions;
DROP POLICY IF EXISTS "Balance transactions insert" ON balance_transactions;
DROP POLICY IF EXISTS "Balance transactions owner manage" ON balance_transactions;
DROP POLICY IF EXISTS "Audit log access" ON audit_log;
DROP POLICY IF EXISTS "Audit log select" ON audit_log;
DROP POLICY IF EXISTS "Audit log insert" ON audit_log;
DROP POLICY IF EXISTS "Audit log owner delete" ON audit_log;

-- 1. Cafes table:
-- Owners have full CRUD access to their own cafe(s)
CREATE POLICY "Cafes owner all" ON cafes
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Staff have read-only access to their assigned cafe
CREATE POLICY "Cafes staff select" ON cafes
  FOR SELECT
  USING (id = current_cafe_id());

-- 2. Staff sessions table:
CREATE POLICY "Staff sessions select" ON staff_sessions
  FOR SELECT
  USING (user_id = auth.uid());

-- 3. Staff table:
-- Staff and owners can view staff list for their cafe
CREATE POLICY "Staff select" ON staff
  FOR SELECT
  USING (
    cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid())
    OR cafe_id = current_cafe_id()
  );

-- Only owners can insert, update, or delete staff records (prevents privilege escalation)
CREATE POLICY "Staff owner manage" ON staff
  FOR ALL
  USING (cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid()))
  WITH CHECK (cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid()));

-- 4. Client accounts table:
CREATE POLICY "Client accounts select" ON client_accounts
  FOR SELECT
  USING (
    cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid())
    OR cafe_id = current_cafe_id()
  );

CREATE POLICY "Client accounts insert" ON client_accounts
  FOR INSERT
  WITH CHECK (
    cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid())
    OR cafe_id = current_cafe_id()
  );

CREATE POLICY "Client accounts update" ON client_accounts
  FOR UPDATE
  USING (
    cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid())
    OR cafe_id = current_cafe_id()
  )
  WITH CHECK (
    cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid())
    OR cafe_id = current_cafe_id()
  );

CREATE POLICY "Client accounts owner delete" ON client_accounts
  FOR DELETE
  USING (cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid()));

-- 5. Products table:
CREATE POLICY "Products select" ON products
  FOR SELECT
  USING (
    cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid())
    OR cafe_id = current_cafe_id()
  );

-- Only owners can insert/update/delete products
CREATE POLICY "Products owner manage" ON products
  FOR ALL
  USING (cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid()))
  WITH CHECK (cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid()));

-- 6. Sessions table:
CREATE POLICY "Sessions select" ON sessions
  FOR SELECT
  USING (
    cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid())
    OR cafe_id = current_cafe_id()
  );

CREATE POLICY "Sessions insert" ON sessions
  FOR INSERT
  WITH CHECK (
    cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid())
    OR cafe_id = current_cafe_id()
  );

CREATE POLICY "Sessions update" ON sessions
  FOR UPDATE
  USING (
    cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid())
    OR cafe_id = current_cafe_id()
  )
  WITH CHECK (
    cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid())
    OR cafe_id = current_cafe_id()
  );

CREATE POLICY "Sessions owner delete" ON sessions
  FOR DELETE
  USING (cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid()));

-- 7. Balance transactions table:
CREATE POLICY "Balance transactions select" ON balance_transactions
  FOR SELECT
  USING (
    cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid())
    OR cafe_id = current_cafe_id()
  );

CREATE POLICY "Balance transactions insert" ON balance_transactions
  FOR INSERT
  WITH CHECK (
    cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid())
    OR cafe_id = current_cafe_id()
  );

CREATE POLICY "Balance transactions owner manage" ON balance_transactions
  FOR DELETE
  USING (cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid()));

-- 8. Audit log table (strictly append-only for staff, tamper-proof):
CREATE POLICY "Audit log select" ON audit_log
  FOR SELECT
  USING (
    cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid())
    OR cafe_id = current_cafe_id()
  );

CREATE POLICY "Audit log insert" ON audit_log
  FOR INSERT
  WITH CHECK (
    cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid())
    OR cafe_id = current_cafe_id()
  );

-- ==========================================
-- INDEXES FOR PERFORMANCE & CONCURRENCY
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_cafes_owner_id ON cafes(owner_id);
CREATE INDEX IF NOT EXISTS idx_staff_cafe_id ON staff(cafe_id);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_user ON staff_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_cafe_status ON sessions(cafe_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_cafe_started_at ON sessions(cafe_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_ended_at ON sessions(cafe_id, ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_client_id ON sessions(client_account_id);
CREATE INDEX IF NOT EXISTS idx_products_cafe_active ON products(cafe_id, active);
CREATE INDEX IF NOT EXISTS idx_client_accounts_cafe ON client_accounts(cafe_id);
CREATE INDEX IF NOT EXISTS idx_balance_tx_client ON balance_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_balance_tx_cafe ON balance_transactions(cafe_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_cafe_created ON audit_log(cafe_id, created_at DESC);

-- Partial unique index to prevent double-booking seats simultaneously
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_seat ON sessions(cafe_id, seat_number) WHERE status = 'active';

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
  v_staff RECORD;
BEGIN
  SELECT * INTO v_staff FROM staff
    WHERE staff.id = p_staff_id AND cafe_id = p_cafe_id AND active = TRUE;

  IF v_staff IS NULL THEN
    RAISE EXCEPTION 'invalid_pin';
  END IF;

  IF v_staff.locked_until IS NOT NULL AND v_staff.locked_until > NOW() THEN
    RAISE EXCEPTION 'account_locked';
  END IF;

  IF v_staff.pin_hash IS NULL OR crypt(p_pin, v_staff.pin_hash) <> v_staff.pin_hash THEN
    UPDATE staff 
    SET failed_attempts = failed_attempts + 1,
        locked_until = CASE 
            WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes' 
            ELSE locked_until 
        END
    WHERE staff.id = p_staff_id;
    
    RAISE EXCEPTION 'invalid_pin';
  END IF;

  UPDATE staff 
  SET last_login_at = NOW(),
      failed_attempts = 0,
      locked_until = NULL
  WHERE staff.id = p_staff_id;

  INSERT INTO staff_sessions (user_id, staff_id, cafe_id)
  VALUES (auth.uid(), p_staff_id, p_cafe_id)
  ON CONFLICT (user_id) DO UPDATE SET staff_id = EXCLUDED.staff_id, cafe_id = EXCLUDED.cafe_id;

  RETURN QUERY SELECT staff.id, staff.name, staff.permissions FROM staff WHERE staff.id = p_staff_id;
END;
$$;

-- ==========================================
-- CLIENT BALANCE ATOMIC TRANSACTION RPC
-- ==========================================
CREATE OR REPLACE FUNCTION process_client_balance_transaction(
  p_cafe_id UUID,
  p_client_id UUID,
  p_amount DECIMAL,
  p_type TEXT, -- 'credit' or 'debit'
  p_description TEXT DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_session_id UUID DEFAULT NULL
)
RETURNS TABLE(new_balance DECIMAL, transaction_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client RECORD;
  v_new_balance DECIMAL;
  v_tx_id UUID;
BEGIN
  -- Validate caller belongs to this cafe
  IF p_cafe_id <> current_cafe_id() AND NOT EXISTS (SELECT 1 FROM cafes WHERE id = p_cafe_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Lock client row for update
  SELECT * INTO v_client FROM client_accounts WHERE id = p_client_id AND cafe_id = p_cafe_id FOR UPDATE;
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'client_not_found';
  END IF;

  IF p_type = 'credit' THEN
    v_new_balance := v_client.balance + p_amount;
  ELSIF p_type = 'debit' THEN
    v_new_balance := v_client.balance - p_amount;
  ELSE
    RAISE EXCEPTION 'invalid_transaction_type';
  END IF;

  -- Prevent direct updates to balance except via this RPC
  PERFORM set_config('app.bypass_balance_check', 'true', true);

  -- Update client balance and metrics
  UPDATE client_accounts
  SET balance = v_new_balance,
      total_spent = CASE WHEN p_type = 'debit' THEN total_spent + p_amount ELSE total_spent END,
      updated_at = NOW()
  WHERE id = p_client_id;

  -- Insert ledger transaction
  INSERT INTO balance_transactions (
    cafe_id,
    client_id,
    session_id,
    staff_id,
    type,
    amount,
    balance_before,
    balance_after,
    description
  )
  VALUES (
    p_cafe_id,
    p_client_id,
    p_session_id,
    p_staff_id,
    p_type,
    p_amount,
    v_client.balance,
    v_new_balance,
    p_description
  )
  RETURNING id INTO v_tx_id;

  RETURN QUERY SELECT v_new_balance, v_tx_id;
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

-- Trigger to prevent direct balance updates
CREATE OR REPLACE FUNCTION prevent_direct_balance_update()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.bypass_balance_check', true) = 'true' THEN
        RETURN NEW;
    END IF;

    IF NEW.balance IS DISTINCT FROM OLD.balance THEN
        RAISE EXCEPTION 'Direct balance updates are not allowed. Use process_client_balance_transaction RPC.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_direct_balance_update_trigger
    BEFORE UPDATE ON client_accounts
    FOR EACH ROW
    EXECUTE FUNCTION prevent_direct_balance_update();
