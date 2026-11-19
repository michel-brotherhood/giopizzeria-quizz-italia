-- Gio — Da massa ao forno: esquema inicial
-- Todos os timestamps em UTC (timestamptz). Exibição em America/Sao_Paulo no cliente.

CREATE TABLE campaigns (
  id                  bigserial PRIMARY KEY,
  name                text        NOT NULL,
  is_test             boolean     NOT NULL DEFAULT false,
  state               text        NOT NULL DEFAULT 'disabled'
                       CHECK (state IN ('disabled','active','paused','closed')),
  reward_name         text,
  quantity_per_voucher integer     CHECK (quantity_per_voucher IS NULL OR quantity_per_voucher > 0),
  rules_text          text,
  rules_version       integer     NOT NULL DEFAULT 1,
  starts_at           timestamptz,
  ends_at             timestamptz,
  invitation_ttl_minutes integer  NOT NULL DEFAULT 30 CHECK (invitation_ttl_minutes > 0),
  session_ttl_minutes integer     NOT NULL DEFAULT 20 CHECK (session_ttl_minutes > 0),
  reward_ttl_minutes  integer     NOT NULL DEFAULT 60 CHECK (reward_ttl_minutes > 0),
  min_play_minutes    integer     NOT NULL DEFAULT 5  CHECK (min_play_minutes >= 0),
  total_stock         integer     NOT NULL DEFAULT 0 CHECK (total_stock >= 0),
  reserved_count      integer     NOT NULL DEFAULT 0 CHECK (reserved_count >= 0),
  awarded_count       integer     NOT NULL DEFAULT 0 CHECK (awarded_count >= 0),
  redeemed_count      integer     NOT NULL DEFAULT 0 CHECK (redeemed_count >= 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_commitment CHECK (reserved_count + awarded_count <= total_stock),
  CONSTRAINT redeemed_subset  CHECK (redeemed_count <= awarded_count),
  CONSTRAINT period_valid     CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at),
  CONSTRAINT active_complete  CHECK (state <> 'active' OR (
      reward_name IS NOT NULL AND quantity_per_voucher IS NOT NULL AND rules_text IS NOT NULL
      AND starts_at IS NOT NULL AND ends_at IS NOT NULL AND total_stock > 0))
);
-- No máximo uma campanha ativa por vez.
CREATE UNIQUE INDEX campaigns_one_active ON campaigns ((true)) WHERE state = 'active';

CREATE TABLE operators (
  id            bigserial PRIMARY KEY,
  username      text NOT NULL UNIQUE,
  display_name  text NOT NULL,
  role          text NOT NULL CHECK (role IN ('manager','attendant')),
  password_hash text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE staff_sessions (
  id            bigserial PRIMARY KEY,
  operator_id   bigint NOT NULL REFERENCES operators(id),
  token_hash    text NOT NULL UNIQUE,
  csrf_token    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz
);

CREATE TABLE invitations (
  id               bigserial PRIMARY KEY,
  campaign_id      bigint NOT NULL REFERENCES campaigns(id),
  account_ref_hash text   NOT NULL,
  account_ref_hint text   NOT NULL,
  token_hash       text   NOT NULL UNIQUE,
  state            text   NOT NULL DEFAULT 'created'
                    CHECK (state IN ('created','exchanged','expired','cancelled')),
  created_by       bigint NOT NULL REFERENCES operators(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  exchanged_at     timestamptz,
  reissue_count    integer NOT NULL DEFAULT 0,
  UNIQUE (campaign_id, account_ref_hash)
);

CREATE TABLE quiz_sessions (
  id                 bigserial PRIMARY KEY,
  public_id          text   NOT NULL UNIQUE,
  campaign_id        bigint NOT NULL REFERENCES campaigns(id),
  invitation_id      bigint NOT NULL UNIQUE REFERENCES invitations(id),
  content_version    text   NOT NULL,
  question_order     jsonb  NOT NULL,   -- snapshot das 8 perguntas (texto, opções embaralhadas, correta, explicação)
  state              text   NOT NULL DEFAULT 'active'
                      CHECK (state IN ('active','completed','expired','cancelled')),
  reservation_state  text   NOT NULL DEFAULT 'reserved'
                      CHECK (reservation_state IN ('reserved','converted','released')),
  score              integer NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 800),
  started_at         timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL,
  completed_at       timestamptz,
  CONSTRAINT reservation_coherent CHECK (
    (state = 'active'    AND reservation_state = 'reserved') OR
    (state = 'completed' AND reservation_state = 'converted') OR
    (state IN ('expired','cancelled') AND reservation_state = 'released'))
);
CREATE INDEX quiz_sessions_active_exp ON quiz_sessions (expires_at) WHERE state = 'active';

CREATE TABLE player_credentials (
  id          bigserial PRIMARY KEY,
  session_id  bigint NOT NULL REFERENCES quiz_sessions(id),
  token_hash  text   NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE answers (
  id                 bigserial PRIMARY KEY,
  session_id         bigint NOT NULL REFERENCES quiz_sessions(id),
  position           integer NOT NULL CHECK (position BETWEEN 0 AND 7),
  question_id        text   NOT NULL,
  selected_option_id text   NOT NULL,
  is_correct         boolean NOT NULL,
  answered_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, question_id),
  UNIQUE (session_id, position)
);

CREATE TABLE vouchers (
  id                 bigserial PRIMARY KEY,
  session_id         bigint NOT NULL UNIQUE REFERENCES quiz_sessions(id),
  campaign_id        bigint NOT NULL REFERENCES campaigns(id),
  token_hash         text   NOT NULL UNIQUE,
  short_code_hash    text   NOT NULL UNIQUE,
  token_enc          text   NOT NULL,   -- token cifrado (AES-GCM) para reexibir ao portador da sessão
  state              text   NOT NULL DEFAULT 'issued'
                      CHECK (state IN ('issued','redeemed','expired','cancelled')),
  reward_name        text   NOT NULL,
  quantity           integer NOT NULL,
  rules_text         text   NOT NULL,
  rules_version      integer NOT NULL,
  is_test            boolean NOT NULL,
  issued_at          timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL,
  redeemed_at        timestamptz,
  redeemed_by        bigint REFERENCES operators(id),
  CONSTRAINT redeemed_has_operator CHECK (state <> 'redeemed' OR (redeemed_at IS NOT NULL AND redeemed_by IS NOT NULL))
);
CREATE INDEX vouchers_issued_exp ON vouchers (expires_at) WHERE state = 'issued';

CREATE TABLE idempotency_keys (
  scope         text NOT NULL,       -- ex.: 'player:<sessionId>:answer'
  key           text NOT NULL,
  request_hash  text NOT NULL,
  status_code   integer,
  response      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key)
);

CREATE TABLE audit_events (
  id           bigserial PRIMARY KEY,
  at           timestamptz NOT NULL DEFAULT now(),
  event        text   NOT NULL,
  operator_id  bigint REFERENCES operators(id),
  campaign_id  bigint REFERENCES campaigns(id),
  session_id   bigint REFERENCES quiz_sessions(id),
  voucher_id   bigint REFERENCES vouchers(id),
  details      jsonb  NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX audit_events_at ON audit_events (at);
