-- Partidas sem brinde ligadas ao cadastro (pedido do usuário em 19/11/2026: guardar os dados no painel).
-- O servidor recorrige as respostas pelo banco de perguntas; nada aqui dá direito a brinde.
CREATE TABLE free_plays (
  id               bigserial PRIMARY KEY,
  registration_id  bigint NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  client_play_id   text   NOT NULL CHECK (client_play_id ~ '^[A-Za-z0-9_-]{16,64}$'),
  content_version  text   NOT NULL,
  answers          jsonb  NOT NULL,          -- [{ questionId, selectedOptionId, correct }]
  correct          integer NOT NULL CHECK (correct BETWEEN 0 AND 8),
  completed_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registration_id, client_play_id)
);
CREATE INDEX free_plays_registration ON free_plays (registration_id);
CREATE INDEX free_plays_completed ON free_plays (completed_at);
CREATE INDEX quiz_sessions_registration ON quiz_sessions (registration_id) WHERE registration_id IS NOT NULL;
