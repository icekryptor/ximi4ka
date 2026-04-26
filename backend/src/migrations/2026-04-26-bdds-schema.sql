-- Extensions to existing tables
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS cashflow_section varchar(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parent_id uuid DEFAULT NULL REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_cashflow_section ON categories(cashflow_section);

-- bank_accounts: our own accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  bank_code varchar(20) NOT NULL,
  account_number varchar(30),
  currency varchar(3) DEFAULT 'RUB',
  opening_balance numeric(15, 2) DEFAULT 0,
  opening_date date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- bank_imports: import history
CREATE TABLE IF NOT EXISTS bank_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
  file_name varchar(255) NOT NULL,
  period_start date,
  period_end date,
  total_rows integer DEFAULT 0,
  imported_rows integer DEFAULT 0,
  skipped_duplicates integer DEFAULT 0,
  status varchar(20) DEFAULT 'pending',
  error_message text,
  imported_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_imports_account ON bank_imports(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_imports_status ON bank_imports(status);

-- import_rules: learned matching rules
CREATE TABLE IF NOT EXISTS import_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_type varchar(30) NOT NULL,
  match_value varchar(255) NOT NULL,
  counterparty_id uuid REFERENCES counterparties(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  is_inter_transfer boolean DEFAULT false,
  hit_count integer DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_import_rules_unique
  ON import_rules(match_type, match_value);

-- Extensions to transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS import_id uuid REFERENCES bank_imports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS raw_description text,
  ADD COLUMN IF NOT EXISTS external_id varchar(100),
  ADD COLUMN IF NOT EXISTS is_inter_account_transfer boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked_transfer_id uuid REFERENCES transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_bank_account ON transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_import ON transactions(import_id);
CREATE INDEX IF NOT EXISTS idx_transactions_external_id ON transactions(external_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_unique
  ON transactions(bank_account_id, external_id) WHERE external_id IS NOT NULL;

-- Seed: Tochka and Ozon bank accounts
INSERT INTO bank_accounts (name, bank_code, account_number, currency)
VALUES
  ('Точка', 'tochka', '40802810220000929747', 'RUB'),
  ('Озон Банк', 'ozon', '40802810800000080788', 'RUB')
ON CONFLICT DO NOTHING;
