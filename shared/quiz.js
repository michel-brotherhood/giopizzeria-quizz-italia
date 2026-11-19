// Motor de perguntas compartilhado (servidor e modo demonstração).
// Puro: sem DOM, sem rede. RNG injetável para testes determinísticos.

export const ROUND_PATTERN = ['pizza', 'cucina', 'pizza', 'dolci', 'pizza', 'cucina', 'pizza', 'dolci'];
export const ROUND_SIZE = ROUND_PATTERN.length;
export const POINTS_PER_CORRECT = 100;
export const MAX_SCORE = ROUND_SIZE * POINTS_PER_CORRECT;

export const CATEGORY_LABELS = { pizza: 'Pizza', cucina: 'Cucina', dolci: 'Dolci & caffè' };

/** PRNG determinístico (mulberry32) para testes e demo reprodutível. */
export function seededRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(list, rng) {
  return list[Math.floor(rng() * list.length) % list.length];
}

export function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Sorteia uma partida de 8 perguntas seguindo ROUND_PATTERN, sem repetir id ou topicGroup.
 * @param {Array} questions banco completo
 * @param {() => number} rng
 * @param {{ seen?: Set<string> }} [opts] ids já vistos (prioridade menor, nunca exclusão)
 * @returns {Array} perguntas com opções embaralhadas (cópias)
 */
export function drawRound(questions, rng, opts = {}) {
  const seen = opts.seen ?? new Set();
  const usedIds = new Set();
  const usedGroups = new Set();
  const round = [];
  for (const category of ROUND_PATTERN) {
    const eligible = questions.filter(
      (q) => q.category === category && !usedIds.has(q.id) && !usedGroups.has(q.topicGroup),
    );
    if (eligible.length === 0) throw new Error(`Banco insuficiente para a categoria ${category}`);
    const fresh = eligible.filter((q) => !seen.has(q.id));
    const chosen = pick(fresh.length ? fresh : eligible, rng);
    usedIds.add(chosen.id);
    usedGroups.add(chosen.topicGroup);
    round.push({
      id: chosen.id,
      category: chosen.category,
      topicGroup: chosen.topicGroup,
      question: chosen.question,
      options: shuffle(chosen.options, rng).map((o) => ({ id: o.id, text: o.text })),
      correctOptionId: chosen.correctOptionId,
      explanation: chosen.explanation,
      sourceId: chosen.sourceId,
    });
  }
  return round;
}

/** Corrige por ID de alternativa, nunca por índice. */
export function isCorrect(question, selectedOptionId) {
  if (!question.options.some((o) => o.id === selectedOptionId)) {
    throw new Error('INVALID_OPTION');
  }
  return question.correctOptionId === selectedOptionId;
}

export function scoreOf(answers) {
  return answers.reduce((s, a) => s + (a.isCorrect ? POINTS_PER_CORRECT : 0), 0);
}

/** Versão pública da pergunta: sem resposta correta nem explicação. */
export function publicQuestion(q) {
  return { id: q.id, category: q.category, question: q.question, options: q.options.map((o) => ({ id: o.id, text: o.text })) };
}

/** Validação estrutural do banco. Retorna lista de erros (vazia = ok). */
export function validateBank(bank, sourceIds) {
  const errors = [];
  const ids = new Set();
  const counts = { pizza: 0, cucina: 0, dolci: 0 };
  for (const q of bank.questions ?? []) {
    if (ids.has(q.id)) errors.push(`id duplicado: ${q.id}`);
    ids.add(q.id);
    if (!(q.category in counts)) errors.push(`${q.id}: categoria inválida ${q.category}`);
    else counts[q.category]++;
    if (!q.topicGroup) errors.push(`${q.id}: sem topicGroup`);
    if (!q.question?.trim()) errors.push(`${q.id}: sem enunciado`);
    if (!Array.isArray(q.options) || q.options.length !== 4) errors.push(`${q.id}: precisa de 4 alternativas`);
    const optIds = new Set((q.options ?? []).map((o) => o.id));
    const optTexts = new Set((q.options ?? []).map((o) => o.text.trim().toLowerCase()));
    if (optIds.size !== 4) errors.push(`${q.id}: ids de alternativa repetidos`);
    if (optTexts.size !== 4) errors.push(`${q.id}: textos de alternativa repetidos`);
    if (!optIds.has(q.correctOptionId)) errors.push(`${q.id}: correctOptionId inexistente`);
    if (!q.explanation?.trim()) errors.push(`${q.id}: sem explicação`);
    if (sourceIds && !sourceIds.has(q.sourceId)) errors.push(`${q.id}: fonte não resolvida ${q.sourceId}`);
  }
  if (counts.pizza !== 16 || counts.cucina !== 8 || counts.dolci !== 8) {
    errors.push(`distribuição esperada 16/8/8, obtida ${counts.pizza}/${counts.cucina}/${counts.dolci}`);
  }
  return errors;
}
