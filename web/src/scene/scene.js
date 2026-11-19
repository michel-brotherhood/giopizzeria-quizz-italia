// Cena 3D principal. Recebe eventos (setStage, celebrate) — não decide estado do jogo nem do brinde.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createKitchen, OVEN } from './kitchen.js';
import { createPizza } from './pizza.js';

const P0 = { x: 0, y: 0, z: 0.4 };
const BLADE_OFFSET = -0.55; // centro da lâmina no eixo local z da pala
const INSIDE_Z = OVEN.z + 0.9;             // centro da pizza dentro do forno
const MOUTH_Z = OVEN.z + OVEN.r + 1.7;       // diante da boca, do lado de fora
const PEEL_REST = { peelX: 4.6, peelY: 0, peelZ: 1.2, peelRot: Math.PI / 2 };

const CAMS = {
  0: { cx: 3.3, cy: 4.8, cz: 7.6, tx: -1.0, ty: 0.7, tz: -2.3 },
  1: { cx: 2.3, cy: 5.7, cz: 6.3, tx: -0.3, ty: 0.25, tz: -0.4 },
  6: { cx: 3.1, cy: 5.3, cz: 7.0, tx: 0.2, ty: 0.3, tz: -0.4 },
  7: { cx: 1.4, cy: 4.4, cz: 2.4, tx: -3.3, ty: 1.0, tz: -5.6 },
  8: { cx: 2.4, cy: 5.5, cz: 6.2, tx: 0.0, ty: 0.25, tz: -0.1 },
  9: { cx: 2.2, cy: 5.6, cz: 5.4, tx: 0.0, ty: 0.1, tz: 0.35 },
};
const camFor = (s) => CAMS[s] ?? CAMS[s >= 1 && s <= 5 ? 1 : 0];

const ING = ['disc', 'sauce', 'mozz', 'basil', 'oil'];

/** Estado final (sem animação) de cada etapa 0..9. */
function finalState(stage) {
  const s = {
    ball: 1, disc: 0, sauce: 0, mozz: 0, basil: 0, oil: 0, baked: 0,
    px: P0.x, py: P0.y, pz: P0.z, ...PEEL_REST, heat: 0.35, carry: 0, highlight: 0,
    ...camFor(stage),
  };
  ING.forEach((k, i) => { if (stage >= i + 1) s[k] = 1; });
  if (stage >= 1) s.ball = 0;
  if (stage === 6) Object.assign(s, { py: 0.055, peelX: P0.x - BLADE_OFFSET, peelZ: P0.z, carry: 1 });
  if (stage === 7) {
    Object.assign(s, { px: OVEN.x, py: OVEN.y + 0.06 + 0.055, pz: INSIDE_Z, peelX: OVEN.x, peelY: OVEN.y + 0.06, peelZ: INSIDE_Z - BLADE_OFFSET + 6.4, peelRot: 0, heat: 1 });
  }
  if (stage >= 8) {
    const rot = 0.6;
    Object.assign(s, {
      baked: 1, px: P0.x, py: 0.055, pz: P0.z, peelRot: rot,
      peelX: P0.x - Math.sin(rot) * BLADE_OFFSET, peelY: 0, peelZ: P0.z - Math.cos(rot) * BLADE_OFFSET, carry: 1, heat: 0.5,
    });
  }
  return s;
}

