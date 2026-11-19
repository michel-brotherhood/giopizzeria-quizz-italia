// Texturas procedurais em canvas (sem downloads). Tudo autoral.
import * as THREE from 'three';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Value noise 2D suave, periódico em `period`. */
export function makeNoise(seed, period = 64) {
  const r = rng(seed);
  const g = new Float32Array(period * period).map(() => r());
  const at = (x, y) => g[((y % period + period) % period) * period + ((x % period + period) % period)];
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = s(x - xi), yf = s(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}
export function fbm(noise, x, y, oct = 4) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += amp * noise(x * f, y * f); f *= 2; amp *= 0.5; }
  return v;
}

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { repeat = [1, 1], srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}

/** Pedra clara (travertino) com veios suaves. */
export function stoneTexture(size = 512) {
  const [c, g] = canvas(size);
  const img = g.createImageData(size, size);
  const n = makeNoise(7, 64);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * 64, v = (y / size) * 64;
      const base = fbm(n, u * 0.12, v * 0.5, 5);
      const vein = Math.abs(Math.sin(u * 0.09 + fbm(n, u * 0.05, v * 0.05, 3) * 9));
      const pores = n(u * 3.1, v * 3.1) > 0.86 ? -10 : 0;
      const k = 212 + (base - 0.5) * 22 - (vein < 0.06 ? 14 * (1 - vein / 0.06) : 0) + pores;
      const i = (y * size + x) * 4;
      img.data[i] = k + 6; img.data[i + 1] = k; img.data[i + 2] = k - 12; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return tex(c, { repeat: [2, 1] });
}

/** Tijolo aparente quente, como as paredes das fotos da Gio. */
export function brickTexture(size = 512) {
  const [c, g] = canvas(size);
  const r = rng(11);
  const n = makeNoise(13, 64);
  g.fillStyle = '#9c8a76';
  g.fillRect(0, 0, size, size);
  const bw = size / 4, bh = size / 10;
  for (let row = 0; row < 10; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let col = -1; col < 5; col++) {
      const x = col * bw + off, y = row * bh;
      const hue = 14 + r() * 14, sat = 38 + r() * 18, lig = 42 + r() * 16;
      g.fillStyle = `hsl(${hue} ${sat}% ${lig}%)`;
      g.fillRect(x + 3, y + 3, bw - 6, bh - 6);
    }
  }
  const img = g.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const d = (fbm(n, x / 18, y / 18, 4) - 0.5) * 40;
    img.data[i] += d; img.data[i + 1] += d * 0.9; img.data[i + 2] += d * 0.8;
  }
  g.putImageData(img, 0, 0);
  return tex(c, { repeat: [3, 2] });
}

/** Mosaico azul-marinho (cor da marca) para a cúpula do forno. */
export function tileTexture(size = 512) {
  const [c, g] = canvas(size);
  const r = rng(21);
  g.fillStyle = '#d9cdb4';
  g.fillRect(0, 0, size, size);
  const cells = 32, s = size / cells;
  for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
    const l = 11 + r() * 9, h = 214 + r() * 10, sa = 70 + r() * 20;
    g.fillStyle = `hsl(${h} ${sa}% ${l}%)`;
    g.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
  }
  // faixa creme e linha vermelha perto da base (identidade: creme + vermelho + marinho)
  g.fillStyle = '#efe2c6';
  g.fillRect(0, size * 0.86, size, size * 0.06);
  g.fillStyle = '#c0322a';
  g.fillRect(0, size * 0.92, size, size * 0.025);
  return tex(c, { repeat: [6, 1] });
}

/** Madeira natural (pala e tábua). */
export function woodTexture(size = 512) {
  const [c, g] = canvas(size, size);
  const img = g.createImageData(size, size);
  const n = makeNoise(31, 64);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const ring = Math.sin((u * 26 + fbm(n, u * 6, v * 1.5, 4) * 5) * Math.PI);
    const k = 0.5 + 0.5 * ring;
    const i = (y * size + x) * 4;
    img.data[i] = 168 + k * 30; img.data[i + 1] = 118 + k * 22; img.data[i + 2] = 72 + k * 14; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c);
}

