// Pizza napolitana procedural: panetto -> disco com cornicione -> molho -> mozzarella -> manjericão -> azeite -> assada.
import * as THREE from 'three';
import { makeNoise, fbm, rng, doughTexture, sauceTexture, steamTexture } from './textures.js';

const R = 1.5; // raio do disco (≈30 cm na escala da cena)

function planarUV(geo, radius) {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) / (radius * 2) + 0.5;
    uv[i * 2 + 1] = 0.5 - p.getZ(i) / (radius * 2);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function doughDiscGeometry() {
  // Perfil (raio, altura): base fina e cornicione aerado e irregular.
  const prof = [
    [0, 0.07], [0.4, 0.07], [0.9, 0.065], [1.18, 0.07], [1.26, 0.1], [1.33, 0.17], [1.4, 0.215],
    [1.46, 0.2], [1.5, 0.14], [1.52, 0.06], [1.5, 0.0], [0, 0.0],
  ].reverse().map(([x, y]) => new THREE.Vector2(x, y)); // ordem invertida: faces superiores voltadas para fora
  const geo = new THREE.LatheGeometry(prof, 112);
  const n = makeNoise(5, 64);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const r = Math.hypot(v.x, v.z);
    if (r < 1e-4) continue;
    const ang = Math.atan2(v.z, v.x);
    const a = (ang / (Math.PI * 2) + 1) * 64;
    const wob = (fbm(n, a * 0.35, 3.3, 3) - 0.5);
    const rimness = Math.max(0, (r - 1.15) / 0.37);
    const rs = 1 + wob * 0.05 * Math.min(1, r / 1.2);
    v.x *= rs; v.z *= rs;
    if (v.y > 0.01) v.y *= 1 + (fbm(n, a * 0.6, 9.1, 3) - 0.5) * 0.9 * rimness + (n(a * 2.3, 1.7) - 0.5) * 0.05;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  planarUV(geo, R * 1.03);
  return geo;
}

function ballGeometry() {
  const geo = new THREE.SphereGeometry(0.6, 48, 32);
  const n = makeNoise(9, 64);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + (fbm(n, v.x * 3 + 4, v.z * 3 + v.y * 2 + 4, 3) - 0.5) * 0.08;
    v.multiplyScalar(k);
    v.y = v.y < 0 ? v.y * 0.25 : v.y * 0.7; // assenta na bancada
    p.setXYZ(i, v.x, v.y + 0.15, v.z);
  }
  geo.computeVertexNormals();
  planarUV(geo, 0.6);
  return geo;
}

