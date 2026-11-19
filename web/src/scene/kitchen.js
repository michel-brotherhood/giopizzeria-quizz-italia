// Bancada do pizzaiolo (direção visual de 19/11/2026): pedra cinza quente com farinha, tábua redonda de
// madeira sob a pizza, cerâmica creme salpicada (molho, mozzarella, vaso de manjericão), galheteiro de
// azeite, pano listrado e, ao fundo à direita, o forno a lenha com arco de tijolos e luz quente.
import * as THREE from 'three';
import { warmStoneTexture, brickTexture, woodTexture, flourTexture, glowTexture, speckleTexture, wallTileTexture, towelTexture, rng } from './textures.js';
import { createFire } from './fire.js';

export const OVEN = { x: 3.8, y: 0.3, z: -8.6, r: 4.2, mouthW: 1.95 };
export const BOARD_TOP = 0.09; // altura do tampo da tábua: a pizza apoia aqui
export const OVEN_MOUTH = new THREE.Vector3(OVEN.x, OVEN.y + 0.05, OVEN.z + OVEN.r - 0.05);

function lathe(points, seg = 40) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg);
}

function planarUV(geo, size) {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / size + 0.5; uv[i * 2 + 1] = p.getZ(i) / size + 0.5; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** Pala: lâmina com ombros arredondados que afunilam até o cabo, como uma pala de forno real. */
function peelGeometry() {
  const w = 1.7, top = 1.65, shoulder = -0.55, neckW = 0.16, neckY = -1.45;
  const s = new THREE.Shape();
  const rc = 0.45;
  s.moveTo(-w, shoulder);
  s.lineTo(-w, top - rc);
  s.quadraticCurveTo(-w, top, -w + rc, top);
  s.lineTo(w - rc, top);
  s.quadraticCurveTo(w, top, w, top - rc);
  s.lineTo(w, shoulder);
  s.bezierCurveTo(w, shoulder - 0.45, neckW + 0.35, neckY + 0.15, neckW, neckY);
  s.lineTo(-neckW, neckY);
  s.bezierCurveTo(-neckW - 0.35, neckY + 0.15, -w, shoulder - 0.45, -w, shoulder);
  const blade = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.02, bevelSegments: 2, curveSegments: 18 });
  blade.rotateX(-Math.PI / 2);
  planarUV(blade, 3.4);
  return blade;
}

/** Tábua redonda com cabo (disco + cabo com furo), com tampo em y = BOARD_TOP. */
function boardGeometry(radius) {
  const a = 0.3;
  const s = new THREE.Shape();
  s.absarc(0, 0, radius, a, Math.PI * 2 - a, false);
  s.lineTo(radius + 0.25, -0.3); s.lineTo(radius + 1.4, -0.26);
  s.quadraticCurveTo(radius + 1.72, 0, radius + 1.4, 0.26);
  s.lineTo(radius + 0.25, 0.3); s.lineTo(radius * Math.cos(a), radius * Math.sin(a));
  const hole = new THREE.Path();
  hole.absarc(radius + 1.36, 0, 0.09, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: BOARD_TOP - 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.03, bevelSegments: 3, curveSegments: 64 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.01, 0);
  planarUV(geo, radius * 2.4);
  return geo;
}

/** Remove da cúpula os triângulos que ficam atrás da boca (área coberta pela fachada). */
function cutMouth(geo, scaleY) {
  const g = geo.toNonIndexed();
  const p = g.attributes.position, uv = g.attributes.uv;
  const keepP = [], keepUv = [];
  const lim = { x: OVEN.mouthW + 0.12, y: 0.28 + 0.95 + 0.12 };
  for (let i = 0; i < p.count; i += 3) {
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) { cx += p.getX(i + k) / 3; cy += p.getY(i + k) / 3; cz += p.getZ(i + k) / 3; }
    if (cz > 1.5 && Math.abs(cx) < lim.x && cy * scaleY < lim.y) continue;
    for (let k = 0; k < 3; k++) {
      keepP.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k));
      keepUv.push(uv.getX(i + k), uv.getY(i + k));
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(keepP, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(keepUv, 2));
  out.computeVertexNormals();
  return out;
}

function leafGeometry(len, wid) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(wid * 0.9, len * 0.15, wid * 0.75, len * 0.75, 0, len);
  s.bezierCurveTo(-wid * 0.75, len * 0.75, -wid * 0.9, len * 0.15, 0, 0);
  const geo = new THREE.ShapeGeometry(s, 8);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, x * x * 2.2); }
  geo.computeVertexNormals();
  return geo;
}

