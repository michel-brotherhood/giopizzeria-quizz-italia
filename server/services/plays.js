// Partidas sem brinde: o aparelho envia só as alternativas escolhidas; o servidor recorrige pelo banco
// de perguntas e guarda o resultado no cadastro. Não gera brinde nem altera campanha.
import { err } from '../errors.js';
import { QUESTIONS, CONTENT_VERSION } from './content.js';
import { ROUND_PATTERN, ROUND_SIZE } from '../../shared/quiz.js';

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));
const DAILY_LIMIT = 40; // por cadastro; evita inflar as estatísticas com envios repetidos

export function gradeFreePlay(body = {}) {
  const { playId, answers } = body;
  if (typeof playId !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(playId)) throw err('PLAY_INVALID');
  if (!Array.isArray(answers) || answers.length !== ROUND_SIZE) throw err('PLAY_INVALID');
  const seen = new Set();
  const graded = answers.map((a, i) => {
    const q = BY_ID.get(a?.questionId);
    if (!q || seen.has(q.id) || q.category !== ROUND_PATTERN[i]) throw err('PLAY_INVALID');
    if (!q.options.some((o) => o.id === a.selectedOptionId)) throw err('PLAY_INVALID');
    seen.add(q.id);
    return { questionId: q.id, selectedOptionId: a.selectedOptionId, correct: q.correctOptionId === a.selectedOptionId };
  });
  return { playId, graded, correct: graded.filter((g) => g.correct).length };
}

/** Grava (idempotente por playId) e devolve o número de acertos conferido pelo servidor. */
export async function recordFreePlay(pool, registrationId, body) {
  const { playId, graded, correct } = gradeFreePlay(body);
  const { rows: [dup] } = await pool.query(
    'SELECT correct FROM free_plays WHERE registration_id=$1 AND client_play_id=$2', [registrationId, playId]);
  if (dup) return { saved: true, correct: dup.correct, duplicate: true };
  const { rows: [{ n }] } = await pool.query(
    `SELECT count(*)::int n FROM free_plays WHERE registration_id=$1 AND completed_at > now() - interval '1 day'`, [registrationId]);
  if (n >= DAILY_LIMIT) throw err('PLAY_LIMIT');
  await pool.query('UPDATE registrations SET last_activity_at = now() WHERE id=$1', [registrationId]);
  await pool.query(
    `INSERT INTO free_plays (registration_id, client_play_id, content_version, answers, correct)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (registration_id, client_play_id) DO NOTHING`,
    [registrationId, playId, CONTENT_VERSION, JSON.stringify(graded), correct]);
  return { saved: true, correct };
}

// Todas as partidas concluídas (sem brinde + com brinde) em uma visão só, para o painel.
export const ALL_PLAYS_SQL = `
  SELECT registration_id, correct, completed_at, 'livre'::text AS kind FROM free_plays
  UNION ALL
  SELECT s.registration_id, (s.score / 100)::int AS correct, s.completed_at, 'campanha'::text
  FROM quiz_sessions s WHERE s.state = 'completed' AND s.registration_id IS NOT NULL`;

/** Taxa de acerto por pergunta (partidas livres + com brinde), mais erradas primeiro. */
export async function questionStats(pool, minAnswers = 3) {
  const { rows } = await pool.query(
    `SELECT question_id, count(*)::int answered, count(*) FILTER (WHERE correct)::int right_count FROM (
       SELECT a->>'questionId' AS question_id, (a->>'correct')::boolean AS correct
       FROM free_plays fp, jsonb_array_elements(fp.answers) a
       UNION ALL
       SELECT question_id, is_correct FROM answers) x
     GROUP BY question_id HAVING count(*) >= $1
     ORDER BY (count(*) FILTER (WHERE correct))::float / count(*), count(*) DESC, question_id LIMIT 10`, [minAnswers]);
  return rows.map((r) => ({
    questionId: r.question_id, question: BY_ID.get(r.question_id)?.question ?? r.question_id,
    category: BY_ID.get(r.question_id)?.category ?? null, answered: r.answered, rate: r.right_count / r.answered,
  }));
}
