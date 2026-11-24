// ─────────────────────────────────────────────────────────────
//  Atmosfera e meteo: nebbia d'altezza, prospettiva aerea, catene montuose
//  all'orizzonte e particelle locali (neve, foglie d'autunno, polvere del deserto)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

// ── nebbia d'altezza (patch globale dei chunk di three.js: vale per tutti i materiali) ──
// valli e acqua restano velate, le cime alte emergono nitide dalla foschia → profondità
export const FOG_HEIGHT = { base: 0.0, falloff: 15.0, density: 1.35 };
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n\tvarying float vFogDepth;\n\tvarying float vFogWorldY;\n#endif';
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n\tvFogDepth = - mvPosition.z;\n\tvFogWorldY = cameraPosition.y + ( transpose( mat3( viewMatrix ) ) * mvPosition.xyz ).y;\n#endif';
THREE.ShaderChunk.fog_pars_fragment = '#ifdef USE_FOG\n\tuniform vec3 fogColor;\n\tvarying float vFogDepth;\n\tvarying float vFogWorldY;\n\t#ifdef FOG_EXP2\n\t\tuniform float fogDensity;\n\t#else\n\t\tuniform float fogNear;\n\t\tuniform float fogFar;\n\t#endif\n#endif';
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
		{
			float fy = vFogWorldY;
			// foschia densa in basso che si dirada con l'altitudine
			float hk = exp( - max( fy - ${FOG_HEIGHT.base.toFixed(1)}, 0.0 ) / ${FOG_HEIGHT.falloff.toFixed(1)} );
			float hf = 1.0 - exp( - ( vFogDepth / fogFar ) * ${FOG_HEIGHT.density.toFixed(2)} * hk );
			// le parti alte e lontane (cime) restano più leggibili
			fogFactor *= mix( 1.0, 0.62, smoothstep( 24.0, 95.0, fy ) );
			fogFactor = max( fogFactor, hf * 0.8 );
		}
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;

