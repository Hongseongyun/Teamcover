-- Fund tables for membership funds
CREATE TABLE IF NOT EXISTS fund_state (
  id SERIAL PRIMARY KEY,
  start_month CHAR(7) NOT NULL,
  opening_balance BIGINT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS fund_ledger (
  id SERIAL PRIMARY KEY,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  month CHAR(7) NOT NULL,
  entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('credit','debit')),
  amount BIGINT NOT NULL CHECK (amount > 0),
  source VARCHAR(20) NOT NULL,
  payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fund_ledger_month ON fund_ledger(month);
CREATE INDEX IF NOT EXISTS idx_fund_ledger_entry_type ON fund_ledger(entry_type);


