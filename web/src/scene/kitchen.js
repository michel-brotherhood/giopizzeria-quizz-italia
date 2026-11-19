// Bancada napolitana contemporânea: pedra clara, parede de tijolo, forno de cúpula em mosaico marinho,
// pala de madeira (silhueta inspirada na pala do logotipo, como objeto cenográfico separado) e ingredientes.
import * as THREE from 'three';
import { stoneTexture, brickTexture, tileTexture, woodTexture, flourTexture, rng } from './textures.js';

export const OVEN = { x: -3.4, y: 0.3, z: -8.6, r: 4.2, mouthW: 1.95 };
export const OVEN_MOUTH = new THREE.Vector3(OVEN.x, OVEN.y + 0.05, OVEN.z + OVEN.r - 0.05);

function lathe(points, seg = 40) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg);
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
  // UV planar para a madeira
  blade.computeBoundingBox();
  const p = blade.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / 3.4 + 0.5; uv[i * 2 + 1] = p.getZ(i) / 3.4 + 0.5; }
  blade.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return blade;
}

export function createKitchen({ quality = 'high' } = {}) {
  const root = new THREE.Group();
  const r = rng(99);
  const aniso = quality === 'high' ? 4 : 1;

  // ---- Bancada de pedra (estende-se até a base do forno) ----
  const stone = stoneTexture(quality === 'high' ? 512 : 256);
  stone.anisotropy = aniso;
  stone.repeat.set(2, 1);
  const stoneMat = new THREE.MeshStandardMaterial({ map: stone, roughness: 0.58, metalness: 0 });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(18, 0.5, 8.2), stoneMat);
  counter.position.set(0, -0.25, -1.15);
  counter.receiveShadow = true;
  root.add(counter);

  // ---- Parede de tijolo ----
  const brick = brickTexture(quality === 'high' ? 512 : 256);
  brick.repeat.set(7, 4);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(44, 22), new THREE.MeshStandardMaterial({ map: brick, roughness: 0.92, color: 0xd9c4b0 }));
  wall.position.set(0, 5, -13.8);
  wall.receiveShadow = true;
  root.add(wall);

  // ---- Forno napolitano (escala plausível: boca ≈ 39 cm para pizza de 30 cm) ----
  const oven = new THREE.Group();
  oven.position.set(OVEN.x, OVEN.y, OVEN.z);
  const stucco = new THREE.MeshStandardMaterial({ color: 0xe9dcc1, roughness: 0.9 });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(9.6, 2.6, 9.4), stucco);
  plinth.position.set(0, -1.3 - 0.001, -0.3);
  plinth.receiveShadow = true;
  oven.add(plinth);
  // faixa vermelha (acento da marca) na borda do plinto
  const band = new THREE.Mesh(new THREE.BoxGeometry(9.62, 0.1, 9.42), new THREE.MeshStandardMaterial({ color: 0xc0322a, roughness: 0.6 }));
  band.position.set(0, -0.07, -0.3);
  oven.add(band);

  const tiles = tileTexture(quality === 'high' ? 512 : 256);
  tiles.repeat.set(9, 1);
  const domeGeo = new THREE.SphereGeometry(OVEN.r, 64, 22, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(domeGeo, new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.42, metalness: 0.05 }));
  dome.scale.y = 0.8;
  dome.castShadow = true;
  dome.receiveShadow = true;
  oven.add(dome);

  // Boca em arco abatido, fachada em estuque creme
  const fw = 2.35, fh = 2.25;
  const facade = new THREE.Shape();
  facade.moveTo(-fw, 0); facade.lineTo(fw, 0); facade.lineTo(fw, fh * 0.6);
  facade.quadraticCurveTo(fw, fh, 0, fh); facade.quadraticCurveTo(-fw, fh, -fw, fh * 0.6); facade.lineTo(-fw, 0);
  const hw = OVEN.mouthW, side = 0.28, archH = 0.95;
  const hole = new THREE.Path();
  hole.moveTo(-hw, 0); hole.lineTo(-hw, side); hole.absellipse(0, side, hw, archH, Math.PI, 0, true); hole.lineTo(hw, 0); hole.lineTo(-hw, 0);
  facade.holes.push(hole);
  const pietra = new THREE.MeshStandardMaterial({ color: 0xbfae93, roughness: 0.86 });
  const facadeMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(facade, { depth: 0.9, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 24 }), pietra);
  facadeMesh.position.set(0, 0, OVEN.r - 0.9);
  facadeMesh.castShadow = true;
  facadeMesh.receiveShadow = true;
  oven.add(facadeMesh);
  // arco de tijolo refratário ao redor da boca
  const archMat = new THREE.MeshStandardMaterial({ color: 0x9a4a2c, roughness: 0.85 });
  const arch = new THREE.Mesh(new THREE.TorusGeometry(hw + 0.12, 0.11, 8, 40, Math.PI), archMat);
  arch.scale.y = (archH + 0.12) / (hw + 0.12);
  arch.position.set(0, side, OVEN.r + 0.06);
  oven.add(arch);

  // Interior: fundo com brilho de brasa (gradiente radial)
  const gc = document.createElement('canvas'); gc.width = gc.height = 128;
  const gg = gc.getContext('2d');
  const grad = gg.createRadialGradient(64, 84, 6, 64, 74, 66);
  grad.addColorStop(0, '#ffd28a'); grad.addColorStop(0.32, '#ff8a3a'); grad.addColorStop(0.72, '#6e200e'); grad.addColorStop(1, '#160704');
  gg.fillStyle = grad; gg.fillRect(0, 0, 128, 128);
  const glowTex = new THREE.CanvasTexture(gc); glowTex.colorSpace = THREE.SRGBColorSpace;
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, toneMapped: false });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.6), glowMat);
  glow.position.set(0, 1.1, -0.6);
  oven.add(glow);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(OVEN.r - 0.3, 40), new THREE.MeshStandardMaterial({ color: 0x3a1c12, roughness: 1, emissive: 0x401406, emissiveIntensity: 0.6 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01;
  oven.add(floor);
  // chaminé
  const flue = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 4.2, 18), stucco);
  flue.position.set(0, 4.3, OVEN.r - 1.7);
  oven.add(flue);
  root.add(oven);

  // ---- Farinha sobre a bancada ----
  const flour = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshStandardMaterial({ map: flourTexture(), transparent: true, depthWrite: false, roughness: 1 }));
  flour.rotation.x = -Math.PI / 2;
  flour.position.set(0.1, 0.004, 0.45);
  flour.receiveShadow = true;
  root.add(flour);

  // ---- Pala de madeira ----
  const wood = woodTexture(quality === 'high' ? 512 : 256);
  const woodMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.72 });
  const peel = new THREE.Group();
  const blade = new THREE.Mesh(peelGeometry(), woodMat);
  blade.castShadow = true; blade.receiveShadow = true;
  peel.add(blade);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 3.4, 14), woodMat);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, 0.03, 1.45 + 1.7);
  handle.castShadow = true;
  peel.add(handle);
  // a lâmina aponta para -z; o cabo para +z
  root.add(peel);

  // ---- Ingredientes e utensílios ----
  const terracotta = new THREE.MeshStandardMaterial({ color: 0xb4572f, roughness: 0.82 });
  const bowl = new THREE.Mesh(lathe([[0, 0], [0.42, 0], [0.62, 0.12], [0.78, 0.36], [0.8, 0.42], [0.72, 0.42], [0.6, 0.18], [0, 0.12]], 40), terracotta);
  bowl.position.set(-2.55, 0, 1.25);
  bowl.castShadow = true; bowl.receiveShadow = true;
  root.add(bowl);
  const sauceIn = new THREE.Mesh(new THREE.CircleGeometry(0.66, 32), new THREE.MeshStandardMaterial({ color: 0xa3251a, roughness: 0.35 }));
  sauceIn.rotation.x = -Math.PI / 2; sauceIn.position.set(-2.55, 0.32, 1.25);
  root.add(sauceIn);

  const glaze = new THREE.MeshStandardMaterial({ color: 0xf1e9d8, roughness: 0.28 });
  const bowl2 = new THREE.Mesh(lathe([[0, 0], [0.38, 0], [0.6, 0.1], [0.72, 0.34], [0.74, 0.4], [0.68, 0.4], [0.56, 0.16], [0, 0.1]], 40), glaze);
  const B2 = { x: 2.35, z: -1.75 };
  bowl2.position.set(B2.x, 0, B2.z);
  bowl2.castShadow = true; bowl2.receiveShadow = true;
  root.add(bowl2);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.71, 0.018, 6, 40), new THREE.MeshStandardMaterial({ color: 0x041e42, roughness: 0.4 }));
  rim.rotation.x = Math.PI / 2; rim.position.set(B2.x, 0.4, B2.z);
  root.add(rim);
  const mozzMat = new THREE.MeshStandardMaterial({ color: 0xf8f4ea, roughness: 0.45 });
  for (const [dx, dz, s] of [[-0.18, 0.05, 0.26], [0.2, -0.08, 0.24], [0.02, 0.24, 0.22]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(s, 20, 14), mozzMat);
    b.position.set(B2.x + dx, 0.28 + s * 0.6, B2.z + dz);
    b.castShadow = true;
    root.add(b);
  }

  const tomatoMat = new THREE.MeshStandardMaterial({ color: 0xc4301c, roughness: 0.32 });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3f6b22, roughness: 0.6 });
  for (const [x, z, ry] of [[-1.55, -1.7, 0.4], [-1.05, -1.95, 1.4], [-1.25, -1.35, 2.3]]) {
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), tomatoMat);
    t.scale.set(1, 0.9, 1.55); t.position.set(x, 0.18, z); t.rotation.y = ry;
    t.castShadow = true;
    root.add(t);
    const st = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.08, 6), stemMat);
    st.position.set(x + Math.sin(ry) * 0.3, 0.2, z + Math.cos(ry) * 0.3);
    root.add(st);
  }

  // Garrafa de azeite
  const bottle = new THREE.Mesh(lathe([[0, 0], [0.32, 0], [0.34, 0.08], [0.34, 1.05], [0.3, 1.2], [0.12, 1.42], [0.11, 1.75], [0.13, 1.8], [0, 1.8]], 28),
    new THREE.MeshStandardMaterial({ color: 0x2e4a1f, roughness: 0.12, metalness: 0.0 }));
  bottle.position.set(-3.9, 0, -0.9);
  bottle.castShadow = true;
  root.add(bottle);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.345, 0.345, 0.42, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0xeedebd, roughness: 0.8 }));
  label.position.set(-3.9, 0.6, -0.9);
  root.add(label);

  // Folhas de manjericão soltas
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6e2c, roughness: 0.4, side: THREE.DoubleSide });
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0); leafShape.bezierCurveTo(0.17, 0.06, 0.15, 0.3, 0, 0.42); leafShape.bezierCurveTo(-0.15, 0.3, -0.17, 0.06, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 8);
  leafGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const l = new THREE.Mesh(leafGeo, leafMat);
    l.position.set(-0.6 + r() * 0.8, 0.012 + i * 0.004, -2.6 + r() * 0.6);
    l.rotation.y = r() * Math.PI * 2;
    l.rotation.z = (r() - 0.5) * 0.3;
    l.castShadow = true;
    root.add(l);
  }

  return { root, peel, oven, glowMat, flour, counter };
}
