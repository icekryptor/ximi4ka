-- Bank sync infrastructure: per-account configs + sync logs + needs_review flag.
--
-- bank_sync_config — один на (bank_account, provider). credentials_encrypted
-- хранит AES-256-GCM JSON с токенами; ключ шифрования живёт в env var
-- BANK_SYNC_SECRET_KEY на Railway.
--
-- bank_sync_log — журнал попыток для UI status + debugging.
--
-- transactions.needs_review — флаг для pending-review queue (транзакция
-- импортирована без сматчившегося ImportRule, оператор должен присвоить
-- категорию/контрагента).

CREATE TABLE IF NOT EXISTS bank_sync_config (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id       uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  provider              varchar(40) NOT NULL,
  enabled               boolean NOT NULL DEFAULT true,
  credentials_encrypted text,
  last_sync_at          timestamptz,
  last_period_end       date,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bank_account_id, provider)
);

CREATE TABLE IF NOT EXISTS bank_sync_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_sync_config_id   uuid NOT NULL REFERENCES bank_sync_config(id) ON DELETE CASCADE,
  started_at            timestamptz NOT NULL DEFAULT now(),
  finished_at           timestamptz,
  status                varchar(20) NOT NULL DEFAULT 'running',
  period_start          date,
  period_end            date,
  rows_fetched          integer NOT NULL DEFAULT 0,
  rows_imported         integer NOT NULL DEFAULT 0,
  rows_skipped_dup      integer NOT NULL DEFAULT 0,
  rows_pending_review   integer NOT NULL DEFAULT 0,
  error_message         text
);

CREATE INDEX IF NOT EXISTS idx_bank_sync_log_config_started
  ON bank_sync_log (bank_sync_config_id, started_at DESC);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_transactions_needs_review
  ON transactions (needs_review) WHERE needs_review = true;
