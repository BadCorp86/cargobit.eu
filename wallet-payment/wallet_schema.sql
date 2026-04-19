-- ============================================================
-- CargoBit Wallet Database Schema
-- ============================================================
-- Audit-fähig, idempotent, Stripe-kompatibel, ledger-basiert
-- Version: 1.0.0
-- Erstellt: 2026-04-19
-- ============================================================

-- 1) WALLETS
-- Eine Zeile pro Nutzer
-- Speichert den aktuellen Kontostand (in Cents für Präzision)
-- ============================================================

CREATE TABLE IF NOT EXISTS wallets (
  wallet_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID UNIQUE NOT NULL,
  balance_cents    BIGINT NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  currency         VARCHAR(10) NOT NULL DEFAULT 'EUR',
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);

COMMENT ON TABLE wallets IS 'Wallet-Konten pro Nutzer (ein Wallet pro User)';
COMMENT ON COLUMN wallets.balance_cents IS 'Kontostand in Cents (1 EUR = 100 Cents)';

-- ============================================================
-- 2) WALLET_TRANSACTIONS
-- Das Herzstück: vollständiges Ledger
-- Jede Transaktion wird hier protokolliert
-- ============================================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
  tx_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id        UUID NOT NULL,
  amount_cents     BIGINT NOT NULL,
  balance_before   BIGINT NOT NULL,
  balance_after    BIGINT NOT NULL,
  type             VARCHAR(20) NOT NULL CHECK (type IN (
    'topup',           -- Guthabenaufladung
    'payout',          -- Auszahlung an Transporteur
    'fee',             -- Plattformgebühr
    'refund',          -- Rückerstattung
    'booking',         -- Auftragsbuchung
    'payout_fee',      -- Auszahlungsgebühr
    'subscription',    -- Abo-Gebühr
    'bonus',           -- Bonus/Guthaben
    'adjustment'       -- Manuelle Korrektur
  )),
  status           VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'succeeded',
    'failed',
    'cancelled'
  )),
  reference_id     VARCHAR(255),         -- Stripe PaymentIntent, Payout ID, Order ID, etc.
  reference_type   VARCHAR(50),          -- 'stripe_payment_intent', 'stripe_payout', 'order', 'subscription'
  description      TEXT,
  metadata         JSONB DEFAULT '{}',   -- Zusätzliche Infos (user_id, orderId, etc.)
  idempotency_key  VARCHAR(255) UNIQUE,  -- Für idempotente Transaktionen
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at     TIMESTAMP,
  
  FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id) ON DELETE RESTRICT
);

CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_reference_id ON wallet_transactions(reference_id);
CREATE INDEX idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX idx_wallet_transactions_created_at ON wallet_transactions(created_at);
CREATE INDEX idx_wallet_transactions_idempotency_key ON wallet_transactions(idempotency_key);

COMMENT ON TABLE wallet_transactions IS 'Vollständiges Transaktions-Ledger (Audit-fähig)';
COMMENT ON COLUMN wallet_transactions.balance_before IS 'Kontostand VOR der Transaktion';
COMMENT ON COLUMN wallet_transactions.balance_after IS 'Kontostand NACH der Transaktion';
COMMENT ON COLUMN wallet_transactions.idempotency_key IS 'Einzigartiger Key für idempotente Transaktionen';

-- ============================================================
-- 3) PAYOUT_REQUESTS
-- Auszahlungsanforderungen von Transporteuren
-- ============================================================

CREATE TABLE IF NOT EXISTS payout_requests (
  payout_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id        UUID NOT NULL,
  user_id          UUID NOT NULL,
  amount_cents     BIGINT NOT NULL CHECK (amount_cents > 0),
  fee_cents        BIGINT NOT NULL DEFAULT 0,
  net_amount_cents BIGINT NOT NULL CHECK (net_amount_cents > 0),
  status           VARCHAR(20) NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested',      -- Angefordert
    'processing',     -- Wird verarbeitet
    'paid',           -- Ausgezahlt
    'failed',         -- Fehlgeschlagen
    'cancelled'       -- Storniert
  )),
  stripe_payout_id VARCHAR(255),
  stripe_account_id VARCHAR(255),        -- Stripe Connect Account ID
  bank_last4       VARCHAR(4),           -- Letzte 4 Ziffern der Bankverbindung
  failure_reason   TEXT,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at     TIMESTAMP,
  
  FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id) ON DELETE RESTRICT
);

CREATE INDEX idx_payout_requests_wallet_id ON payout_requests(wallet_id);
CREATE INDEX idx_payout_requests_user_id ON payout_requests(user_id);
CREATE INDEX idx_payout_requests_status ON payout_requests(status);
CREATE INDEX idx_payout_requests_stripe_payout_id ON payout_requests(stripe_payout_id);
CREATE INDEX idx_payout_requests_created_at ON payout_requests(created_at);

