// Cena 3D principal. Recebe eventos (setStage, celebrate) — não decide estado do jogo nem do brinde.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createKitchen, OVEN, BOARD_TOP } from './kitchen.js';
import { createPizza } from './pizza.js';

const P0 = { x: 0, y: BOARD_TOP, z: 0.4 }; // pizza apoiada na tábua
const ON_PEEL = BOARD_TOP + 0.055;
const BLADE_OFFSET = -0.55; // centro da lâmina no eixo local z da pala
const INSIDE_Z = OVEN.z + 0.9;             // centro da pizza dentro do forno
const MOUTH_Z = OVEN.z + OVEN.r + 1.7;       // diante da boca, do lado de fora
const PEEL_REST = { peelX: 7.2, peelY: 0, peelZ: 0.6, peelRot: Math.PI / 2 }; // fora do quadro, à direita

// Câmeras por etapa, sempre em três quartos elevados e sem giro: abertura mostra a tábua com o forno
// aceso ao fundo à direita; preparo aproxima da pizza; a etapa do forno enquadra a boca.
const CAMS = {
  0: { cx: -1.3, cy: 4.3, cz: 5.6, tx: 0.7, ty: 0.25, tz: -1.2 },
  1: { cx: -1.0, cy: 4.9, cz: 5.2, tx: 0.2, ty: 0.1, tz: -0.2 },
  5: { cx: -1.0, cy: 4.8, cz: 5.8, tx: 0.6, ty: 0.2, tz: -0.6 },
  6: { cx: 1.4, cy: 2.0, cz: 1.6, tx: 3.9, ty: 0.55, tz: -6.6 },
  7: { cx: -1.0, cy: 4.7, cz: 5.2, tx: 0.2, ty: 0.15, tz: -0.1 },
  8: { cx: -1.0, cy: 4.6, cz: 5.0, tx: 0.2, ty: 0.1, tz: 0.1 },
};
const camFor = (s) => CAMS[s] ?? CAMS[s >= 1 && s <= 4 ? 1 : 0];

// Etapas 0..8: 0 massa, 1 aberta, 2 molho, 3 mozzarella, 4 manjericão + azeite, 5 pala, 6 forno,
// 7 saiu do forno, 8 pronta. Cada pergunta concluída avança uma etapa.
const ING_AT = { disc: 1, sauce: 2, mozz: 3, basil: 4, oil: 4 };

/** Estado final (sem animação) de cada etapa 0..8. */
function finalState(stage) {
  const s = {
    ball: 1, disc: 0, sauce: 0, mozz: 0, basil: 0, oil: 0, baked: 0,
    px: P0.x, py: P0.y, pz: P0.z, ...PEEL_REST, heat: 0.35, carry: 0, highlight: 0,
    ...camFor(stage),
  };
  for (const [k, at] of Object.entries(ING_AT)) if (stage >= at) s[k] = 1;
  if (stage >= 1) s.ball = 0;
  if (stage === 5) Object.assign(s, { py: ON_PEEL, peelX: P0.x - BLADE_OFFSET, peelY: BOARD_TOP, peelZ: P0.z, carry: 1 });
  if (stage === 6) {
    Object.assign(s, { px: OVEN.x, py: OVEN.y + 0.06 + 0.055, pz: INSIDE_Z, peelX: OVEN.x, peelY: OVEN.y + 0.06, peelZ: INSIDE_Z - BLADE_OFFSET + 6.4, peelRot: 0, heat: 1 });
  }
  if (stage === 7) {
    const rot = -0.6;
    Object.assign(s, {
      baked: 1, px: P0.x, py: ON_PEEL, pz: P0.z, peelRot: rot,
      peelX: P0.x - Math.sin(rot) * BLADE_OFFSET, peelY: BOARD_TOP, peelZ: P0.z - Math.cos(rot) * BLADE_OFFSET, carry: 1, heat: 0.5,
    });
  }
  if (stage >= 8) Object.assign(s, { baked: 1, heat: 0.45 }); // pronta: de volta à tábua, pala descansando
  return s;
}

