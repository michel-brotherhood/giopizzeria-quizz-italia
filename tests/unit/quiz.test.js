import { describe, it, expect } from 'vitest';
import bank from '../../content/questions.seed.json' with { type: 'json' };
import { drawRound, seededRng, isCorrect, scoreOf, ROUND_PATTERN, publicQuestion, MAX_SCORE } from '../../shared/quiz.js';

const Q = bank.questions;

describe('sorteio', () => {
  it('1000 sementes: 8 ids e 8 famílias únicos, sequência pizza/cucina/pizza/dolci…', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const r = drawRound(Q, seededRng(seed));
      expect(r.map((q) => q.category)).toEqual(ROUND_PATTERN);
      expect(new Set(r.map((q) => q.id)).size).toBe(8);
      expect(new Set(r.map((q) => q.topicGroup)).size).toBe(8);
      const counts = r.reduce((m, q) => ({ ...m, [q.category]: (m[q.category] ?? 0) + 1 }), {});
      expect(counts).toEqual({ pizza: 4, cucina: 2, dolci: 2 });
    }
  });

  it('determinístico com a mesma semente; varia entre sementes', () => {
    expect(drawRound(Q, seededRng(42))).toEqual(drawRound(Q, seededRng(42)));
    const ids = new Set();
    for (let s = 1; s < 50; s++) ids.add(drawRound(Q, seededRng(s)).map((q) => q.id).join());
    expect(ids.size).toBeGreaterThan(40);
  });

  it('todas as perguntas do banco aparecem em algum sorteio', () => {
    const seen = new Set();
    for (let s = 1; s < 1500; s++) drawRound(Q, seededRng(s)).forEach((q) => seen.add(q.id));
    expect(seen.size).toBe(Q.length);
  });

  it('prioriza perguntas ainda não vistas sem nunca falhar', () => {
    const seen = new Set();
    const first = drawRound(Q, seededRng(1));
    first.forEach((q) => seen.add(q.id));
    const second = drawRound(Q, seededRng(2), { seen });
    const overlap = second.filter((q) => seen.has(q.id));
    expect(overlap.length).toBe(0);
    // mesmo com todo o banco visto, continua sorteando
    const all = new Set(Q.map((q) => q.id));
    expect(drawRound(Q, seededRng(3), { seen: all })).toHaveLength(8);
  });

  it('embaralha alternativas e preserva ids/textos', () => {
    let moved = 0;
    for (let s = 1; s < 100; s++) {
      for (const q of drawRound(Q, seededRng(s))) {
        const orig = Q.find((o) => o.id === q.id);
        expect(new Set(q.options.map((o) => `${o.id}:${o.text}`))).toEqual(new Set(orig.options.map((o) => `${o.id}:${o.text}`)));
        if (q.options.map((o) => o.id).join() !== orig.options.map((o) => o.id).join()) moved++;
      }
    }
    expect(moved).toBeGreaterThan(400);
  });
});

describe('correção e pontuação', () => {
  it('corrige por id independente da posição sorteada', () => {
    for (let s = 1; s < 200; s++) {
      for (const q of drawRound(Q, seededRng(s))) {
        expect(isCorrect(q, q.correctOptionId)).toBe(true);
        for (const o of q.options.filter((x) => x.id !== q.correctOptionId)) expect(isCorrect(q, o.id)).toBe(false);
      }
    }
  });

  it('alternativa inexistente lança erro', () => {
    const q = drawRound(Q, seededRng(1))[0];
    expect(() => isCorrect(q, 'zz')).toThrow('INVALID_OPTION');
  });

  it.each([[0, 0], [1, 100], [7, 700], [8, 800]])('%i acertos = %i pontos', (n, pts) => {
    const answers = Array.from({ length: 8 }, (_, i) => ({ isCorrect: i < n }));
    expect(scoreOf(answers)).toBe(pts);
    expect(scoreOf(answers.reverse())).toBe(pts);
  });

  it('máximo 800', () => expect(MAX_SCORE).toBe(800));

  it('pergunta pública não expõe correta nem explicação', () => {
    const p = publicQuestion(drawRound(Q, seededRng(9))[0]);
    expect(p).not.toHaveProperty('correctOptionId');
    expect(p).not.toHaveProperty('explanation');
  });
});