COMMENT ON TABLE payout_requests IS 'Auszahlungsanforderungen von Transporteuren';

-- ============================================================
-- 4) SUBSCRIPTION_STATUS
-- Abo-Status für Verlader und Transporteure
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_status (
  user_id          UUID PRIMARY KEY,
  plan             VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (plan IN (
    'free',           -- Kostenlos
    'pro',            -- Pro (9,99 EUR/Monat)
    'business',       -- Business (24,99 EUR/Monat)
    'fleet'           -- Fleet (39,99 EUR/Monat)
  )),
  user_type        VARCHAR(20) NOT NULL CHECK (user_type IN (
    'shipper',        -- Verlader
    'carrier'         -- Transporteur
  )),
  stripe_customer_id VARCHAR(255),
  stripe_sub_id    VARCHAR(255),
  status           VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',
    'past_due',
    'canceled',
    'incomplete',
    'trialing'
  )),
  current_period_start TIMESTAMP,
  current_period_end   TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  trial_end        TIMESTAMP,
  wallet_fee_percent DECIMAL(5,2) DEFAULT 3.50,  -- Wallet-Gebühr in Prozent
  features         JSONB DEFAULT '{}',            -- Feature-Flags pro Abo
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscription_status_user_id ON subscription_status(user_id);
CREATE INDEX idx_subscription_status_stripe_customer_id ON subscription_status(stripe_customer_id);
CREATE INDEX idx_subscription_status_stripe_sub_id ON subscription_status(stripe_sub_id);
CREATE INDEX idx_subscription_status_plan ON subscription_status(plan);
CREATE INDEX idx_subscription_status_status ON subscription_status(status);

COMMENT ON TABLE subscription_status IS 'Abo-Status für alle Nutzer';

-- ============================================================
-- 5) WALLET_TOPUP_SESSIONS
-- Für Stripe Checkout Sessions (Guthabenaufladung)
-- ============================================================

CREATE TABLE IF NOT EXISTS wallet_topup_sessions (
  session_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id        UUID NOT NULL,
  user_id          UUID NOT NULL,
  amount_cents     BIGINT NOT NULL CHECK (amount_cents > 0),
  currency         VARCHAR(10) NOT NULL DEFAULT 'EUR',
  stripe_session_id VARCHAR(255) UNIQUE,
  stripe_payment_intent_id VARCHAR(255),
  status           VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'completed',
    'expired',
    'cancelled'
  )),
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMP,
  completed_at     TIMESTAMP,
  
  FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id) ON DELETE RESTRICT
);

CREATE INDEX idx_wallet_topup_sessions_wallet_id ON wallet_topup_sessions(wallet_id);
CREATE INDEX idx_wallet_topup_sessions_user_id ON wallet_topup_sessions(user_id);
CREATE INDEX idx_wallet_topup_sessions_stripe_session_id ON wallet_topup_sessions(stripe_session_id);
CREATE INDEX idx_wallet_topup_sessions_status ON wallet_topup_sessions(status);

COMMENT ON TABLE wallet_topup_sessions IS 'Stripe Checkout Sessions für Guthabenaufladung';

-- ============================================================
-- 6) CONNECTED_ACCOUNTS
-- Stripe Connect Accounts für Transporteure (Payouts)
-- ============================================================

CREATE TABLE IF NOT EXISTS connected_accounts (
  account_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID UNIQUE NOT NULL,
  stripe_account_id VARCHAR(255) UNIQUE NOT NULL,
  account_status   VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (account_status IN (
    'pending',        -- Noch nicht verifiziert
    'verified',       -- Verifiziert
    'restricted',     -- Eingeschränkt
    'rejected'        -- Abgelehnt
  )),
  payouts_enabled  BOOLEAN DEFAULT FALSE,
  charges_enabled  BOOLEAN DEFAULT FALSE,
  country          VARCHAR(2),
  default_currency VARCHAR(10),
  business_type    VARCHAR(20),
  company_name     VARCHAR(255),
  individual_first_name VARCHAR(100),
  individual_last_name  VARCHAR(100),
  bank_last4       VARCHAR(4),
  bank_country     VARCHAR(2),
  requirements     JSONB DEFAULT '{}',     -- Fehlende Anforderungen
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_connected_accounts_user_id ON connected_accounts(user_id);
CREATE INDEX idx_connected_accounts_stripe_account_id ON connected_accounts(stripe_account_id);
CREATE INDEX idx_connected_accounts_account_status ON connected_accounts(account_status);

COMMENT ON TABLE connected_accounts IS 'Stripe Connect Accounts für Transporteure';

-- ============================================================
-- 7) TRANSAKTIONS-VIEWS (Für Reporting & Audit)
-- ============================================================

