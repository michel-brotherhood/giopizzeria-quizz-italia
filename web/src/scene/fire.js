// Fogo de lenha do forno: chamas em shader (planos cruzados, aditivos), toras com brasa e fagulhas subindo.
// Tudo procedural e barato: um uniforme de tempo anima chamas e fagulhas sem recriar geometria.
import * as THREE from 'three';

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }
`;

function flameMaterial(time, seed) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: time, uSeed: { value: seed }, uHeat: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uSeed; uniform float uHeat;
      varying vec2 vUv;
      ${NOISE}
      void main() {
        vec2 uv = vUv;
        float t = uTime * 1.6 + uSeed * 10.0;
        float n = fbm(vec2(uv.x * 3.0 + uSeed * 3.1, uv.y * 2.2 - t));
        float n2 = fbm(vec2(uv.x * 6.0 - uSeed, uv.y * 4.0 - t * 1.7));
        float x = (uv.x - 0.5) * 2.0;
        x += (n - 0.5) * 0.9 * uv.y;
        float width = mix(0.95, 0.05, pow(uv.y, 0.8));
        float body = smoothstep(width, width * 0.25, abs(x));
        float top = smoothstep(1.0, 0.25 + n2 * 0.35, uv.y);
        float f = body * top * smoothstep(0.0, 0.08, uv.y);
        f *= 0.65 + n2 * 0.7;
        vec3 col = mix(vec3(0.85, 0.16, 0.03), vec3(1.0, 0.55, 0.12), smoothstep(0.15, 0.55, f));
        col = mix(col, vec3(1.0, 0.92, 0.7), smoothstep(0.62, 0.95, f));
        float a = smoothstep(0.08, 0.5, f) * uHeat;
        gl_FragColor = vec4(col * a * 1.6, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

function emberMaterial(time) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: time, uScale: { value: 60 }, uHeat: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uScale;
      attribute vec4 aSeed; // x,z deslocamento; y velocidade; w fase
      varying float vLife;
      void main() {
        float life = fract(uTime * aSeed.y + aSeed.w);
        vLife = life;
        vec3 p = position;
        p.y += life * 2.6;
        p.x += sin(life * 6.0 + aSeed.w * 20.0) * 0.25 * life + aSeed.x * life;
        p.z += cos(life * 5.0 + aSeed.w * 13.0) * 0.18 * life + aSeed.z * life;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uScale * (1.0 - life * 0.6) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uHeat;
      varying float vLife;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * smoothstep(1.0, 0.55, vLife) * smoothstep(0.0, 0.08, vLife) * uHeat;
        vec3 col = mix(vec3(1.0, 0.8, 0.45), vec3(1.0, 0.32, 0.05), vLife);
        gl_FragColor = vec4(col * a * 1.8, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/**
 * Cria o fogo em coordenadas locais do forno (piso em y=0).
 * @returns {{ group: THREE.Group, update(t:number, heat:number): void }}
 */
export function createFire({ embers = 48 } = {}) {
  const group = new THREE.Group();
  const time = { value: 0 };

  // Toras de lenha cruzadas, com pontas em brasa.
  const charMat = new THREE.MeshStandardMaterial({ color: 0x120c09, roughness: 1, emissive: 0xff4a10, emissiveIntensity: 0.06 });
  const logs = [[0.0, 0.5, 0.25], [0.15, -0.6, 0.18], [-0.2, 1.5, 0.12]];
  for (const [dx, ry, y] of logs) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.6, 10), charMat);
    log.rotation.set(0, ry, Math.PI / 2);
    log.position.set(dx, 0.16 + y * 0.5, 0);
    group.add(log);
  }
  const coalMat = new THREE.MeshBasicMaterial({ color: 0xff6a1e, toneMapped: false });
  const coalGeo = new THREE.IcosahedronGeometry(0.07, 0);
  const coals = new THREE.InstancedMesh(coalGeo, coalMat, 26);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39, d = 0.25 + (i % 7) * 0.12;
    const k = 0.6 + (i % 3) * 0.4;
    m4.makeScale(k, k, k).setPosition(Math.cos(a) * d, 0.04, Math.sin(a) * d * 0.7);
    coals.setMatrixAt(i, m4);
  }
  group.add(coals);

  // Chamas: pares de planos cruzados com sementes diferentes.
  const flames = [];
  const flameDefs = [[0, 0, 1.9, 1.2, 0.1], [0.35, 0.1, 1.4, 0.9, 0.37], [-0.4, -0.05, 1.5, 0.9, 0.71], [0.05, -0.2, 1.1, 1.4, 0.93]];
  for (const [x, z, h, w, seed] of flameDefs) {
    for (const rot of [0, Math.PI / 2]) {
      const m = flameMaterial(time, seed + rot);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      plane.position.set(x, h / 2 + 0.05, z);
      plane.rotation.y = rot + seed;
      plane.renderOrder = 2;
      flames.push(m);
      group.add(plane);
    }
  }

  // Fagulhas
  const pos = new Float32Array(embers * 3);
  const seed = new Float32Array(embers * 4);
  for (let i = 0; i < embers; i++) {
    const a = i * 2.399, d = (i % 9) * 0.06;
    pos.set([Math.cos(a) * d, 0.3, Math.sin(a) * d], i * 3);
    seed.set([(Math.sin(i * 12.9) * 0.5) * 0.8, 0.18 + (i % 11) * 0.03, 0.35 + Math.cos(i * 7.3) * 0.35, (i * 0.618) % 1], i * 4);
  }
  const eg = new THREE.BufferGeometry();
  eg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  eg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const em = emberMaterial(time);
  const points = new THREE.Points(eg, em);
  points.frustumCulled = false;
  points.renderOrder = 3;
  group.add(points);

  function update(t, heat) {
    time.value = t;
    const h = 0.55 + heat * 0.45;
    for (const m of flames) m.uniforms.uHeat.value = h;
    em.uniforms.uHeat.value = h;
    charMat.emissiveIntensity = 0.03 + heat * 0.06;
  }
  return { group, update, setPointScale(px) { em.uniforms.uScale.value = px; } };
}
