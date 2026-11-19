// Contraste WCAG 2.x das combinações de cor efetivamente usadas na interface.
import { describe, it, expect } from 'vitest';

function lum(hex) {
  const [r, g, b] = hex.match(/\w\w/g).map((h) => parseInt(h, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

// [texto, fundo, uso, mínimo]
const PAIRS = [
  ['041e42', 'f7efdf', 'texto azul no papel', 4.5],
  ['041e42', 'fffaf0', 'alternativas', 4.5],
  ['fffaf0', 'c0322a', 'botão primário (texto creme no vermelho profundo)', 4.5],
  ['c0322a', 'f7efdf', 'eyebrow/categoria vermelho no papel', 4.5],
  ['2b6528', 'eef5ea', 'marca "Correta"', 4.5],
  ['c0322a', 'fbecea', 'marca "Sua resposta"', 4.5],
  ['f4e9d5', '041e42', 'letra das alternativas / cabeçalho do voucher', 4.5],
  ['f4e9d5', '2a1a13', 'barra superior', 4.5],
  ['ffffff', 'c0322a', 'faixa TESTE', 4.5],
  ['5b6b80', 'f7efdf', 'texto secundário (azul 72% ≈ #4a5a70 sobre papel)', 4.5],
];

describe('contraste AA', () => {
  for (const [fg, bg, uso, min] of PAIRS) {
    it(`${uso}: #${fg} sobre #${bg} >= ${min}`, () => {
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(min);
    });
  }
  it('o vermelho 179C original (#E03C31) NÃO é usado para texto pequeno sobre creme (reprovaria)', () => {
    expect(ratio('e03c31', 'f4e9d5')).toBeLessThan(4.5);
  });
});