-- View: Alle Transaktionen mit User-Infos
CREATE OR REPLACE VIEW vw_wallet_transactions_full AS
SELECT 
  t.tx_id,
  t.wallet_id,
  w.user_id,
  t.amount_cents,
  t.balance_before,
  t.balance_after,
  t.type,
  t.status,
  t.reference_id,
  t.reference_type,
  t.description,
  t.metadata,
  t.created_at,
  t.processed_at
FROM wallet_transactions t
JOIN wallets w ON t.wallet_id = w.wallet_id
ORDER BY t.created_at DESC;

-- View: Wallet-Zusammenfassung pro User
CREATE OR REPLACE VIEW vw_wallet_summary AS
SELECT 
  w.wallet_id,
  w.user_id,
  w.balance_cents,
  w.currency,
  COUNT(t.tx_id) FILTER (WHERE t.status = 'succeeded') as total_transactions,
  COALESCE(SUM(t.amount_cents) FILTER (WHERE t.type = 'topup' AND t.status = 'succeeded'), 0) as total_topups_cents,
  COALESCE(SUM(t.amount_cents) FILTER (WHERE t.type = 'payout' AND t.status = 'succeeded'), 0) as total_payouts_cents,
  COALESCE(SUM(t.amount_cents) FILTER (WHERE t.type = 'fee' AND t.status = 'succeeded'), 0) as total_fees_cents,
  MAX(t.created_at) as last_transaction_at
FROM wallets w
LEFT JOIN wallet_transactions t ON w.wallet_id = t.wallet_id
GROUP BY w.wallet_id, w.user_id, w.balance_cents, w.currency;

-- View: Payout-Statistiken
CREATE OR REPLACE VIEW vw_payout_stats AS
SELECT 
  user_id,
  COUNT(*) as total_payouts,
  SUM(amount_cents) as total_amount_cents,
  SUM(fee_cents) as total_fees_cents,
  AVG(amount_cents) as avg_payout_cents,
  COUNT(*) FILTER (WHERE status = 'paid') as successful_payouts,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_payouts
FROM payout_requests
GROUP BY user_id;

COMMENT ON VIEW vw_wallet_transactions_full IS 'Alle Transaktionen mit User-Infos für Audit';
COMMENT ON VIEW vw_wallet_summary IS 'Wallet-Zusammenfassung pro User';
COMMENT ON VIEW vw_payout_stats IS 'Payout-Statistiken pro User';

-- ============================================================
-- 8) TRIGGER FÜR AUTOMATISCHE updated_at AKTUALISIERUNG
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_wallets_updated_at 
    BEFORE UPDATE ON wallets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payout_requests_updated_at 
    BEFORE UPDATE ON payout_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_status_updated_at 
    BEFORE UPDATE ON subscription_status 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_connected_accounts_updated_at 
    BEFORE UPDATE ON connected_accounts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 9) WALLET-GEBÜHREN KONFIGURATION
-- ============================================================

CREATE TABLE IF NOT EXISTS wallet_fee_config (
  config_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan             VARCHAR(20) NOT NULL UNIQUE,
  user_type        VARCHAR(20) NOT NULL,
  wallet_fee_percent DECIMAL(5,2) NOT NULL DEFAULT 3.50,
  payout_fee_fixed_cents BIGINT NOT NULL DEFAULT 0,
  payout_fee_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  min_payout_cents BIGINT NOT NULL DEFAULT 1000,  -- Mindestauszahlung 10 EUR
  max_topup_cents  BIGINT NOT NULL DEFAULT 100000, -- Max. 1000 EUR pro Aufladung
  max_daily_topup_cents BIGINT NOT NULL DEFAULT 500000, -- Max. 5000 EUR pro Tag
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Standard-Gebührenkonfiguration einfügen
INSERT INTO wallet_fee_config (plan, user_type, wallet_fee_percent, payout_fee_fixed_cents, payout_fee_percent, min_payout_cents) VALUES
('free', 'shipper', 3.50, 50, 1.00, 1000),
('pro', 'shipper', 2.50, 50, 0.50, 1000),
('business', 'shipper', 1.50, 0, 0.00, 500),
('free', 'carrier', 3.50, 50, 1.00, 1000),
('pro', 'carrier', 2.00, 25, 0.50, 500),
('fleet', 'carrier', 1.00, 0, 0.00, 500)
ON CONFLICT (plan) DO UPDATE SET 
  user_type = EXCLUDED.user_type,
  wallet_fee_percent = EXCLUDED.wallet_fee_percent,
  payout_fee_fixed_cents = EXCLUDED.payout_fee_fixed_cents,
  payout_fee_percent = EXCLUDED.payout_fee_percent,
  min_payout_cents = EXCLUDED.min_payout_cents;

COMMENT ON TABLE wallet_fee_config IS 'Gebührenkonfiguration pro Abo-Plan und User-Typ';

-- ============================================================
-- ENDE SCHEMA
-- ============================================================