/** Sequência animada para chegar à etapa `stage` partindo de `stage-1`. */
function segmentsFor(stage) {
  const f = finalState(stage);
  const cam = camFor(stage);
  if (stage === 6) {
    return [
      { dur: 500, to: { ...cam, py: 0.055 } },
      { dur: 750, to: { peelX: f.peelX, peelZ: f.peelZ, peelRot: f.peelRot } },
      { dur: 1, to: {}, carry: 1 },
    ];
  }
  if (stage === 7) {
    return [
      { dur: 850, carry: 1, to: { peelRot: 0, peelX: OVEN.x, peelY: OVEN.y + 0.06, peelZ: MOUTH_Z - BLADE_OFFSET, ...cam } },
      { dur: 750, to: { peelZ: INSIDE_Z - BLADE_OFFSET, heat: 0.8 } },
      { dur: 1, carry: 0, to: {} },
      { dur: 650, to: { peelZ: f.peelZ, heat: 1 } },
    ];
  }
  if (stage === 8) {
    return [
      { dur: 300, to: { baked: 1 } },
      { dur: 550, to: { peelZ: INSIDE_Z - BLADE_OFFSET } },
      { dur: 1, carry: 1, to: {} },
      { dur: 700, to: { peelZ: MOUTH_Z - BLADE_OFFSET, heat: 0.7 } },
      { dur: 850, to: { peelX: f.peelX, peelY: 0, peelZ: f.peelZ, peelRot: f.peelRot, heat: f.heat, ...cam } },
    ];
  }
  const to = {};
  for (const k of Object.keys(f)) if (k !== 'carry') to[k] = f[k];
  return [{ dur: stage === 9 ? 900 : 800, to, carry: f.carry }];
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
  container.appendChild(canvas);

  const maxDpr = quality === 'high' ? 1.5 : 1;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a1a13);
  scene.fog = new THREE.Fog(0x2a1a13, 18, 44);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 90);

  // Luz: forno quente como principal, preenchimento neutro para a comida, sombras de contato leves.
  scene.add(new THREE.HemisphereLight(0xfff3e4, 0x5a3b2a, 0.85));
  const key = new THREE.DirectionalLight(0xfff0dc, 1.75);
  key.position.set(4.5, 9, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(quality === 'high' ? 1024 : 512, quality === 'high' ? 1024 : 512);
  Object.assign(key.shadow.camera, { left: -9, right: 7, top: 7, bottom: -11, near: 1, far: 34 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key);
  const ovenLight = new THREE.PointLight(0xff7a2e, 30, 16, 2);
  ovenLight.position.set(OVEN.x, OVEN.y + 1.0, OVEN.z + OVEN.r + 0.7);
  scene.add(ovenLight);
  const innerLight = new THREE.PointLight(0xff8a3a, 10, 6, 2);
  innerLight.position.set(OVEN.x, OVEN.y + 1.2, OVEN.z + 1.2);
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
    const h = state.heat;
    ovenLight.intensity = (14 + h * 34) * flick;
    innerLight.intensity = 4 + h * 14;
    kitchen.glowMat.color.setScalar(0.55 + h * 0.6);
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

  function resize() {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    // Em telas estreitas, abre o campo de visão para manter a pizza e o forno no quadro.
    camera.fov = aspect < 1 ? Math.min(52, 34 / Math.pow(aspect, 0.75)) : aspect > 1.9 ? 30 : 34;
    camera.updateProjectionMatrix();
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
      pizza.highlight(Math.min(stage, 5), amt);
      if (left <= 0) highlightUntil = 0;
      active = true;
    }
    if (stage === 9 && !reducedMotion) { orbit += 16; active = true; }
    // Chama do forno: oscilação sutil, a ~15 fps quando nada mais anima (economia de bateria).
    if (!reducedMotion) {
      flick = 1 + Math.sin(now * 0.011) * 0.05 + Math.sin(now * 0.031) * 0.03;
      if (active || now - lastRender > 66) render(true);
    } else if (active) {
      render(true);
    }
  }

  function setStage(n, { instant = false } = {}) {
    n = Math.max(0, Math.min(9, n | 0));
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
    /** Conclui a animação em curso imediatamente (capturas determinísticas em testes). */
    settle() { queue = []; seg = null; state = finalState(stage); render(true); },
    debugState: () => ({ stage, queue: queue.length, seg: Boolean(seg), px: state.px, pz: state.pz, peelZ: state.peelZ, carry: state.carry }),
    get info() {
      return { triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, dpr: renderer.getPixelRatio(), geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
    },
  };
  return api;
}