// ── catene montuose lontane (anelli di picchi low-poly oltre il mare) ──
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function mountainRing(radius, segs, hMin, hMax, colBase, colTop, seed, snow) {
  const rnd = mulberry32(seed);
  const pos = [], col = [];
  const cB = new THREE.Color(colBase), cT = new THREE.Color(colTop), cS = new THREE.Color('#eef3f8'), c = new THREE.Color();
  // profilo: somma di onde + picchi casuali
  const H = [];
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6];
  for (let i = 0; i < segs; i++) {
    const a = i / segs * Math.PI * 2;
    // profilo continuo (somma di onde): catene con valli e cime, niente "palizzata"
    let h = 0.45 + 0.28 * Math.sin(a * 3 + ph[0]) + 0.17 * Math.sin(a * 8 + ph[1]) + 0.1 * Math.sin(a * 19 + ph[2]) + 0.05 * Math.sin(a * 41 + ph[0] * 2);
    h *= 0.93 + rnd() * 0.14;
    H.push(hMin + (hMax - hMin) * Math.max(0.03, Math.min(1.15, h)));
  }
  const push = (x, y, z, cc) => { pos.push(x, y, z); col.push(cc.r, cc.g, cc.b); };
  for (let i = 0; i < segs; i++) {
    const a0 = i / segs * Math.PI * 2, a1 = (i + 1) / segs * Math.PI * 2, am = (a0 + a1) / 2;
    const r0 = radius * (1 + (rnd() - 0.5) * 0.06), rm = radius * (1 + (rnd() - 0.5) * 0.08);
    const x0 = Math.cos(a0) * r0, z0 = Math.sin(a0) * r0, x1 = Math.cos(a1) * r0, z1 = Math.sin(a1) * r0;
    const xm = Math.cos(am) * rm, zm = Math.sin(am) * rm;
    const h0 = H[i], h1 = H[(i + 1) % segs], hm = (h0 + h1) / 2 * (1 + rnd() * 0.16);
    // due triangoli: base → picco intermedio → creste ai lati
    const top = c.copy(cB).lerp(cT, 0.85);
    const tm = snow && hm > hMax * 0.72 ? cS : top;
    push(x0, -20, z0, cB); push(xm, hm, zm, tm); push(x0, h0, z0, top);
    push(x0, -20, z0, cB); push(x1, -20, z1, cB); push(xm, hm, zm, tm);
    push(x1, -20, z1, cB); push(x1, h1, z1, top); push(xm, hm, zm, tm);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// ── particelle meteo: posizioni calcolate nella GPU (nessun costo per la CPU) ──
const PART_VS = `
  attribute float aRnd;
  uniform float uTime, uIntensity, uSize, uFall, uSway, uScale;
  uniform vec3 uBox, uCam, uWind;
  varying float vA; varying float vRnd;
  void main() {
    vec3 p = position;
    float t = uTime * (0.75 + 0.5 * aRnd);
    vec3 off = vec3(uWind.x * t, -uFall * t, uWind.z * t) + vec3(sin(t * 1.3 + aRnd * 40.0), 0.0, cos(t * 1.1 + aRnd * 23.0)) * uSway;
    // coordinate ancorate al mondo, avvolte in una scatola attorno alla camera
    vec3 w = uCam + (fract((p * uBox + off - uCam) / uBox) - 0.5) * uBox;
    vec4 mv = viewMatrix * vec4(w, 1.0);
    gl_Position = projectionMatrix * mv;
    vec3 d = abs(w - uCam) / (uBox * 0.5);
    vA = (aRnd < uIntensity ? 1.0 : 0.0) * (1.0 - smoothstep(0.7, 1.0, max(d.x, max(d.y, d.z))));
    vRnd = aRnd;
    gl_PointSize = uSize * (0.7 + 0.6 * fract(aRnd * 7.31)) * uScale / max(0.5, -mv.z);
  }`;
const PART_FS = `
  uniform vec3 uColor; uniform vec3 uColor2; uniform float uShape; uniform float uOpacity;
  varying float vA; varying float vRnd;
  void main() {
    if (vA < 0.01) discard;
    vec2 q = gl_PointCoord - 0.5;
    float a;
    if (uShape > 0.5) {
      // foglia: rombo ruotato
      float r = vRnd * 40.0; vec2 s = mat2(cos(r), -sin(r), sin(r), cos(r)) * q;
      a = 1.0 - smoothstep(0.32, 0.4, abs(s.x) * 1.7 + abs(s.y));
    } else a = 1.0 - smoothstep(0.25, 0.5, length(q));
    if (a < 0.02) discard;
    vec3 c = mix(uColor, uColor2, fract(vRnd * 13.7));
    gl_FragColor = vec4(c, a * vA * uOpacity);
    #include <colorspace_fragment>
  }`;

function makeParticles(N, opts) {
  const g = new THREE.BufferGeometry();
  const P = new Float32Array(N * 3), R = new Float32Array(N);
  for (let i = 0; i < N; i++) { P[i * 3] = Math.random(); P[i * 3 + 1] = Math.random(); P[i * 3 + 2] = Math.random(); R[i] = Math.random(); }
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('aRnd', new THREE.BufferAttribute(R, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: {
      uTime: { value: 0 }, uIntensity: { value: 0 }, uSize: { value: opts.size }, uFall: { value: opts.fall }, uSway: { value: opts.sway },
      uScale: { value: 500 }, uBox: { value: new THREE.Vector3(...opts.box) }, uCam: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector3(...opts.wind) },
      uColor: { value: new THREE.Color(opts.color) }, uColor2: { value: new THREE.Color(opts.color2 || opts.color) }, uShape: { value: opts.shape || 0 }, uOpacity: { value: opts.opacity ?? 0.9 },
    },
    vertexShader: PART_VS, fragmentShader: PART_FS,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 5;
  pts.userData.level = 0;
  return pts;
}

/**
 * Crea il sistema meteo.
 * opts.biomeAt(x,z) → pesi [prateria, neve, deserto, autunno, tropicale]
 */
export function createWeather(scene, opts) {
  const group = new THREE.Group();
  scene.add(group);
  // orizzonte: due anelli di montagne (vicino più scuro, lontano più pallido) → senso di profondità
  const ringMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const far = new THREE.Mesh(mountainRing(1420, 160, 50, 230, '#a9c4dc', '#bcd3e8', 77, true), ringMat);
  const near = new THREE.Mesh(mountainRing(1180, 140, 20, 105, '#8fae9e', '#a4bfc4', 33, false), ringMat);
  far.renderOrder = near.renderOrder = -0.5;
  far.frustumCulled = near.frustumCulled = false;
  group.add(far, near);

  const snow = makeParticles(5000, { size: 0.09, fall: 2.2, sway: 0.6, box: [70, 40, 70], wind: [0.8, 0, 0.4], color: '#ffffff', color2: '#e6eefa', opacity: 0.95 });
  const leaves = makeParticles(900, { size: 0.16, fall: 1.1, sway: 1.4, box: [60, 30, 60], wind: [1.2, 0, 0.6], color: '#d9822b', color2: '#e8b836', shape: 1, opacity: 1 });
  const dust = makeParticles(2200, { size: 0.07, fall: -0.15, sway: 0.5, box: [70, 25, 70], wind: [6, 0, 2.5], color: '#e8cf9a', color2: '#c9a46a', opacity: 0.55 });
  scene.add(snow, leaves, dust);
  const systems = { snow, leaves, dust };
  const W = {
    blizzard: 0,     // evento "bufera di neve" (0..1)
    fogMul: 1,       // moltiplicatore delle distanze della nebbia (eventi)
    density: 1,      // qualità (impostazioni)
    fogTint: new THREE.Color('#c9e3f8'),
    local: { snow: 0, leaves: 0, dust: 0 },
  };
  const baseFog = new THREE.Color('#c9e3f8'), snowFog = new THREE.Color('#e3ecf5'), dustFog = new THREE.Color('#e8dcc0'), _c = new THREE.Color();

  W.update = (dt, time, camera, renderer, active) => {
    const cp = camera.position;
    const bw = opts.biomeAt(cp.x, cp.z);
    const ground = opts.terrainHeight(cp.x, cp.z);
    const alt = cp.y - ground;
    // nevica solo nelle zone innevate e in alta quota (o ovunque durante la bufera)
    const highSnow = Math.min(1, Math.max(0, (ground - 48) / 15));
    const tSnow = active ? Math.min(1, Math.max(bw[1] * 1.4 - 0.25, highSnow, W.blizzard)) * (alt < 90 ? 1 : 0.3) : 0;
    const tLeaves = active ? Math.max(0, bw[3] * 1.3 - 0.3) * (alt < 40 ? 1 : 0) : 0;
    const tDust = active ? Math.max(0, bw[2] * 1.3 - 0.35) * (alt < 60 ? 1 : 0) : 0;
    const k = Math.min(1, dt * 0.8);
    W.local.snow += (tSnow - W.local.snow) * k;
    W.local.leaves += (tLeaves - W.local.leaves) * k;
    W.local.dust += (tDust - W.local.dust) * k;
    const scale = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    for (const [key, s] of Object.entries(systems)) {
      const lvl = W.local[key] * W.density * (key === 'snow' ? 1 + W.blizzard * 0 : 1);
      s.visible = lvl > 0.02;
      if (!s.visible) continue;
      const u = s.material.uniforms;
      u.uTime.value = time; u.uIntensity.value = Math.min(1, lvl); u.uScale.value = scale;
      u.uCam.value.copy(cp);
      if (key === 'snow') { u.uFall.value = 2.2 + W.blizzard * 3; u.uWind.value.set(0.8 + W.blizzard * 9, 0, 0.4 + W.blizzard * 4); }
    }
    // colore della nebbia: più bianca nella neve, più calda nel deserto
    const sk = Math.max(W.local.snow * 0.7, W.blizzard), dk = W.local.dust * 0.6;
    W.fogTint.copy(baseFog).lerp(snowFog, sk).lerp(dustFog, dk);
    // anelli all'orizzonte sempre centrati sull'isola (parallasse vera)
    group.visible = active;
  };
  W.hide = () => { for (const s of Object.values(systems)) s.visible = false; for (const k in W.local) W.local[k] = 0; };
  W.setQuality = (q) => {
    W.density = q;
    snow.geometry.setDrawRange(0, Math.round(5000 * Math.min(1, q)));
  };
  W.dispose = () => {
    for (const o of [far, near, snow, leaves, dust]) { o.geometry.dispose(); o.material.dispose?.(); o.parent && o.parent.remove(o); }
    scene.remove(group);
  };
  return W;
}
