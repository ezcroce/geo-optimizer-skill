// ─────────────────────────────────────────────────────────────
//  v37: cielo "pixel art in 3D" — azzurro saturo a fasce con striature orizzontali
//  e nuvole a sbuffi con riccioli a spirale (come le nuvole disegnate a pixel), ma solide:
//  sbuffi tondi ombreggiati a tre toni (bianco, celeste, azzurro) con i riccioli in rilievo.
//  Ogni nuvola è un'unica geometria (una sola chiamata di disegno) e si gira verso la camera.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export const SKY_COLORS = { top: '#2f6fd8', mid: '#5b9cf0', bottom: '#bfe2ff' };

/** materiale della cupola del cielo (anche per la mappa d'ambiente) */
export function skyMaterial(sunDir, colors = SKY_COLORS, streaks = true) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(colors.top) }, mid: { value: new THREE.Color(colors.mid) }, bottom: { value: new THREE.Color(colors.bottom) },
      warm: { value: new THREE.Color('#ffe2b8') }, sunDir: { value: sunDir.clone().normalize() }, uTime: { value: 0 },
      uStreak: { value: streaks ? 1 : 0 },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 warm; uniform vec3 sunDir; uniform float uTime; uniform float uStreak; varying vec3 vP;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main(){
        vec3 d = normalize(vP);
        float h = clamp(d.y * 1.25 + 0.06, 0.0, 1.0);
        vec3 col = mix(bottom, mid, smoothstep(0.0, 0.42, h));
        col = mix(col, top, smoothstep(0.36, 1.0, h));
        if (uStreak > 0.5) {
          // striature orizzontali: rumore molto allungato lungo l'orizzonte, a righe come nei cieli disegnati a pixel
          float az = atan(d.z, d.x);
          float row = floor(d.y * 150.0);
          float n1 = vnoise(vec2(az * 7.0 + uTime * 0.004, row * 0.21));
          float n2 = vnoise(vec2(az * 15.0 - uTime * 0.003 + 17.0, row * 0.43 + 5.0));
          float band = smoothstep(0.0, 0.25, d.y) * (1.0 - smoothstep(0.55, 0.9, d.y));
          col = mix(col, mix(col, bottom, 0.55), smoothstep(0.62, 0.86, n1) * band * 0.75);   // righe chiare
          col *= 1.0 - smoothstep(0.7, 0.92, n2) * band * 0.08;                              // righe un po' più scure
        }
        float s = max(dot(d, sunDir), 0.0);
        col = mix(col, warm, pow(s, 6.0) * 0.3 * (1.0 - h * 0.5));
        col += vec3(1.0, 0.92, 0.75) * (pow(s, 900.0) * 3.0 + pow(s, 60.0) * 0.22);
        col = mix(col, bottom * 1.02, smoothstep(0.06, -0.05, d.y));
        // leggera posterizzazione: le sfumature diventano fasce, come in pixel art
        if (uStreak > 0.5) col = floor(col * 40.0 + 0.5) / 40.0;
        gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
}