/** Farinha espalhada: alpha suave e irregular. */
export function flourTexture(size = 256) {
  const [c, g] = canvas(size);
  const img = g.createImageData(size, size);
  const n = makeNoise(41, 32);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x / size - 0.5, dy = y / size - 0.5;
    const d = Math.sqrt(dx * dx + dy * dy) * 2;
    const grain = fbm(n, x / 9, y / 9, 4);
    const a = Math.max(0, Math.min(1, (1 - d * (0.85 + grain * 0.4)) * 1.6)) * (0.35 + grain * 0.65);
    const i = (y * size + x) * 4;
    img.data[i] = 250; img.data[i + 1] = 247; img.data[i + 2] = 240; img.data[i + 3] = a * 210;
  }
  g.putImageData(img, 0, 0);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/**
 * Cor da massa (mapa em coordenadas polares projetadas de cima, UV planar).
 * baked=false: massa crua clara; baked=true: cornicione dourado com manchas de "leopardo" integradas.
 */
export function doughTexture(baked, size = 512) {
  const [c, g] = canvas(size);
  const img = g.createImageData(size, size);
  const n = makeNoise(baked ? 53 : 51, 64);
  const r = rng(baked ? 57 : 55);
  const spots = [];
  if (baked) {
    // "leopardatura": manchas de tamanhos variados, concentradas no cornicione, algumas agrupadas
    for (let i = 0; i < 110; i++) {
      const ang = r() * Math.PI * 2;
      const rad = 0.8 + r() * 0.17;
      const s = 0.006 + Math.pow(r(), 2.2) * 0.03;
      spots.push({ x: 0.5 + Math.cos(ang) * rad * 0.5, y: 0.5 + Math.sin(ang) * rad * 0.5, s });
      if (r() < 0.35) spots.push({ x: 0.5 + Math.cos(ang + 0.02) * (rad - 0.015) * 0.5, y: 0.5 + Math.sin(ang + 0.02) * (rad - 0.015) * 0.5, s: s * 0.6 });
    }
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const dx = u - 0.5, dy = v - 0.5;
    const d = Math.sqrt(dx * dx + dy * dy) * 2; // 0 centro .. 1 borda
    const grain = fbm(n, u * 40, v * 40, 3);
    let R, G, B;
    if (!baked) {
      R = 234 + grain * 10; G = 203 + grain * 12; B = 152 + grain * 10;
    } else {
      // centro mais claro; cornicione dourado/âmbar
      const rim = Math.max(0, Math.min(1, (d - 0.78) / 0.14));
      const toast = rim * (0.75 + grain * 0.5);
      R = 236 - toast * 38; G = 204 - toast * 78; B = 146 - toast * 88;
      let char = 0;
      for (const s of spots) {
        const sd = ((u - s.x) ** 2 + (v - s.y) ** 2) / s.s ** 2;
        if (sd < 6) char = Math.max(char, Math.exp(-sd * 0.8) * (0.5 + grain * 0.5));
      }
      R -= char * 120; G -= char * 105; B -= char * 70;
    }
    const i = (y * size + x) * 4;
    img.data[i] = R; img.data[i + 1] = G; img.data[i + 2] = B; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Molho de tomate com variação (pedaços, brilho) — alpha define a borda irregular. */
export function sauceTexture(size = 512) {
  const [c, g] = canvas(size);
  const img = g.createImageData(size, size);
  const n = makeNoise(61, 64);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const dx = u - 0.5, dy = v - 0.5;
    const d = Math.sqrt(dx * dx + dy * dy) * 2;
    const ang = Math.atan2(dy, dx);
    const edge = 0.9 + (fbm(n, Math.cos(ang) * 3 + 10, Math.sin(ang) * 3 + 10, 4) - 0.5) * 0.16;
    const a = Math.max(0, Math.min(1, (edge - d) * 30));
    const chunk = fbm(n, u * 30, v * 30, 3);
    const i = (y * size + x) * 4;
    img.data[i] = 168 + chunk * 40; img.data[i + 1] = 34 + chunk * 22; img.data[i + 2] = 20 + chunk * 10; img.data[i + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
