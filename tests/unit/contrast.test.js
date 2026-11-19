// Contraste WCAG 2.x das combinações de cor efetivamente usadas na interface.
import { describe, it, expect } from 'vitest';

function lum(hex) {
  const [r, g, b] = hex.match(/\w\w/g).map((h) => parseInt(h, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

// [texto, fundo, uso, mínimo] — paleta da direção visual (tokens/gio.css). Bordas e marcadores: 3:1.
const PAIRS = [
  ['f3e8cf', '0b0e1d', 'texto creme no fundo navy', 4.5],
  ['f3e8cf', '121624', 'texto creme no painel', 4.5],
  ['c7bead', '121624', 'texto secundário no painel', 4.5],
  ['c7bead', '0b0e1d', 'texto secundário no fundo', 4.5],
  ['f3e8cf', 'c4281b', 'botão primário (creme sobre vermelho de ação)', 4.5],
  ['f3e8cf', 'a82216', 'botão primário em hover', 4.5],
  ['c7bead', '3a2f33', 'botão desabilitado', 4.5],
  ['88c89b', '121624', 'marca "Correta" após confirmar', 4.5],
  ['f07a6e', '121624', 'marca "Sua resposta" (erro)', 4.5],
  ['0b0e1d', '88c89b', 'letra/ícone sobre verde', 4.5],
  ['0b0e1d', 'f07a6e', 'letra/ícone sobre vermelho claro', 4.5],
  ['0b0e1d', 'f3e8cf', 'selos e voucher (navy sobre creme)', 4.5],
  ['ffe09a', '121624', 'anel de foco', 3],
  ['d92e20', '121624', 'borda da seleção e marcadores (não texto)', 3],
  ['756f66', '121624', 'borda das alternativas (não texto)', 3],
  ['ffffff', 'c4281b', 'faixa TESTE', 4.5],
];

describe('contraste AA', () => {
  for (const [fg, bg, uso, min] of PAIRS) {
    it(`${uso}: #${fg} sobre #${bg} >= ${min}`, () => {
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(min);
    });
  }
  it('creme sobre o #D92E20 da direção reprovaria em texto normal (por isso o botão usa #C4281B)', () => {
    expect(ratio('f3e8cf', 'd92e20')).toBeLessThan(4.5);
  });
});