// ── nuvole ──
let cloudMat = null;
/** materiale a tre toni (bianco / celeste / azzurro), con i riccioli più scuri (attributo aLine) */
export function cloudMaterial() {
  if (cloudMat) return cloudMat;
  cloudMat = new THREE.ShaderMaterial({
    fog: false,
    uniforms: { lightDir: { value: new THREE.Vector3(-0.35, 0.85, 0.4).normalize() }, uFade: { value: 1 } },
    vertexShader: `attribute float aLine; varying vec3 vN; varying float vLine; varying float vY;
      void main(){ vN = normalize(mat3(modelMatrix) * normal); vLine = aLine; vY = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 lightDir; varying vec3 vN; varying float vLine; varying float vY;
      void main(){
        float l = dot(normalize(vN), lightDir) * 0.5 + 0.5 + vY * 0.012;
        vec3 c = l > 0.62 ? vec3(1.0) : (l > 0.4 ? vec3(0.86, 0.94, 1.0) : vec3(0.62, 0.78, 0.97));
        c = mix(c, vec3(0.5, 0.7, 0.95), vLine);
        gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  return cloudMat;
}

/** unisce geometrie non indicizzate (position, normal, aLine) */
function mergeCloud(parts) {
  let n = 0;
  const geos = parts.map(([g, line]) => { const q = g.index ? g.toNonIndexed() : g; n += q.attributes.position.count; return [q, line]; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), ln = new Float32Array(n);
  let o = 0;
  for (const [g, line] of geos) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); ln.fill(line, o, o + c);
    o += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('aLine', new THREE.BufferAttribute(ln, 1));
  out.computeBoundingSphere();
  return out;
}

/** ricciolo a spirale disegnato sulla superficie davanti (+z) di uno sbuffo di centro c e raggio R */
function curlGeo(c, R, dir, turns = 1.6) {
  const pts = [];
  const N = 40, a0 = Math.random() * 6.28;
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = a0 + dir * t * turns * Math.PI * 2, r = R * (0.12 + 0.6 * t);
    const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.9;
    const z = Math.sqrt(Math.max(0.0001, R * R - x * x - y * y));
    pts.push(new THREE.Vector3(c.x + x, c.y + y, c.z + z * 1.01));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, R * 0.045, 5, false);
}

/**
 * Una nuvola: fila di sbuffi alla base (fondo piatto), sbuffi più grandi sopra, una scia sottile sotto
 * e i riccioli sugli sbuffi principali. size ≈ larghezza in metri.
 */
export function buildCloudGeometry(rnd = Math.random, size = 60) {
  const parts = [];
  const S = size / 60;
  const nb = 3 + Math.floor(rnd() * 3);
  const w = (nb - 1) * 9 * S;
  const sph = (x, y, z, r, sy = 0.85, seg = 14) => {
    const g = new THREE.SphereGeometry(r, seg, Math.max(8, seg - 4));
    g.scale(1, sy, 0.8); g.translate(x, y, z);
    parts.push([g, 0]);
  };
  // base: sbuffi medi con il fondo allineato
  for (let i = 0; i < nb; i++) {
    const r = (6.5 + rnd() * 3) * S;
    sph(-w / 2 + i * 9 * S + (rnd() - 0.5) * 3 * S, r * 0.55, (rnd() - 0.5) * 4 * S, r, 0.75);
  }
  // sopra: 1–3 sbuffi grandi con i riccioli
  const nt = 1 + Math.floor(rnd() * Math.min(3, nb - 1));
  for (let i = 0; i < nt; i++) {
    const r = (9 + rnd() * 4) * S;
    const x = -w * 0.32 + (nt > 1 ? i * (w * 0.64) / (nt - 1) : w * 0.32) + (rnd() - 0.5) * 4 * S;
    const y = r * 0.85 + 2 * S;
    sph(x, y, 0, r, 0.88, 16);
    const c = new THREE.Vector3(x, y, 0);
    parts.push([curlGeo(c, r * 0.8, rnd() < 0.5 ? 1 : -1), 1]);
  }
  // riccioli piccoli sugli sbuffi laterali
  if (rnd() < 0.7) parts.push([curlGeo(new THREE.Vector3(-w / 2, 4.5 * S, 0), 5 * S, -1, 1.2), 1]);
  if (rnd() < 0.7) parts.push([curlGeo(new THREE.Vector3(w / 2, 4.5 * S, 0), 5 * S, 1, 1.2), 1]);
  // scia sottile che sporge sotto la nuvola
  {
    const g = new THREE.SphereGeometry(1, 16, 6);
    g.scale(w / 2 + 16 * S, 1.3 * S, 5 * S); g.translate((rnd() - 0.5) * 8 * S, 0.6 * S, 0);
    parts.push([g, 0]);
  }
  return mergeCloud(parts);
}

/** gira le nuvole verso la camera (solo attorno all'asse verticale) */
export function faceClouds(list, cam) {
  for (const c of list) c.rotation.y = Math.atan2(cam.position.x - c.position.x, cam.position.z - c.position.z);
}
