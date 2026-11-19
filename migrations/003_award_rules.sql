-- Regras de premiação por campanha (19/11/2026): participação (como antes), pontuação mínima, ou
-- "a cada N partidas qualificadas". A reserva de estoque continua no início da partida; quem não ganha
-- devolve a reserva na conclusão (reservation_state = 'released').
ALTER TABLE campaigns
  ADD COLUMN award_rule      text    NOT NULL DEFAULT 'participation'
                              CHECK (award_rule IN ('participation','min_score','every_n')),
  ADD COLUMN min_correct     integer NOT NULL DEFAULT 7 CHECK (min_correct BETWEEN 1 AND 8),
  ADD COLUMN every_n         integer NOT NULL DEFAULT 15 CHECK (every_n BETWEEN 1 AND 10000),
  ADD COLUMN qualified_count integer NOT NULL DEFAULT 0 CHECK (qualified_count >= 0);

ALTER TABLE quiz_sessions
  ADD COLUMN award_outcome text CHECK (award_outcome IN ('awarded','not_qualified','qualified_no_prize'));
UPDATE quiz_sessions SET award_outcome = 'awarded' WHERE state = 'completed';

ALTER TABLE quiz_sessions DROP CONSTRAINT reservation_coherent;
ALTER TABLE quiz_sessions ADD CONSTRAINT reservation_coherent CHECK (
  (state = 'active'    AND reservation_state = 'reserved'  AND award_outcome IS NULL) OR
  (state = 'completed' AND reservation_state = 'converted' AND award_outcome = 'awarded') OR
  (state = 'completed' AND reservation_state = 'released'  AND award_outcome IN ('not_qualified','qualified_no_prize')) OR
  (state IN ('expired','cancelled') AND reservation_state = 'released' AND award_outcome IS NULL));