export function createKitchen({ quality = 'high' } = {}) {
  const root = new THREE.Group();
  const r = rng(99);
  const hi = quality === 'high';
  const aniso = hi ? 8 : 1;
  const shadow = (m, cast = true, receive = true) => { m.castShadow = cast; m.receiveShadow = receive; return m; };

  // ---- Bancada de pedra quente ----
  const stone = warmStoneTexture(hi ? 1024 : 512);
  stone.anisotropy = aniso;
  stone.repeat.set(1.8, 0.85);
  const counter = shadow(new THREE.Mesh(new THREE.BoxGeometry(18, 0.5, 8.2), new THREE.MeshStandardMaterial({ map: stone, roughness: 0.78 })), false);
  counter.position.set(0, -0.25, -1.15);
  root.add(counter);

  // ---- Parede de azulejo vinho ----
  const wall = shadow(new THREE.Mesh(new THREE.PlaneGeometry(44, 22), new THREE.MeshStandardMaterial({ map: wallTileTexture(hi ? 512 : 256), roughness: 0.4, color: 0x8a7470 })), false);
  wall.position.set(0, 5, -13.8);
  root.add(wall);

  // ---- Forno a lenha ao fundo à direita ----
  const oven = new THREE.Group();
  oven.position.set(OVEN.x, OVEN.y, OVEN.z);
  const bricks = brickTexture(hi ? 512 : 256);
  bricks.repeat.set(1, 1);
  const brickMat = new THREE.MeshStandardMaterial({ map: bricks, roughness: 0.9, color: 0xc2a690 });
  const plinth = shadow(new THREE.Mesh(new THREE.BoxGeometry(9.6, 2.6, 9.4), new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.85 })), false);
  plinth.position.set(0, -1.3 - 0.001, -0.3);
  oven.add(plinth);
  // cúpula em reboco de pedra escura (o arco de tijolos é o protagonista, como na direção)
  const domeTex = brickTexture(hi ? 512 : 256);
  domeTex.repeat.set(5, 1.6);
  const dome = shadow(new THREE.Mesh(cutMouth(new THREE.SphereGeometry(OVEN.r, 72, 24, 0, Math.PI * 2, 0, Math.PI / 2), 0.8),
    new THREE.MeshStandardMaterial({ map: domeTex, roughness: 0.92, color: 0x6e625a })));
  dome.scale.y = 0.8;
  oven.add(dome);
  // Fachada em tijolo com boca em arco abatido
  const fw = 2.35, fh = 2.1;
  const facade = new THREE.Shape();
  facade.moveTo(-fw, 0); facade.lineTo(fw, 0); facade.lineTo(fw, fh * 0.55);
  facade.quadraticCurveTo(fw, fh, 0, fh); facade.quadraticCurveTo(-fw, fh, -fw, fh * 0.55); facade.lineTo(-fw, 0);
  const hw = OVEN.mouthW, side = 0.28, archH = 0.95;
  const hole = new THREE.Path();
  hole.moveTo(-hw, 0); hole.lineTo(-hw, side); hole.absellipse(0, side, hw, archH, Math.PI, 0, true); hole.lineTo(hw, 0); hole.lineTo(-hw, 0);
  facade.holes.push(hole);
  const facadeGeo = new THREE.ExtrudeGeometry(facade, { depth: 0.9, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2, curveSegments: 28 });
  const fp = facadeGeo.attributes.position;
  const fuv = new Float32Array(fp.count * 2);
  for (let i = 0; i < fp.count; i++) { fuv[i * 2] = fp.getX(i) / 3.2 + fp.getZ(i) * 0.25; fuv[i * 2 + 1] = fp.getY(i) / 3.2; }
  facadeGeo.setAttribute('uv', new THREE.BufferAttribute(fuv, 2));
  const facadeMesh = shadow(new THREE.Mesh(facadeGeo, brickMat));
  facadeMesh.position.set(0, 0, OVEN.r - 0.9);
  oven.add(facadeMesh);
  const archMat = new THREE.MeshStandardMaterial({ color: 0x8a4a2e, roughness: 0.85, emissive: 0xff5a1a, emissiveIntensity: 0.1 });
  const arch = new THREE.Mesh(new THREE.TorusGeometry(hw + 0.1, 0.1, 8, 48, Math.PI), archMat);
  arch.scale.y = (archH + 0.1) / (hw + 0.1);
  arch.position.set(0, side, OVEN.r + 0.04);
  oven.add(arch);
  const sill = shadow(new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.18, 1.0), new THREE.MeshStandardMaterial({ color: 0x6b5f55, roughness: 0.8 })));
  sill.position.set(0, -0.08, OVEN.r + 0.45);
  oven.add(sill);
  // Interior: cúpula interna e piso refratário que recebem a luz do fogo
  const innerMat = new THREE.MeshStandardMaterial({ color: 0x3a1a10, roughness: 0.95, side: THREE.BackSide, emissive: 0x2a0c04, emissiveIntensity: 1 });
  const inner = new THREE.Mesh(new THREE.SphereGeometry(OVEN.r - 0.25, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), innerMat);
  inner.scale.y = 0.7;
  oven.add(inner);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x6b3a26, roughness: 0.95, emissive: 0x3a1206, emissiveIntensity: 0.8 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(OVEN.r - 0.3, 48), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01;
  floor.receiveShadow = true;
  oven.add(floor);
  const fire = createFire({ embers: hi ? 48 : 24 });
  fire.group.position.set(1.3, 0.02, -1.5);
  oven.add(fire.group);
  const haloMat = new THREE.SpriteMaterial({ map: glowTexture(128), color: 0xffa860, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0.3 });
  const halo = new THREE.Sprite(haloMat);
  halo.scale.set(5.2, 2.6, 1);
  halo.position.set(0, 0.85, OVEN.r + 0.3);
  oven.add(halo);
  root.add(oven);

  // ---- Farinha irregular sobre a pedra ----
  const flourMat = new THREE.MeshStandardMaterial({ map: flourTexture(hi ? 512 : 256), transparent: true, depthWrite: false, roughness: 1 });
  for (const [x, z, w, d, rot] of [[0.2, 0.5, 6.4, 5.6, 0.4], [-2.2, 1.6, 2.8, 2.2, 1.7], [2.6, -1.0, 2.6, 2.2, 2.6]]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), flourMat);
    f.rotation.x = -Math.PI / 2; f.rotation.z = rot;
    f.position.set(x, 0.003, z);
    f.receiveShadow = true;
    root.add(f);
  }

  // ---- Madeira: tábua redonda sob a pizza e pala ----
  const wood = woodTexture(hi ? 512 : 256);
  wood.anisotropy = aniso;
  const woodMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.82, color: 0xbfa58c });
  const board = shadow(new THREE.Mesh(boardGeometry(1.8), woodMat));
  board.position.set(0, 0, 0.4);
  board.rotation.y = -2.4; // cabo para a frente, à esquerda (como na prévia)
  root.add(board);
  const boardFlour = new THREE.Mesh(new THREE.CircleGeometry(1.72, 48), flourMat);
  boardFlour.rotation.x = -Math.PI / 2;
  boardFlour.position.set(0, BOARD_TOP + 0.002, 0.4);
  root.add(boardFlour);

  const peel = new THREE.Group();
  peel.add(shadow(new THREE.Mesh(peelGeometry(), woodMat)));
  const handle = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 3.4, 14), woodMat));
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, 0.03, 1.45 + 1.7);
  peel.add(handle);
  root.add(peel);

  // ---- Cerâmica creme salpicada ----
  const ceramic = new THREE.MeshStandardMaterial({ map: speckleTexture(256), roughness: 0.62 });
  const bowlProfile = [[0, 0], [0.42, 0], [0.62, 0.12], [0.8, 0.4], [0.84, 0.52], [0.78, 0.52], [0.6, 0.2], [0, 0.14]];
  // molho de tomate com colher de pau
  const bowl = shadow(new THREE.Mesh(lathe(bowlProfile, 48), ceramic));
  bowl.position.set(-2.9, 0, -0.8);
  root.add(bowl);
  const sauceIn = new THREE.Mesh(new THREE.CircleGeometry(0.72, 40), new THREE.MeshStandardMaterial({ color: 0xa8231a, roughness: 0.3 }));
  sauceIn.rotation.x = -Math.PI / 2; sauceIn.position.set(-2.9, 0.42, -0.8);
  root.add(sauceIn);
  const spoon = new THREE.Group();
  const spoonHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), woodMat);
  spoonHead.scale.set(1, 0.4, 1.4);
  spoon.add(spoonHead);
  const spoonStick = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.5, 8), woodMat));
  spoonStick.position.set(0, 0, 0.85); spoonStick.rotation.x = Math.PI / 2;
  spoon.add(spoonStick);
  spoon.position.set(-2.95, 0.45, -0.85);
  spoon.rotation.set(-0.55, 0.5, 0);
  root.add(spoon);
  // mozzarella em pedaços
  const bowl2 = shadow(new THREE.Mesh(lathe(bowlProfile.map(([x, y]) => [x * 0.9, y * 0.9]), 48), ceramic));
  bowl2.position.set(-1.1, 0, -2.4);
  root.add(bowl2);
  const mozzMat = new THREE.MeshStandardMaterial({ color: 0xf8f4ea, roughness: 0.45 });
  for (let i = 0; i < 6; i++) {
    const b = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.24), mozzMat), true, false);
    const ang = i * 1.1;
    b.position.set(-1.1 + Math.cos(ang) * 0.3, 0.36 + (i % 2) * 0.08, -2.4 + Math.sin(ang) * 0.28);
    b.rotation.set(r() * 0.6, r() * 3, r() * 0.6);
    root.add(b);
  }

  // ---- Galheteiro de azeite: vidro, azeite dourado e rolha ----
  const glass = new THREE.Mesh(lathe([[0, 0], [0.42, 0], [0.5, 0.25], [0.5, 0.65], [0.3, 1.0], [0.15, 1.25], [0.14, 1.55], [0, 1.55]], 32),
    new THREE.MeshStandardMaterial({ color: 0xfff6e0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false }));
  glass.position.set(-0.3, 0, -3.3);
  glass.renderOrder = 1;
  const oilIn = shadow(new THREE.Mesh(lathe([[0, 0.02], [0.4, 0.02], [0.47, 0.25], [0.47, 0.62], [0, 0.62]], 32),
    new THREE.MeshStandardMaterial({ color: 0xa8741a, roughness: 0.12, emissive: 0x2a1600, emissiveIntensity: 0.35, transparent: true, opacity: 0.88 })));
  oilIn.position.copy(glass.position);
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.22, 12), new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.9 }));
  cork.position.set(-0.3, 1.62, -3.3);
  root.add(oilIn, glass, cork);

  // ---- Vaso de manjericão ----
  const pot = shadow(new THREE.Mesh(lathe([[0, 0], [0.55, 0], [0.62, 0.9], [0.66, 0.95], [0, 0.95]], 36), ceramic));
  pot.position.set(-3.8, 0, -3.4);
  root.add(pot);
  const potBand = new THREE.Mesh(new THREE.CylinderGeometry(0.625, 0.62, 0.08, 36, 1, true), new THREE.MeshStandardMaterial({ color: 0xb8402c, roughness: 0.6 }));
  potBand.position.set(-3.8, 0.72, -3.4);
  root.add(potBand);
  const basilMat = new THREE.MeshStandardMaterial({ color: 0x356f2a, roughness: 0.45, side: THREE.DoubleSide });
  const leafGeo = leafGeometry(0.42, 0.22);
  const leaves = new THREE.InstancedMesh(leafGeo, basilMat, 46);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  for (let i = 0; i < 46; i++) {
    const ang = i * 2.399, h = 1.0 + (i / 46) * 1.3, rad = 0.18 + Math.sin(i * 0.7) * 0.12 + (1 - i / 46) * 0.3;
    pos.set(-3.8 + Math.cos(ang) * rad, h, -3.4 + Math.sin(ang) * rad);
    e.set(-0.9 + r() * 0.5, -ang + Math.PI / 2, r() * 0.4);
    q.setFromEuler(e);
    const k = 0.8 + r() * 0.6; sc.set(k, k, k);
    leaves.setMatrixAt(i, m4.compose(pos, q, sc));
  }
  leaves.castShadow = true;
  root.add(leaves);
  for (let i = 0; i < 3; i++) {
    const l = shadow(new THREE.Mesh(leafGeo, basilMat), true, false);
    l.rotation.set(-Math.PI / 2, 0, i * 1.2 + 0.4);
    l.position.set(2.1 + i * 0.12, 0.02 + i * 0.01, -1.7 + i * 0.05);
    root.add(l);
  }

  // ---- Pano de prato dobrado ----
  const towelGeo = new THREE.BoxGeometry(2.6, 0.12, 1.7, 24, 1, 12);
  const tp = towelGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i);
    tp.setY(i, tp.getY(i) + Math.sin(x * 2.4 + z * 1.3) * 0.04 + Math.max(0, -x - 0.6) * 0.18);
  }
  towelGeo.computeVertexNormals();
  const towel = shadow(new THREE.Mesh(towelGeo, new THREE.MeshStandardMaterial({ map: towelTexture(256), roughness: 0.95 })));
  towel.position.set(-3.7, 0.07, 1.9);
  towel.rotation.y = 0.5;
  root.add(towel);

  return { root, peel, oven, fire, halo: haloMat, arch: archMat, inner: innerMat, floor: floorMat, counter };
}