function blobGeometry(seed) {
  const geo = new THREE.SphereGeometry(1, 22, 14);
  const n = makeNoise(seed, 32);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + (fbm(n, v.x * 1.6 + 9, v.z * 1.6 + v.y + 9, 3) - 0.5) * 0.55);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function leafGeometry(len = 0.42, wid = 0.2, curl = 0.9) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(wid * 0.9, len * 0.15, wid * 0.75, len * 0.75, 0, len);
  s.bezierCurveTo(-wid * 0.75, len * 0.75, -wid * 0.9, len * 0.15, 0, 0);
  const geo = new THREE.ShapeGeometry(s, 10);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const z = (x * x) * curl * 3 + Math.sin((y / len) * Math.PI) * 0.03; // curvatura transversal e longitudinal
    p.setXYZ(i, x, y, z);
  }
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export function createPizza() {
  const group = new THREE.Group();
  group.name = 'pizza';
  const r = rng(77);

  const rawMap = doughTexture(false);
  const bakedMap = doughTexture(true);
  const doughMat = new THREE.MeshStandardMaterial({ map: rawMap, roughness: 0.88, metalness: 0 });

  const ball = new THREE.Mesh(ballGeometry(), doughMat);
  ball.castShadow = true; ball.receiveShadow = true;
  group.add(ball);

  const disc = new THREE.Mesh(doughDiscGeometry(), doughMat);
  disc.castShadow = true; disc.receiveShadow = true;
  group.add(disc);

  const sauceGeo = new THREE.CircleGeometry(1.24, 96);
  sauceGeo.rotateX(-Math.PI / 2);
  const sauceMat = new THREE.MeshStandardMaterial({
    map: sauceTexture(), transparent: true, alphaTest: 0.4, roughness: 0.42, metalness: 0,
  });
  const sauce = new THREE.Mesh(sauceGeo, sauceMat);
  sauce.position.y = 0.074;
  sauce.receiveShadow = true;
  group.add(sauce);

  const mozzMat = new THREE.MeshStandardMaterial({ color: 0xf6f0e2, roughness: 0.5, metalness: 0 });
  const mozz = [];
  const mozzPos = [[0.05, 0.1], [-0.55, 0.35], [0.6, 0.45], [-0.25, -0.6], [0.5, -0.45], [-0.75, -0.2], [0.05, 0.75], [0.2, -0.15], [-0.35, 0.8], [0.85, -0.05], [-0.85, 0.3]];
  mozzPos.forEach(([x, z], i) => {
    const m = new THREE.Mesh(blobGeometry(100 + i), mozzMat);
    const s = 0.17 + r() * 0.09;
    m.userData = { x, z, s, rot: r() * Math.PI, delay: i * 0.045 };
    m.castShadow = true;
    m.rotation.y = m.userData.rot;
    mozz.push(m); group.add(m);
  });

  const basilMat = new THREE.MeshStandardMaterial({ color: 0x2f6e2c, roughness: 0.38, metalness: 0, side: THREE.DoubleSide });
  const basil = [];
  [[-0.2, 0.35, 0.4], [0.35, 0.05, 2.1], [-0.45, -0.3, 4.2], [0.25, -0.55, 5.4], [-0.05, -0.05, 1.2]].forEach(([x, z, rot], i) => {
    const b = new THREE.Mesh(leafGeometry(0.4 + r() * 0.12, 0.19 + r() * 0.05), basilMat);
    b.userData = { x, z, rot, delay: i * 0.08 };
    b.castShadow = true;
    basil.push(b); group.add(b);
  });

  // Fio de azeite: manchas finas e brilhantes.
  const oilMat = new THREE.MeshStandardMaterial({ color: 0xd9b23a, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.45 });
  const oil = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const g = new THREE.CircleGeometry(0.06 + r() * 0.07, 14);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, oilMat);
    const a = r() * Math.PI * 2, d = 0.2 + r() * 0.85;
    m.position.set(Math.cos(a) * d, 0.082, Math.sin(a) * d);
    m.scale.set(1.8, 1, 0.7);
    m.rotation.y = r() * Math.PI;
    oil.add(m);
  }
  group.add(oil);

  // Vapor da pizza recém-assada
  const steamMap = steamTexture();
  const steam = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.SpriteMaterial({ map: steamMap, transparent: true, depthWrite: false, opacity: 0, color: 0xfff6ea });
    const sp = new THREE.Sprite(m);
    sp.userData = { phase: i / 7, x: Math.cos(i * 2.4) * 0.55, z: Math.sin(i * 2.4) * 0.45 };
    sp.visible = false;
    steam.push(sp); group.add(sp);
  }
  let steamAmt = 0;

  const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const pop = (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const c = 1.6; // leve overshoot
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  };

  let bakedApplied = false;
  /** Aplica um estado contínuo { ball, disc, sauce, mozz, basil, oil, baked } (0..1). */
  function apply(s) {
    const b = ease(1 - s.disc);
    ball.visible = b > 0.001;
    ball.scale.set(0.9 + 0.4 * (1 - b), b, 0.9 + 0.4 * (1 - b)).multiplyScalar(1);
    ball.scale.y = Math.max(0.001, b);

    const d = ease(s.disc);
    disc.visible = d > 0.001;
    disc.scale.set(0.35 + 0.65 * d, Math.max(0.001, d), 0.35 + 0.65 * d);

    const sc = ease(s.sauce);
    sauce.visible = sc > 0.001;
    sauce.scale.setScalar(Math.max(0.001, sc));
    sauce.rotation.y = (1 - sc) * 1.4;

    const melt = ease(s.baked);
    mozz.forEach((m) => {
      const t = pop((s.mozz - m.userData.delay) / (1 - 0.5));
      m.visible = t > 0.001;
      const k = Math.max(0.001, t) * m.userData.s;
      m.scale.set(k * (1 + melt * 0.35), k * (0.42 - melt * 0.12), k * (1 + melt * 0.32));
      m.position.set(m.userData.x, 0.1 - melt * 0.02 + (1 - Math.min(1, t)) * 0.25, m.userData.z);
    });
    basil.forEach((l) => {
      const t = pop((s.basil - l.userData.delay) / (1 - 0.4));
      l.visible = t > 0.001;
      l.scale.setScalar(Math.max(0.001, t));
      l.position.set(l.userData.x, 0.135 + (1 - Math.min(1, t)) * 0.3 - melt * 0.02, l.userData.z);
      l.rotation.set(0, l.userData.rot, 0);
    });
    steamAmt = s.baked > 0.98 ? (s.steam ?? 1) : 0;
    oil.visible = s.oil > 0.01;
    oilMat.opacity = 0.45 * ease(s.oil);

    const baked = s.baked > 0.5;
    if (baked !== bakedApplied) {
      bakedApplied = baked;
      doughMat.map = baked ? bakedMap : rawMap;
      doughMat.needsUpdate = true;
      mozzMat.color.set(baked ? 0xf0dfbb : 0xf6f0e2);
      mozzMat.roughness = baked ? 0.42 : 0.5;
      basilMat.color.set(baked ? 0x24561f : 0x2f6e2c);
      sauceMat.color.set(baked ? 0xd9c2b8 : 0xffffff);
    }
  }

  /** Destaque discreto ao acertar: brilho quente rápido no ingrediente. */
  const highlightTargets = { 1: [doughMat], 2: [sauceMat], 3: [mozzMat], 4: [basilMat, oilMat] };
  function highlight(stage, amount) {
    for (const mats of Object.values(highlightTargets)) for (const m of mats) m.emissive?.setRGB(0, 0, 0);
    const list = highlightTargets[stage] ?? [doughMat];
    for (const m of list) m.emissive?.setRGB(0.22 * amount, 0.13 * amount, 0.04 * amount);
  }

  /** Anima o vapor (t em segundos). Retorna true se algo está visível e precisa de quadros. */
  function tick(t) {
    for (const sp of steam) {
      sp.visible = steamAmt > 0.01;
      if (!sp.visible) continue;
      const life = (t * 0.22 + sp.userData.phase) % 1;
      sp.position.set(sp.userData.x + Math.sin(t * 0.7 + sp.userData.phase * 9) * 0.15 * life, 0.3 + life * 2.2, sp.userData.z);
      const k = 0.5 + life * 1.6;
      sp.scale.set(k, k, 1);
      sp.material.opacity = Math.sin(life * Math.PI) * 0.22 * steamAmt;
    }
    return steamAmt > 0.01;
  }

  return { group, apply, highlight, tick, radius: R };
}
