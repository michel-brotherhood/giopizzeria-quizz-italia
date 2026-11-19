-- Cadastro de participantes (instrução do usuário em 19/11/2026: cadastro obrigatório antes de jogar,
-- com política de privacidade e aceite opcional de promoções). Dados mínimos: nome, WhatsApp e e-mail.
CREATE TABLE registrations (
  id                    bigserial PRIMARY KEY,
  name                  text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  email                 text NOT NULL CHECK (char_length(email) BETWEEN 5 AND 120),
  phone                 text NOT NULL CHECK (phone ~ '^55[1-9][0-9][0-9]{8,9}$'),
  marketing_consent     boolean NOT NULL DEFAULT false,
  marketing_consent_at  timestamptz,              -- quando aceitou (null se não aceitou ou revogou)
  privacy_version       text NOT NULL,
  privacy_accepted_at   timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consent_coherent CHECK (marketing_consent = (marketing_consent_at IS NOT NULL))
);
CREATE UNIQUE INDEX registrations_email_uq ON registrations (lower(email));

-- Credencial do aparelho (cookie httpOnly); o banco guarda só o hash.
CREATE TABLE registration_credentials (
  token_hash       text PRIMARY KEY,
  registration_id  bigint NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Partida com brinde ligada ao cadastro (apagar o cadastro não apaga a partida nem o voucher).
ALTER TABLE quiz_sessions ADD COLUMN registration_id bigint REFERENCES registrations(id) ON DELETE SET NULL;