/** Sequência animada para chegar à etapa `stage` partindo de `stage-1`. */
function segmentsFor(stage) {
  const f = finalState(stage);
  const cam = camFor(stage);
  if (stage === 5) {
    return [
      { dur: 350, to: { ...cam, py: ON_PEEL } },
      { dur: 550, to: { peelX: f.peelX, peelY: f.peelY, peelZ: f.peelZ, peelRot: f.peelRot } },
      { dur: 1, to: {}, carry: 1 },
    ];
  }
  if (stage === 6) {
    return [
      { dur: 700, carry: 1, to: { peelRot: 0, peelX: OVEN.x, peelY: OVEN.y + 0.06, peelZ: MOUTH_Z - BLADE_OFFSET, ...cam } },
      { dur: 550, to: { peelZ: INSIDE_Z - BLADE_OFFSET, heat: 0.8 } },
      { dur: 1, carry: 0, to: {} },
      { dur: 450, to: { peelZ: f.peelZ, heat: 1 } },
    ];
  }
  if (stage === 7) {
    return [
      { dur: 300, to: { baked: 1 } },
      { dur: 450, to: { peelZ: INSIDE_Z - BLADE_OFFSET } },
      { dur: 1, carry: 1, to: {} },
      { dur: 550, to: { peelZ: MOUTH_Z - BLADE_OFFSET, heat: 0.7 } },
      { dur: 700, to: { peelX: f.peelX, peelY: f.peelY, peelZ: f.peelZ, peelRot: f.peelRot, heat: f.heat, ...cam } },
    ];
  }
  const to = {};
  for (const k of Object.keys(f)) if (k !== 'carry') to[k] = f[k];
  return [{ dur: 650, to, carry: f.carry }];
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export async function createScene(container, { reducedMotion = false, quality = 'high', onFail } = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'scene-canvas';
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
  } catch (e) {
    throw new Error(`WebGL indisponível: ${e.message}`);
  }
  if (!renderer.getContext()) throw new Error('WebGL indisponível');
  // WebGL por software (SwiftShader/llvmpipe): menos pixels e menos quadros quando nada se move.
  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpuName = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
  const software = /swiftshader|llvmpipe|software/i.test(gpuName);
  if (software) quality = 'low';
  const idleMs = software ? 250 : 40; // fogo a ~25 fps em GPU real
  container.appendChild(canvas);

  const maxDpr = quality === 'high' ? 1.5 : 1;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !software;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const BG = 0x0b0e1d;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 16, 36);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 90);

  // Luz principal suave acima à esquerda (sombras de contato sob pizza, tábua e tigelas),
  // luz quente do forno ao fundo à direita e um preenchimento âmbar baixo.
  scene.add(new THREE.HemisphereLight(0xffe9cc, 0x2a1a10, 0.5));
  const key = new THREE.SpotLight(0xfff0dc, 150, 26, 0.7, 0.9, 1.5);
  key.position.set(-4.5, 9, 4);
  key.target.position.set(0.2, 0, -0.2);
  key.castShadow = true;
  key.shadow.mapSize.set(quality === 'high' ? 1024 : 512, quality === 'high' ? 1024 : 512);
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 6;
  key.shadow.camera.near = 3; key.shadow.camera.far = 20;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xffb070, 0.45);
  fill.position.set(6, 3, 6);
  scene.add(fill);
  const ovenLight = new THREE.PointLight(0xff7a2e, 30, 20, 1.6);
  ovenLight.position.set(OVEN.x, OVEN.y + 1.0, OVEN.z + OVEN.r + 0.6);
  scene.add(ovenLight);
  const innerLight = new THREE.PointLight(0xff8a3a, 16, 7, 1.6);
  innerLight.position.set(OVEN.x + 0.6, OVEN.y + 2.0, OVEN.z + 0.2);
  scene.add(innerLight);

  const kitchen = createKitchen({ quality });
  scene.add(kitchen.root);
  const pizza = createPizza();
  scene.add(pizza.group);

  let state = finalState(0);
  let stage = 0;
  let queue = [];
  let seg = null;
  let orbit = 0;
  let highlightUntil = 0;
  let disposed = false;
  let lastRender = 0;
  let flick = 1;
  const lookAt = new THREE.Vector3();

  function applyState() {
    pizza.apply(state);
    kitchen.peel.position.set(state.peelX, state.peelY, state.peelZ);
    kitchen.peel.rotation.y = state.peelRot;
    if (state.carry) {
      const r = state.peelRot;
      state.px = state.peelX + Math.sin(r) * BLADE_OFFSET;
      state.pz = state.peelZ + Math.cos(r) * BLADE_OFFSET;
      state.py = state.peelY + 0.055;
    }
    pizza.group.position.set(state.px, state.py, state.pz);
    if (reducedMotion) { kitchen.fire.update(1.3, state.heat); pizza.tick(1.3); }
    const h = state.heat;
    ovenLight.intensity = (16 + h * 30) * flick;
    innerLight.intensity = (10 + h * 18) * flick;
    kitchen.halo.opacity = (0.16 + h * 0.22) * flick;
    kitchen.arch.emissiveIntensity = 0.08 + h * 0.18;
    let cx = state.cx, cz = state.cz;
    if (orbit) {
      const a = orbit * 0.00012;
      const dx = cx - state.tx, dz = cz - state.tz;
      cx = state.tx + dx * Math.cos(a) - dz * Math.sin(a);
      cz = state.tz + dx * Math.sin(a) + dz * Math.cos(a);
    }
    camera.position.set(cx, state.cy, cz);
    lookAt.set(state.tx, state.ty, state.tz);
    camera.lookAt(lookAt);
  }

  // Janela de foco: a parte do canvas que não fica sob o painel de texto. A câmera desloca o
  // centro óptico para essa janela (setViewOffset) e ajusta o campo de visão ao tamanho dela.
  let focus = null;
  function applyFocus(w, h) {
    const f = focus && focus.w > 40 && focus.h > 40 ? focus : { x: 0, y: 0, w, h };
    const aVis = f.w / f.h;
    const baseHalf = Math.tan(THREE.MathUtils.degToRad(19));
    let tanVis = aVis < 1 ? baseHalf / Math.pow(aVis, 0.8) : aVis > 1.9 ? baseHalf * 0.9 : baseHalf;
    const tanFull = tanVis * (h / f.h);
    camera.fov = Math.min(80, THREE.MathUtils.radToDeg(2 * Math.atan(tanFull)));
    const offX = w / 2 - (f.x + f.w / 2);
    const offY = h / 2 - (f.y + f.h / 2);
    camera.setViewOffset(w, h, offX, offY, w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function resize() {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    applyFocus(w, h);
    kitchen.fire.setPointScale(70 * renderer.getPixelRatio() * (h / 800));
    render(true);
  }

  function render(force) {
    if (disposed) return;
    const now = performance.now();
    if (!force && now - lastRender < 8) return;
    lastRender = now;
    applyState();
    renderer.render(scene, camera);
  }

  function startSeg(now) {
    seg = queue.shift();
    if (!seg) return;
    seg.t0 = now;
    seg.from = { ...state };
    if (seg.carry !== undefined) {
      // ao soltar a pizza, ela fica onde está; ao pegar, passa a seguir a pala
      state.carry = seg.carry;
    }
  }

  function tick(now) {
    if (disposed) return;
    requestAnimationFrame(tick);
    if (document.hidden) return;
    let active = false;
    if (!seg && queue.length) startSeg(now);
    if (seg) {
      active = true;
      const t = Math.min(1, (now - seg.t0) / seg.dur);
      const e = easeInOut(t);
      for (const [k, v] of Object.entries(seg.to)) state[k] = seg.from[k] + (v - seg.from[k]) * e;
      if (t >= 1) { seg = null; if (queue.length) startSeg(now); }
    }
    if (highlightUntil) {
      const left = highlightUntil - now;
      const amt = left > 0 ? Math.sin(Math.min(1, 1 - left / 900) * Math.PI) : 0;
      pizza.highlight(Math.min(stage, 4), amt);
      if (left <= 0) highlightUntil = 0;
      active = true;
    }
    // Fogo e vapor animam sempre, em taxa reduzida quando nada mais se move (economia de bateria).
    if (!reducedMotion) {
      const t = now / 1000;
      flick = 1 + Math.sin(now * 0.011) * 0.06 + Math.sin(now * 0.029) * 0.04 + Math.sin(now * 0.053) * 0.02;
      if (active || now - lastRender > idleMs) {
        kitchen.fire.update(t, state.heat);
        pizza.tick(t);
        render(true);
      }
    } else if (active) {
      render(true);
    }
  }

  function setStage(n, { instant = false } = {}) {
    n = Math.max(0, Math.min(8, n | 0));
    if (n === stage && !instant) return;
    const forward = n === stage + 1;
    stage = n;
    if (n !== 9) orbit = 0;
    if (instant || reducedMotion || !forward) {
      queue = []; seg = null;
      state = finalState(n);
      render(true);
      return;
    }
    queue.push(...segmentsFor(n));
  }

  function celebrate() {
    if (reducedMotion) return;
    highlightUntil = performance.now() + 900;
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    onFail?.(new Error('Contexto WebGL perdido'));
  });

  // Pré-compila todos os materiais (inclusive ingredientes ainda ocultos e a massa assada)
  // para evitar travadas de compilação de shader no meio das transições.
  state = finalState(8);
  applyState();
  try { await renderer.compileAsync(scene, camera); } catch { /* compileAsync indisponível: compila sob demanda */ }
  state = finalState(0);

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  requestAnimationFrame(tick);

  function dispose() {
    disposed = true;
    ro.disconnect();
    renderer.dispose();
    pmrem.dispose();
    canvas.remove();
  }

  const api = {
    setStage, celebrate, dispose,
    /** Retângulo (px do canvas) visível ao lado/acima do painel; a cena se enquadra nele. */
    setFocus(rect) { focus = rect; resize(); },
    /** Conclui a animação em curso imediatamente (capturas determinísticas em testes). */
    settle() { queue = []; seg = null; state = finalState(stage); render(true); },
    debugState: () => ({ stage, queue: queue.length, seg: Boolean(seg), px: state.px, pz: state.pz, peelZ: state.peelZ, carry: state.carry }),
    get info() {
      return { triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, dpr: renderer.getPixelRatio(), geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
    },
  };
  return api;
}
