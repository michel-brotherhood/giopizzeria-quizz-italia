// Modo leve / fallback sem WebGL: mesma composição (bancada, forno marinho, pala, pizza) em SVG.
// A progressão acompanha as mesmas etapas 0..9 da cena 3D.

const SVG = `
<svg class="light-svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
  <defs>
    <pattern id="ls-brick" width="40" height="16" patternUnits="userSpaceOnUse">
      <rect width="40" height="16" fill="#7a4a35"/>
      <rect x="1" y="1" width="38" height="6" rx="1" fill="#a2593a"/>
      <rect x="-19" y="9" width="38" height="6" rx="1" fill="#96523a"/>
      <rect x="21" y="9" width="38" height="6" rx="1" fill="#ab6343"/>
    </pattern>
    <radialGradient id="ls-glow" cx="50%" cy="70%" r="60%">
      <stop offset="0" stop-color="#ffd28a"/><stop offset=".45" stop-color="#ff8a3a"/><stop offset="1" stop-color="#4a160a"/>
    </radialGradient>
    <radialGradient id="ls-warm" cx="30%" cy="45%" r="70%">
      <stop offset="0" stop-color="#ff9a4a" stop-opacity=".35"/><stop offset="1" stop-color="#ff9a4a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ls-stone" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#efe6d6"/><stop offset="1" stop-color="#ddd1bd"/>
    </linearGradient>
    <linearGradient id="ls-wood" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#b98450"/><stop offset=".5" stop-color="#c9955e"/><stop offset="1" stop-color="#ad7745"/>
    </linearGradient>
  </defs>
  <rect width="400" height="300" fill="url(#ls-brick)"/>
  <rect width="400" height="300" fill="#2a1a13" opacity=".45"/>
  <g class="ls-oven">
    <rect x="22" y="128" width="196" height="60" fill="#e9dcc1"/>
    <rect x="22" y="126" width="196" height="4" fill="#c0322a"/>
    <path d="M30 128 C30 40 210 40 210 128 Z" fill="#0d2550"/>
    <path d="M30 128 C30 40 210 40 210 128 Z" fill="none" stroke="#1d3a6e" stroke-width="2" stroke-dasharray="3 5" opacity=".7"/>
    <rect x="30" y="118" width="180" height="6" fill="#efe2c6"/>
    <rect x="108" y="22" width="22" height="56" fill="#e9dcc1"/>
    <path d="M78 128 L78 96 Q78 70 120 70 Q162 70 162 96 L162 128 Z" fill="#e9dcc1"/>
    <path class="ls-mouth" d="M96 128 L96 104 Q96 86 120 86 Q144 86 144 104 L144 128 Z" fill="url(#ls-glow)"/>
  </g>
  <rect class="ls-heat" x="0" y="0" width="400" height="300" fill="url(#ls-warm)"/>
  <path d="M0 176 L400 160 L400 300 L0 300 Z" fill="url(#ls-stone)"/>
  <path d="M0 176 L400 160 L400 164 L0 180 Z" fill="#fff" opacity=".35"/>
  <ellipse cx="236" cy="226" rx="96" ry="38" fill="#fbf8f1" opacity=".55"/>
  <g class="ls-props">
    <ellipse cx="74" cy="236" rx="30" ry="10" fill="#8f3f22"/><path d="M44 230 Q48 252 74 254 Q100 252 104 230 Z" fill="#b4572f"/><ellipse cx="74" cy="231" rx="27" ry="8" fill="#a3251a"/>
    <ellipse cx="335" cy="196" rx="26" ry="9" fill="#e9e0cc"/><path d="M309 192 Q312 212 335 214 Q358 212 361 192 Z" fill="#f1e9d8"/><path d="M309 192 Q335 202 361 192" stroke="#041e42" stroke-width="1.5" fill="none"/>
    <circle cx="328" cy="190" r="7" fill="#fbf8f1"/><circle cx="341" cy="189" r="6.5" fill="#fbf8f1"/>
    <ellipse cx="150" cy="196" rx="9" ry="6" fill="#c4301c"/><ellipse cx="164" cy="200" rx="9" ry="6" fill="#b52b19"/>
    <path d="M30 210 L30 150 Q30 140 36 136 L36 122 L42 122 L42 136 Q48 140 48 150 L48 210 Z" fill="#2e4a1f"/><rect x="30" y="170" width="18" height="16" fill="#eedebd"/>
  </g>
  <g class="ls-peel">
    <path d="M0 0 h-12 q-10 0 -12 -10 l-6 -22 q-3 -12 9 -12 h62 q12 0 9 12 l-6 22 q-2 10 -12 10 h-12 l-4 6 h-12 z" fill="url(#ls-wood)" transform="translate(0 0)"/>
    <rect x="-4" y="5" width="8" height="70" rx="4" fill="#b98450"/>
  </g>
  <g class="ls-pizza">
    <ellipse class="ls-ball" cx="0" cy="-8" rx="26" ry="17" fill="#ecd6ac"/>
    <g class="ls-disc">
      <ellipse cx="0" cy="0" rx="70" ry="28" fill="#ecd6ac"/>
      <ellipse class="ls-rim" cx="0" cy="-2" rx="66" ry="25" fill="none" stroke="#e2c591" stroke-width="9"/>
      <g class="ls-char" fill="#5a2f17" opacity=".75">
        <ellipse cx="-58" cy="-10" rx="4" ry="2"/><ellipse cx="44" cy="-20" rx="5" ry="2"/><ellipse cx="62" cy="6" rx="3" ry="2"/>
        <ellipse cx="-30" cy="22" rx="5" ry="2"/><ellipse cx="18" cy="24" rx="3" ry="1.6"/><ellipse cx="-66" cy="6" rx="3" ry="1.6"/>
      </g>
    </g>
    <path class="ls-sauce" d="M-54 0 C-56 -14 -30 -22 0 -21 C30 -22 58 -14 55 1 C56 14 28 21 0 20 C-30 22 -56 13 -54 0 Z" fill="#b3281b"/>
    <g class="ls-mozz" fill="#f6f0e2">
      <ellipse cx="-28" cy="-6" rx="9" ry="5"/><ellipse cx="6" cy="-12" rx="10" ry="5"/><ellipse cx="30" cy="2" rx="9" ry="5"/>
      <ellipse cx="-10" cy="10" rx="10" ry="5"/><ellipse cx="22" cy="13" rx="7" ry="4"/><ellipse cx="-38" cy="9" rx="7" ry="4"/>
    </g>
    <g class="ls-basil" fill="#2f6e2c">
      <path d="M-18 -2 q8 -8 16 0 q-8 6 -16 0z"/><path d="M14 -4 q8 -8 16 0 q-8 6 -16 0z"/><path d="M0 8 q8 -8 16 0 q-8 6 -16 0z"/><path d="M-36 0 q6 -7 13 0 q-6 5 -13 0z"/>
    </g>
    <g class="ls-oil" fill="#d9b23a" opacity=".55">
      <ellipse cx="-20" cy="4" rx="6" ry="1.6"/><ellipse cx="18" cy="-6" rx="7" ry="1.6"/><ellipse cx="34" cy="10" rx="5" ry="1.4"/>
    </g>
  </g>
</svg>`;

export function createLightScene(container) {
  const wrap = document.createElement('div');
  wrap.className = 'light-scene';
  wrap.innerHTML = SVG;
  container.appendChild(wrap);
  function setStage(n) {
    n = Math.max(0, Math.min(9, n | 0));
    for (let i = 1; i <= 9; i++) wrap.classList.toggle(`s${i}`, n >= i);
    wrap.dataset.stage = String(n);
  }
  setStage(0);
  return { setStage, celebrate() {}, dispose() { wrap.remove(); }, info: { light: true } };
}
