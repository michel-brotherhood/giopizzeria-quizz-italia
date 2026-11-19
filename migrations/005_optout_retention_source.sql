-- Descadastro de promoções por link pessoal, origem do cadastro e apoio à retenção (19/11/2026).
-- optout_token: aleatório (122 bits), vai só no link enviado à própria pessoa; não dá acesso a mais nada.
ALTER TABLE registrations
  ADD COLUMN optout_token text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  ADD COLUMN source text CHECK (source ~ '^[a-z0-9-]{1,24}$'),
  ADD COLUMN last_activity_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX registrations_optout_uq ON registrations (optout_token);
CREATE INDEX registrations_last_activity ON registrations (last_activity_at);
-- Cadastros existentes: última atividade = mais recente entre cadastro e partidas.
UPDATE registrations r SET last_activity_at = GREATEST(r.updated_at,
  COALESCE((SELECT max(completed_at) FROM free_plays f WHERE f.registration_id = r.id), r.updated_at),
  COALESCE((SELECT max(started_at) FROM quiz_sessions s WHERE s.registration_id = r.id), r.updated_at));
