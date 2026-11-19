import { describe, it, expect } from 'vitest';
import bank from '../../content/questions.seed.json' with { type: 'json' };
import { validateBank } from '../../shared/quiz.js';
import { SOURCES } from '../../shared/sources.js';

describe('banco de perguntas', () => {
  it('estrutura válida: 44 entradas 24/12/8, 4 opções únicas, correta existente e fontes resolvidas', () => {
    expect(validateBank(bank, new Set(Object.keys(SOURCES)))).toEqual([]);
    expect(bank.questions).toHaveLength(44);
    const n = (c) => bank.questions.filter((q) => q.category === c).length;
    expect([n('pizza'), n('cucina'), n('dolci')]).toEqual([24, 12, 8]);
  });

  it('fontes são URLs https', () => {
    for (const url of Object.values(SOURCES)) expect(url).toMatch(/^https:\/\//);
  });

  it('nenhuma resposta correta fica sempre na mesma posição do arquivo', () => {
    const positions = new Set(bank.questions.map((q) => q.options.findIndex((o) => o.id === q.correctOptionId)));
    expect(positions.size).toBeGreaterThan(1);
  });

  it('pergunta mais longa conhecida (para teste visual)', () => {
    const longest = bank.questions.reduce((a, b) => (b.question.length > a.question.length ? b : a));
    expect(longest.question.length).toBeGreaterThan(60);
  });
});
