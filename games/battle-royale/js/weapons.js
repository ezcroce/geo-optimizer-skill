// ─────────────────────────────────────────────────────────────
//  Armi 3D: profili estrusi e smussati, canne cilindriche, finiture
//  procedurali diverse per ogni rarità e icone renderizzate dai modelli
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WEAPONS, RARITIES } from './config.js?v=13';
import { canvas2d, normalFromHeight, colorTex, NORMALS } from './texgen.js?v=13';

/** quante volte la texture si ripete in un metro di superficie */
const UVK = 5;

function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ───────────── geometrie ─────────────
function finish(g) {
  if (g.index) g = g.toNonIndexed();
  g.clearGroups();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  return g;
}
function scaleUV(g, su, sv = su) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
}
function area(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
/**
 * Profilo laterale estruso: punti [z (avanti), y (su)], spessore lungo x, bordi smussati.
 * È il pezzo base di quasi tutte le armi: dà sagome riconoscibili invece di semplici scatole.
 */
function prof(pts, thick, { x = 0, bevel = 0.005, holes = null } = {}) {
  if (area(pts) < 0) pts = pts.slice().reverse();                    // contorno antiorario
  const sh = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  if (holes) for (let h of holes) { if (area(h) > 0) h = h.slice().reverse(); sh.holes.push(new THREE.Path(h.map(([z, y]) => new THREE.Vector2(z, y)))); }
  const b = Math.min(bevel, thick * 0.3);
  const depth = Math.max(0.001, thick - 2 * b);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * 0.8, bevelOffset: -b * 0.8, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);                 // x del profilo → avanti (+z), estrusione → x
  g.translate(x, 0, 0);
  scaleUV(g, UVK);
  return finish(g);
}
/** cilindro (o tronco di cono) lungo z: r1 in z0, r2 in z1 */
function cyl(r1, r2, z0, z1, { x = 0, y = 0, seg = 12 } = {}) {
  const len = z1 - z0;
  const g = new THREE.CylinderGeometry(r2, r1, len, seg, 1);
  scaleUV(g, Math.PI * (r1 + r2) * UVK, len * UVK);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, (z0 + z1) / 2);
  return finish(g);
}
/** cilindro verticale (asse y) o laterale (asse x) */
function cylY(r, h, x, y, z, seg = 10) { const g = new THREE.CylinderGeometry(r, r, h, seg); scaleUV(g, Math.PI * 2 * r * UVK, h * UVK); g.translate(x, y, z); return finish(g); }
function cylX(r, h, x, y, z, seg = 10) { const g = new THREE.CylinderGeometry(r, r, h, seg); scaleUV(g, Math.PI * 2 * r * UVK, h * UVK); g.rotateZ(Math.PI / 2); g.translate(x, y, z); return finish(g); }
function bx(w, h, d, x, y, z, { rx = 0, ry = 0, rz = 0 } = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    uv.setXY(i, uv.getX(i) * (ax > 0.5 ? d : w) * UVK, uv.getY(i) * (ay > 0.5 ? d : h) * UVK);
  }
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return finish(g);
}
function sph(r, x, y, z) { const g = new THREE.SphereGeometry(r, 8, 6); g.translate(x, y, z); return finish(g); }
/** guardia del grilletto: anello estruso con il foro */
function guard(z0, z1, yTop, yBot, thick = 0.024) {
  const w = 0.011;
  return prof([[z0, yTop], [z1, yTop], [z1 - 0.008, yBot + 0.012], [z1 - 0.03, yBot], [z0 + 0.004, yBot]], thick, {
    bevel: 0.003,
    holes: [[[z0 + w, yTop - w], [z1 - w, yTop - w], [z1 - w - 0.008, yBot + w + 0.008], [z1 - 0.032, yBot + w], [z0 + w + 0.003, yBot + w]]],
  });
}

// ───────────── i modelli ─────────────
//  Canna verso +Z, impugnatura vicino all'origine (dove la mano tiene l'arma).
//  Materiali: m metallo, b finitura della rarità, p polimero zigrinato, r inserti luminosi
//  della rarità, w legno, k nero opaco, g vetro, dot punto rosso, s ottone, sh cartuccia,
//  wh testata del razzo, y giallo di pericolo
const MODELS = {
  pistol(P) {
    P('m', prof([[-0.075, 0.0], [0.262, 0.0], [0.272, 0.012], [0.272, 0.05], [0.255, 0.068], [-0.055, 0.068], [-0.075, 0.052]], 0.068));      // carrello
    P('b', prof([[-0.07, 0.004], [0.255, 0.004], [0.255, -0.032], [0.1, -0.036], [0.045, -0.048], [0.028, -0.2], [-0.064, -0.212], [-0.088, -0.196], [-0.074, -0.06], [-0.084, -0.03]], 0.062));   // fusto e impugnatura
    P('p', prof([[-0.062, -0.055], [0.03, -0.055], [0.018, -0.19], [-0.06, -0.2], [-0.078, -0.186], [-0.066, -0.07]], 0.068, { bevel: 0.004 }));   // guancette zigrinate
    P('b', guard(0.03, 0.13, -0.03, -0.1));
    P('k', bx(0.012, 0.04, 0.014, 0, -0.058, 0.07, { rx: 0.25 }));                                  // grilletto
    for (let i = 0; i < 6; i++) P('k', bx(0.071, 0.042, 0.006, 0, 0.034, -0.052 + i * 0.012));      // zigrinatura del carrello
    P('k', bx(0.071, 0.02, 0.055, 0, 0.044, 0.125));                                                // finestra di espulsione
    P('k', bx(0.05, 0.016, 0.014, 0, 0.075, -0.045));                                               // tacca di mira
    P('k', bx(0.012, 0.016, 0.012, 0, 0.075, 0.25));                                                // mirino
    P('r', bx(0.006, 0.006, 0.004, 0, 0.079, 0.257));
    P('r', bx(0.054, 0.006, 0.004, 0, 0.079, -0.053));
    P('k', cyl(0.017, 0.017, 0.262, 0.276, { y: 0.036 }));                                          // volata
    P('r', bx(0.066, 0.008, 0.22, 0, 0.004, 0.13));                                                 // filo luminoso fra fusto e carrello
    P('r', prof([[-0.068, -0.2], [0.03, -0.19], [0.028, -0.212], [-0.07, -0.226]], 0.066, { bevel: 0.003 }));   // fondello del caricatore
    P('k', bx(0.04, 0.01, 0.1, 0, -0.037, 0.195));                                                  // slitta per accessori
  },
  smg(P) {
    P('b', prof([[-0.13, 0.055], [0.3, 0.055], [0.315, 0.035], [0.315, -0.03], [0.18, -0.045], [0.1, -0.05], [-0.1, -0.05], [-0.13, -0.02]], 0.08));
    P('r', prof([[-0.08, 0.026], [0.27, 0.026], [0.27, 0.004], [-0.08, 0.004]], 0.084, { bevel: 0.002 }));
    P('m', bx(0.04, 0.018, 0.34, 0, 0.064, 0.08));                                                  // slitta superiore
    for (let i = 0; i < 11; i++) P('k', bx(0.046, 0.008, 0.012, 0, 0.077, -0.07 + i * 0.03));
    P('k', cyl(0.032, 0.032, 0.315, 0.555, { y: 0.012, seg: 14 }));                                // silenziatore
    P('m', cyl(0.035, 0.035, 0.33, 0.346, { y: 0.012, seg: 14 }));
    P('m', cyl(0.034, 0.028, 0.545, 0.566, { y: 0.012, seg: 14 }));
    P('m', prof([[0.165, -0.04], [0.235, -0.04], [0.258, -0.25], [0.19, -0.255]], 0.054));         // caricatore
    P('r', prof([[0.186, -0.246], [0.262, -0.24], [0.265, -0.266], [0.184, -0.272]], 0.062, { bevel: 0.003 }));
    P('p', prof([[-0.05, -0.04], [0.035, -0.04], [0.01, -0.2], [-0.075, -0.205], [-0.086, -0.188]], 0.06));   // impugnatura
    P('b', guard(0.03, 0.135, -0.042, -0.1));
    P('k', bx(0.012, 0.035, 0.012, 0, -0.065, 0.068, { rx: 0.25 }));
    P('k', bx(0.084, 0.016, 0.05, 0, 0.042, 0.14));                                                 // finestra di espulsione
    P('m', bx(0.012, 0.012, 0.05, 0.046, 0.036, 0.24));                                             // leva di armamento
    for (const x of [-0.028, 0.028]) P('m', cyl(0.007, 0.007, -0.34, -0.12, { x, y: 0.028, seg: 6 }));   // calcio a filo
    P('m', cyl(0.007, 0.007, -0.34, -0.12, { y: -0.06, seg: 6 }));
    P('p', prof([[-0.36, 0.05], [-0.33, 0.05], [-0.33, -0.1], [-0.36, -0.11]], 0.07));             // calciolo
    P('k', bx(0.05, 0.014, 0.1, 0, 0.08, 0.02));                                                    // mirino olografico
    for (const x of [-0.022, 0.022]) P('k', bx(0.008, 0.045, 0.07, x, 0.108, 0.02));
    P('k', bx(0.052, 0.008, 0.07, 0, 0.134, 0.02));
    P('g', bx(0.036, 0.037, 0.004, 0, 0.108, 0.04));
    P('dot', bx(0.006, 0.006, 0.002, 0, 0.11, 0.043));
  },
  ar(P) {
    P('b', prof([[-0.16, 0.0], [0.3, 0.0], [0.3, 0.068], [-0.13, 0.068], [-0.16, 0.05]], 0.072));                   // castello superiore
    P('b', prof([[-0.14, 0.004], [0.14, 0.004], [0.15, -0.04], [0.16, -0.075], [0.07, -0.075], [0.05, -0.05], [-0.07, -0.045], [-0.13, -0.03]], 0.066));   // castello inferiore e pozzetto
    P('b', prof([[0.29, 0.068], [0.66, 0.064], [0.672, 0.05], [0.672, -0.03], [0.655, -0.044], [0.3, -0.046], [0.29, -0.03]], 0.074, { bevel: 0.008 }));   // paramano
    for (let i = 0; i < 4; i++) P('k', bx(0.078, 0.014, 0.05, 0, 0.004, 0.36 + i * 0.075));        // feritoie M-LOK
    P('r', prof([[0.31, 0.046], [0.64, 0.043], [0.64, 0.032], [0.31, 0.035]], 0.078, { bevel: 0.002 }));
    P('m', bx(0.036, 0.016, 0.74, 0, 0.077, 0.25));                                                 // slitta superiore
    for (let i = 0; i < 23; i++) P('k', bx(0.042, 0.008, 0.012, 0, 0.088, -0.1 + i * 0.032));
    P('m', cyl(0.016, 0.016, 0.67, 0.865, { y: 0.018 }));                                           // canna
    P('m', bx(0.03, 0.036, 0.03, 0, 0.03, 0.705));                                                  // blocco del gas
    P('k', bx(0.012, 0.05, 0.016, 0, 0.07, 0.69));                                                  // mirino abbattibile
    P('k', cyl(0.026, 0.024, 0.86, 0.955, { y: 0.018, seg: 8 }));                                   // freno di bocca
    for (const z of [0.885, 0.915]) P('m', bx(0.056, 0.008, 0.016, 0, 0.018, z));
    P('m', prof([[0.06, -0.03], [0.145, -0.03], [0.16, -0.1], [0.2, -0.2], [0.207, -0.235], [0.13, -0.262], [0.1, -0.17], [0.07, -0.1]], 0.056));   // caricatore curvo
    P('k', prof([[0.09, -0.12], [0.165, -0.12], [0.172, -0.135], [0.095, -0.135]], 0.06, { bevel: 0.002 }));
    P('r', prof([[0.125, -0.256], [0.205, -0.23], [0.215, -0.252], [0.133, -0.282]], 0.064, { bevel: 0.003 }));
    P('p', prof([[-0.075, -0.035], [0.0, -0.035], [-0.025, -0.2], [-0.1, -0.205], [-0.112, -0.188]], 0.06));        // impugnatura
    P('k', bx(0.026, 0.009, 0.1, 0, -0.075, 0.015));                                                // guardia
    P('k', bx(0.012, 0.035, 0.012, 0, -0.058, 0.03, { rx: 0.25 }));
    P('k', bx(0.074, 0.022, 0.07, 0, 0.04, 0.08));                                                  // finestra di espulsione
    P('r', bx(0.02, 0.012, 0.03, 0, 0.074, -0.15));                                                 // leva di armamento
    P('m', cyl(0.022, 0.022, -0.36, -0.15, { y: 0.03 }));                                           // tubo del calcio
    P('b', prof([[-0.25, 0.06], [-0.45, 0.065], [-0.47, 0.05], [-0.47, -0.11], [-0.43, -0.12], [-0.32, -0.045], [-0.25, -0.005]], 0.064, {
      holes: [[[-0.33, 0.036], [-0.43, 0.04], [-0.43, -0.075], [-0.37, -0.03]]],
    }));
    P('k', prof([[-0.468, 0.068], [-0.49, 0.068], [-0.49, -0.122], [-0.468, -0.122]], 0.07, { bevel: 0.006 }));   // calciolo in gomma
    P('k', bx(0.03, 0.03, 0.08, 0, 0.095, 0.14));                                                   // red dot
    P('k', cyl(0.025, 0.025, 0.08, 0.2, { y: 0.122, seg: 12 }));
    P('g', cyl(0.021, 0.021, 0.2, 0.204, { y: 0.122, seg: 12 }));
    P('g', cyl(0.021, 0.021, 0.076, 0.08, { y: 0.122, seg: 12 }));
    P('dot', bx(0.005, 0.005, 0.002, 0, 0.122, 0.074));
  },
  shotgun(P) {
    P('m', prof([[-0.11, 0.035], [-0.07, 0.062], [0.2, 0.062], [0.2, -0.055], [-0.11, -0.055]], 0.072));            // carcassa
    P('r', prof([[0.0, 0.036], [0.16, 0.036], [0.16, 0.0], [0.0, 0.0]], 0.076, { bevel: 0.003 }));  // piastra incisa
    P('m', cyl(0.026, 0.026, 0.2, 0.87, { y: 0.03, seg: 14 }));                                     // canna
    P('k', bx(0.016, 0.008, 0.64, 0, 0.06, 0.53));                                                  // bindella
    P('s', sph(0.009, 0, 0.068, 0.858));                                                            // mirino a perla
    P('m', cyl(0.022, 0.022, 0.2, 0.8, { y: -0.025, seg: 12 }));                                    // serbatoio tubolare
    P('k', cyl(0.024, 0.024, 0.8, 0.822, { y: -0.025, seg: 12 }));
    P('w', prof([[0.4, 0.0], [0.66, 0.0], [0.675, -0.02], [0.665, -0.066], [0.41, -0.066], [0.395, -0.04]], 0.088, { bevel: 0.01 }));   // pompa
    for (let i = 0; i < 6; i++) P('k', bx(0.091, 0.008, 0.012, 0, -0.033, 0.43 + i * 0.04));
    P('w', prof([[-0.1, 0.04], [-0.1, -0.055], [-0.16, -0.09], [-0.47, -0.155], [-0.49, -0.15], [-0.49, 0.035], [-0.46, 0.05], [-0.2, 0.03]], 0.07, { bevel: 0.008 }));   // calcio
    P('k', prof([[-0.488, 0.036], [-0.51, 0.036], [-0.51, -0.152], [-0.488, -0.152]], 0.074, { bevel: 0.006 }));
    P('k', guard(-0.04, 0.1, -0.05, -0.11));
    P('m', bx(0.012, 0.035, 0.012, 0, -0.07, 0.03, { rx: 0.25 }));
    P('k', bx(0.012, 0.055, 0.14, -0.04, -0.005, 0.06));                                            // porta cartucce
    for (let i = 0; i < 4; i++) {
      P('sh', cylY(0.011, 0.05, -0.052, 0.0, 0.012 + i * 0.033, 8));
      P('s', cylY(0.0115, 0.014, -0.052, -0.03, 0.012 + i * 0.033, 8));
    }
  },
  sniper(P) {
    P('b', prof([[-0.5, 0.05], [-0.5, -0.14], [-0.44, -0.16], [-0.2, -0.07], [-0.12, -0.16], [-0.04, -0.16], [0.02, -0.05], [0.46, -0.04], [0.48, 0.0], [0.1, 0.012], [-0.06, 0.012], [-0.2, 0.055], [-0.42, 0.062]], 0.07, {
      bevel: 0.007, holes: [[[-0.17, -0.03], [-0.06, -0.025], [-0.075, -0.1], [-0.12, -0.12], [-0.15, -0.07]]],
    }));   // calcio con foro per il pollice
    P('r', prof([[-0.42, 0.058], [-0.22, 0.054], [-0.24, 0.084], [-0.4, 0.09]], 0.06));            // poggiaguancia
    P('k', prof([[-0.5, 0.05], [-0.52, 0.05], [-0.52, -0.14], [-0.5, -0.14]], 0.072, { bevel: 0.006 }));
    P('m', cyl(0.033, 0.033, -0.12, 0.2, { y: 0.03, seg: 12 }));                                    // otturatore
    P('m', cyl(0.026, 0.018, 0.2, 1.08, { y: 0.03, seg: 12 }));                                     // canna rastremata
    P('k', cyl(0.03, 0.03, 1.08, 1.17, { y: 0.03, seg: 8 }));                                       // freno di bocca
    for (const z of [1.105, 1.14]) P('m', bx(0.064, 0.01, 0.016, 0, 0.03, z));
    P('m', bx(0.08, 0.012, 0.012, 0.07, 0.03, -0.04));                                              // leva dell'otturatore
    P('k', sph(0.018, 0.112, 0.03, -0.04));
    P('m', prof([[0.02, -0.04], [0.12, -0.04], [0.115, -0.1], [0.025, -0.1]], 0.05));               // caricatore
    P('k', guard(-0.04, 0.03, -0.035, -0.09, 0.022));
    P('m', bx(0.012, 0.03, 0.012, 0, -0.055, -0.005, { rx: 0.25 }));
    for (const z of [-0.01, 0.21]) { P('m', cyl(0.036, 0.036, z - 0.012, z + 0.012, { y: 0.115 })); P('m', bx(0.03, 0.05, 0.024, 0, 0.075, z)); }   // anelli
    P('k', cyl(0.028, 0.028, -0.08, 0.3, { y: 0.115, seg: 14 }));                                   // cannocchiale
    P('k', cyl(0.03, 0.048, 0.3, 0.36, { y: 0.115, seg: 14 }));
    P('k', cyl(0.048, 0.048, 0.36, 0.42, { y: 0.115, seg: 14 }));
    P('g', cyl(0.042, 0.042, 0.42, 0.425, { y: 0.115, seg: 14 }));
    P('k', cyl(0.038, 0.028, -0.16, -0.08, { y: 0.115, seg: 14 }));
    P('g', cyl(0.034, 0.034, -0.165, -0.16, { y: 0.115, seg: 14 }));
    P('r', cyl(0.0295, 0.0295, 0.25, 0.27, { y: 0.115, seg: 14 }));
    P('m', cylY(0.017, 0.03, 0, 0.155, 0.11));                                                     // torrette
    P('m', cylX(0.017, 0.03, 0.042, 0.115, 0.11));
    for (const x of [-0.025, 0.025]) P('k', cyl(0.007, 0.007, 0.3, 0.6, { x, y: -0.055, seg: 6 })); // bipiede ripiegato
    P('k', bx(0.07, 0.02, 0.03, 0, -0.05, 0.6));
  },
  rocket(P) {
    P('b', cyl(0.105, 0.105, -0.38, 0.76, { y: 0.06, seg: 18 }));                                   // tubo
    P('r', cyl(0.105, 0.126, 0.74, 0.82, { y: 0.06, seg: 18 }));                                    // bocca svasata
    P('k', cyl(0.112, 0.112, 0.818, 0.822, { y: 0.06, seg: 18 }));
    P('m', cyl(0.13, 0.105, -0.46, -0.36, { y: 0.06, seg: 18 }));                                   // venturi posteriore
    P('k', cyl(0.118, 0.118, -0.464, -0.458, { y: 0.06, seg: 18 }));
    P('wh', cyl(0.07, 0.07, 0.8, 0.9, { y: 0.06, seg: 12 }));                                       // testata del razzo
    P('wh', cyl(0.07, 0.006, 0.9, 1.0, { y: 0.06, seg: 12 }));
    P('y', cyl(0.072, 0.072, 0.84, 0.862, { y: 0.06, seg: 12 }));
    for (const z of [0.55, -0.2]) { P('y', cyl(0.107, 0.107, z, z + 0.05, { y: 0.06, seg: 18 })); P('k', cyl(0.107, 0.107, z + 0.05, z + 0.07, { y: 0.06, seg: 18 })); }
    P('p', prof([[-0.04, -0.03], [0.04, -0.03], [0.02, -0.19], [-0.06, -0.19]], 0.055));            // impugnature
    P('p', prof([[0.28, -0.03], [0.36, -0.03], [0.35, -0.16], [0.28, -0.16]], 0.055));
    P('k', guard(0.04, 0.13, -0.035, -0.095, 0.022));
    P('m', bx(0.012, 0.03, 0.012, 0, -0.06, 0.075, { rx: 0.25 }));
    P('k', prof([[0.2, 0.15], [0.42, 0.15], [0.42, 0.205], [0.36, 0.225], [0.2, 0.205]], 0.05, { x: -0.12 }));   // mirino ottico laterale
    P('g', bx(0.04, 0.05, 0.004, -0.12, 0.185, 0.424));
    P('m', bx(0.04, 0.03, 0.08, -0.09, 0.14, 0.3));
    P('p', bx(0.07, 0.07, 0.26, 0, -0.07, -0.18));                                                  // spallaccio
    P('r', bx(0.02, 0.07, 0.34, 0.1, 0.06, 0.18));                                                  // pannello laterale
    P('m', bx(0.024, 0.018, 0.5, 0, 0.17, 0.2));                                                    // maniglia superiore
    for (const z of [0.0, 0.4]) P('m', bx(0.02, 0.022, 0.02, 0, 0.16, z));
  },
};

const GEO = new Map();
/** geometrie unite per materiale (condivise da tutte le rarità della stessa arma) */
function weaponGeo(id) {
  if (GEO.has(id)) return GEO.get(id);
  const byKey = new Map();
  MODELS[id]((k, g) => { if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(g); });
  const out = [];
  for (const [k, list] of byKey) {
    const g = list.length === 1 ? list[0] : mergeGeometries(list, false);
    g.computeBoundingSphere();
    out.push([k, g]);
  }
  GEO.set(id, out);
  return out;
}

// ───────────── texture ─────────────
const TEX = new Map();
/** texture colore + normal map (da una mappa di altezze) disegnate su canvas */
function texPair(key, base, draw, height, strength = 2) {
  if (TEX.has(key)) return TEX.get(key);
  const rnd = mulberry(key.length * 7919 + key.charCodeAt(0) * 31 + (key.charCodeAt(key.length - 1) || 0));
  const A = canvas2d(base);
  draw(A.g, base, rnd, A);
  const map = colorTex(A.c);
  let normalMap = null;
  if (height && NORMALS) {
    const H = canvas2d(base);
    H.g.fillStyle = '#808080'; H.g.fillRect(0, 0, base, base);
    height(H.g, base, mulberry(99 + key.length), H);
    normalMap = normalFromHeight(H.c, strength);
  }
  const r = { map, normalMap };
  TEX.set(key, r);
  return r;
}
/** disegna qualcosa ripetendolo ai bordi, così la texture si affianca senza giunte */
function wrap(S, x, y, r, fn) {
  for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
    if (x + dx + r < 0 || x + dx - r > S || y + dy + r < 0 || y + dy - r > S) continue;
    fn(x + dx, y + dy);
  }
}
function blob(g, x, y, r, rnd) {
  g.beginPath();
  const n = 9, ph = rnd() * 6;
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2, rr = r * (0.65 + 0.35 * Math.sin(a * 3 + ph) + rnd() * 0.25);
    const px = x + Math.cos(a) * rr * 1.5, py = y + Math.sin(a) * rr;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath(); g.fill();
}
function stipple(g, S, rnd, n, light, dark) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = rnd() < 0.5 ? light : dark;
    g.fillRect(rnd() * S, rnd() * S, 1 + rnd(), 1 + rnd());
  }
}

/** metallo brunito spazzolato, con graffi e bordi consumati */
function gunmetal() {
  return texPair('w_gm', 128, (g, S, rnd) => {
    const gr = g.createLinearGradient(0, 0, S, S);
    gr.addColorStop(0, '#565c66'); gr.addColorStop(0.5, '#454a53'); gr.addColorStop(1, '#50555e');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 340; i++) {
      const y = rnd() * S, l = 10 + rnd() * 60, x = rnd() * S;
      g.strokeStyle = rnd() < 0.5 ? `rgba(255,255,255,${0.02 + rnd() * 0.05})` : `rgba(0,0,0,${0.04 + rnd() * 0.1})`;
      g.lineWidth = 0.5 + rnd() * 0.8;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (rnd() - 0.5)); g.stroke();
    }
    for (let i = 0; i < 12; i++) {
      g.strokeStyle = `rgba(215,220,228,${0.15 + rnd() * 0.25})`; g.lineWidth = 0.7;
      const x = rnd() * S, y = rnd() * S;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 26, y + (rnd() - 0.5) * 10); g.stroke();
    }
  }, (g, S, rnd) => {
    for (let i = 0; i < 220; i++) {
      const y = rnd() * S, x = rnd() * S;
      g.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'; g.lineWidth = 0.6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + rnd() * 40, y); g.stroke();
    }
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1.2;
    for (let i = 0; i < 10; i++) { const x = rnd() * S, y = rnd() * S; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 26, y + (rnd() - 0.5) * 10); g.stroke(); }
  }, 1.4);
}
/** polimero nero con zigrinatura fine (impugnature) */
function polymer() {
  return texPair('w_pl', 64, (g, S, rnd) => {
    g.fillStyle = '#2c2f35'; g.fillRect(0, 0, S, S);
    stipple(g, S, rnd, 900, 'rgba(255,255,255,0.07)', 'rgba(0,0,0,0.25)');
  }, (g, S, rnd) => {
    for (let i = 0; i < 1300; i++) { g.fillStyle = rnd() < 0.5 ? '#c8c8c8' : '#404040'; g.fillRect(rnd() * S, rnd() * S, 1.3, 1.3); }
  }, 2.2);
}
/** legno di noce venato e lucidato */
function walnut() {
  const grain = (g, S, rnd, dark, light) => {
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = rnd() < 0.5 ? dark : light;
      g.lineWidth = 0.6 + rnd() * 2;
      const y0 = rnd() * S, a = 2 + rnd() * 5, f = (1 + Math.floor(rnd() * 3)) * Math.PI * 2 / S, ph = rnd() * 6;
      g.beginPath();
      for (let x = 0; x <= S; x += 4) { const y = y0 + Math.sin(x * f + ph) * a; x ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
  };
  return texPair('w_wood', 128, (g, S, rnd) => {
    const gr = g.createLinearGradient(0, 0, 0, S);
    gr.addColorStop(0, '#93592a'); gr.addColorStop(0.5, '#73421d'); gr.addColorStop(1, '#8b552b');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    grain(g, S, rnd, 'rgba(45,20,6,0.32)', 'rgba(170,110,55,0.3)');
    g.fillStyle = 'rgba(255,230,190,0.08)'; g.fillRect(0, S * 0.15, S, S * 0.1);
  }, (g, S, rnd) => grain(g, S, rnd, 'rgba(0,0,0,0.5)', 'rgba(255,255,255,0.35)'), 1.2);
}

/**
 * Finitura del corpo dell'arma, diversa per rarità:
 * Comune grigio tattico · Non comune mimetica boschiva · Raro mimetica digitale blu
 * Epico fibra di carbonio viola con filetti al neon · Leggendario oro inciso a volute
 */
function finishTex(rarity) {
  switch (rarity) {
    case 0: return texPair('w_f0', 64, (g, S, rnd) => {
      g.fillStyle = '#6a6f78'; g.fillRect(0, 0, S, S);
      stipple(g, S, rnd, 700, 'rgba(255,255,255,0.06)', 'rgba(0,0,0,0.14)');
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, S - 2, S, 1);
    }, (g, S, rnd) => { for (let i = 0; i < 700; i++) { g.fillStyle = rnd() < 0.5 ? '#a0a0a0' : '#606060'; g.fillRect(rnd() * S, rnd() * S, 1.2, 1.2); } }, 1.2);
    case 1: return texPair('w_f1', 128, (g, S, rnd) => {
      g.fillStyle = '#6e8240'; g.fillRect(0, 0, S, S);
      for (const [col, n, r] of [['#8f9c5c', 9, 15], ['#43572a', 11, 14], ['#2f3124', 9, 10]]) {
        g.fillStyle = col;
        for (let i = 0; i < n; i++) { const x = rnd() * S, y = rnd() * S, rr = r * (0.6 + rnd() * 0.7); wrap(S, x, y, rr * 1.8, (px, py) => blob(g, px, py, rr, mulberry(i * 13 + n))); }
      }
      stipple(g, S, rnd, 900, 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.12)');
    }, (g, S, rnd) => { for (let i = 0; i < 1200; i++) { g.fillStyle = rnd() < 0.5 ? '#9a9a9a' : '#666'; g.fillRect(rnd() * S, rnd() * S, 1.2, 1.2); } }, 1.0);
    case 2: return texPair('w_f2', 64, (g, S, rnd) => {
      g.fillStyle = '#3f76c6'; g.fillRect(0, 0, S, S);
      const cell = 4;
      for (const [col, n] of [['#8bb6ec', 22], ['#24497f', 26], ['#15294b', 14]]) {
        g.fillStyle = col;
        for (let i = 0; i < n; i++) {
          let cx = Math.floor(rnd() * S / cell), cy = Math.floor(rnd() * S / cell);
          for (let k = 0; k < 6; k++) {
            g.fillRect(((cx % (S / cell)) + S / cell) % (S / cell) * cell, ((cy % (S / cell)) + S / cell) % (S / cell) * cell, cell, cell);
            if (rnd() < 0.5) cx += rnd() < 0.5 ? 1 : -1; else cy += rnd() < 0.5 ? 1 : -1;
          }
        }
      }
    }, (g, S, rnd) => { for (let i = 0; i < 500; i++) { g.fillStyle = rnd() < 0.5 ? '#999' : '#666'; g.fillRect(rnd() * S, rnd() * S, 1, 1); } }, 0.8);
    case 3: return texPair('w_f3', 64, (g, S) => {
      g.fillStyle = '#231833'; g.fillRect(0, 0, S, S);
      const c = 8;
      for (let y = 0; y < S; y += c / 2) for (let x = 0; x < S; x += c) {
        const o = ((y / (c / 2)) % 4) * (c / 4);
        const gr = g.createLinearGradient(x + o, y, x + o + c / 2, y + c / 2);
        gr.addColorStop(0, '#3b2a55'); gr.addColorStop(0.5, '#4a3668'); gr.addColorStop(1, '#1a1126');
        g.fillStyle = gr; g.fillRect((x + o) % S, y, c / 2, c / 2);
      }
      g.fillStyle = '#d27bff'; g.fillRect(0, S * 0.5 - 0.6, S, 1.2);
      g.fillStyle = 'rgba(210,123,255,0.35)'; g.fillRect(0, S * 0.5 - 2, S, 4);
    }, (g, S) => {
      const c = 8;
      for (let y = 0; y < S; y += c / 2) for (let x = 0; x < S; x += c) {
        const o = ((y / (c / 2)) % 4) * (c / 4);
        g.fillStyle = '#b0b0b0'; g.fillRect((x + o) % S, y, c / 2, c / 2);
        g.fillStyle = '#505050'; g.fillRect((x + o) % S, y + c / 2 - 1, c / 2, 1);
      }
    }, 1.0);
    default: return texPair('w_f4', 128, (g, S, rnd) => {
      const gr = g.createLinearGradient(0, 0, S, S);
      gr.addColorStop(0, '#f6d66a'); gr.addColorStop(0.45, '#d9a933'); gr.addColorStop(1, '#a8771c');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
      g.strokeStyle = 'rgba(80,45,0,0.6)'; g.lineWidth = 1.3;
      for (let i = 0; i < 10; i++) {
        const cx = rnd() * S, cy = rnd() * S, dir = rnd() < 0.5 ? 1 : -1;
        wrap(S, cx, cy, 20, (px, py) => { g.beginPath(); for (let a = 0; a < 11; a += 0.25) g.lineTo(px + Math.cos(a * dir) * a * 1.5, py + Math.sin(a * dir) * a * 1.5); g.stroke(); });
      }
      g.strokeStyle = 'rgba(255,250,215,0.45)'; g.lineWidth = 1; g.strokeRect(3, 3, S - 6, S - 6);
    }, (g, S, rnd) => {
      g.strokeStyle = '#202020'; g.lineWidth = 1.6;
      for (let i = 0; i < 10; i++) {
        const cx = rnd() * S, cy = rnd() * S, dir = rnd() < 0.5 ? 1 : -1;
        wrap(S, cx, cy, 20, (px, py) => { g.beginPath(); for (let a = 0; a < 11; a += 0.25) g.lineTo(px + Math.cos(a * dir) * a * 1.5, py + Math.sin(a * dir) * a * 1.5); g.stroke(); });
      }
    }, 1.6);
  }
}
/** inserti luminosi della rarità: righe, chevron, esagoni, oro con volute */
function accentTex(rarity) {
  const rc = RARITIES[rarity].color;
  return texPair('w_r' + rarity, 64, (g, S) => {
    const base = new THREE.Color(rc);
    const dark = '#' + base.clone().multiplyScalar(0.55).getHexString(), light = '#' + base.clone().lerp(new THREE.Color('#ffffff'), 0.45).getHexString();
    const gr = g.createLinearGradient(0, 0, S, S);
    gr.addColorStop(0, light); gr.addColorStop(0.45, rc); gr.addColorStop(1, dark);
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.lineWidth = 1.5;
    g.strokeStyle = rarity <= 1 ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)';
    if (rarity <= 1) for (let x = -S; x < S * 2; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + S, S); g.stroke(); }
    else if (rarity === 2) for (let y = -8; y < S + 8; y += 8) { g.beginPath(); for (let x = 0; x <= S; x += 8) g.lineTo(x, y + ((x / 8) % 2 ? 4 : 0)); g.stroke(); }
    else if (rarity === 3) {
      const r = 5, h = r * Math.sqrt(3);
      for (let row = -1; row < S / h * 2 + 1; row++) for (let col = -1; col < S / (r * 3) + 1; col++) {
        const cx = col * r * 3 + (row % 2 ? r * 1.5 : 0), cy = row * h / 2;
        g.beginPath(); for (let k = 0; k <= 6; k++) { const a = k * Math.PI / 3; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.stroke();
      }
    } else { g.strokeStyle = 'rgba(255,250,210,0.6)'; g.strokeRect(2, 2, S - 4, S - 4); }
    const hl = g.createLinearGradient(0, 0, 0, S);
    hl.addColorStop(0, 'rgba(255,255,255,0.35)'); hl.addColorStop(0.3, 'rgba(255,255,255,0)');
    g.fillStyle = hl; g.fillRect(0, 0, S, S);
  });
}

const FIN = [
  { metal: 0.05, rough: 0.72 }, { metal: 0.05, rough: 0.78 }, { metal: 0.1, rough: 0.55 },
  { metal: 0.3, rough: 0.32 }, { metal: 0.65, rough: 0.28 },
];
const MATS = new Map();
function std(o) { return new THREE.MeshStandardMaterial(o); }
function weaponMats(rarity) {
  if (MATS.has(rarity)) return MATS.get(rarity);
  const rc = RARITIES[rarity].color;
  const gm = gunmetal(), pl = polymer(), wd = walnut(), fin = finishTex(rarity), ac = accentTex(rarity);
  const nrm = t => t.normalMap ? { normalMap: t.normalMap, normalScale: new THREE.Vector2(0.8, 0.8) } : {};
  const m = {
    m: std({ map: gm.map, ...nrm(gm), metalness: 0.55, roughness: 0.36 }),
    b: std({ map: fin.map, ...nrm(fin), metalness: FIN[rarity].metal, roughness: FIN[rarity].rough }),
    p: std({ map: pl.map, ...nrm(pl), metalness: 0.02, roughness: 0.85 }),
    r: std({ map: ac.map, emissive: rc, emissiveMap: ac.map, emissiveIntensity: rarity >= 3 ? 0.55 : 0.2, metalness: rarity === 4 ? 0.5 : 0.15, roughness: 0.35 }),
    w: std({ map: wd.map, ...nrm(wd), roughness: 0.5, metalness: 0.02 }),
    k: std({ color: '#24262b', metalness: 0.25, roughness: 0.55 }),
    g: std({ color: '#7fd0ff', emissive: '#1a5a8a', emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.05 }),
    dot: std({ color: '#ff2a2a', emissive: '#ff2a2a', emissiveIntensity: 2 }),
    s: std({ color: '#d8b040', metalness: 0.9, roughness: 0.25 }),
    sh: std({ color: '#c0302a', roughness: 0.5 }),
    wh: std({ color: '#dcd8cc', roughness: 0.45, metalness: 0.1 }),
    y: std({ color: '#f2c230', roughness: 0.5 }),
  };
  MATS.set(rarity, m);
  return m;
}

/** Modello dell'arma: la canna punta verso +Z */
export function buildWeaponMesh(id, rarity = 0) {
  const g = new THREE.Group();
  if (!MODELS[id]) return g;
  const mats = weaponMats(Math.max(0, Math.min(4, rarity | 0)));
  for (const [k, geo] of weaponGeo(id)) {
    const m = new THREE.Mesh(geo, mats[k] || mats.k);
    m.castShadow = true;
    g.add(m);
  }
  g.userData.weapon = id;
  return g;
}

// ───────────── icone ─────────────
//  Le icone dell'interfaccia sono foto dei modelli 3D, fatte una volta con un piccolo
//  renderer separato (poi chiuso) e salvate come immagini.
const ICONS = new Map();
let iconR = null, iconScene = null, iconCam = null, iconTimer = 0;
const IW = 240, IH = 120;
function iconSetup() {
  if (iconR) return true;
  try {
    const cv = document.createElement('canvas');
    cv.width = IW; cv.height = IH;
    iconR = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true });
    iconR.setPixelRatio(1);
    iconR.setSize(IW, IH, false);
    iconR.outputColorSpace = THREE.SRGBColorSpace;
    iconR.toneMapping = THREE.ACESFilmicToneMapping;
    iconR.toneMappingExposure = 1.15;
    iconScene = new THREE.Scene();
    // ambiente semplice (cielo chiaro sopra, terra scura sotto) per i riflessi dei metalli
    const env = new THREE.Scene();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
    const col = [], P = sky.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) { const t = P.getY(i) / 10 * 0.5 + 0.5; col.push(0.25 + t * 0.85, 0.27 + t * 0.85, 0.32 + t * 0.9); }
    sky.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    env.add(sky);
    const pm = new THREE.PMREMGenerator(iconR);
    iconScene.environment = pm.fromScene(env, 0.02).texture;
    iconScene.environmentIntensity = 0.55;
    pm.dispose();
    iconScene.add(new THREE.HemisphereLight('#ffffff', '#45403a', 1.2));
    const key = new THREE.DirectionalLight('#fff4e0', 2.6); key.position.set(2, 4, 3); iconScene.add(key);
    const rim = new THREE.DirectionalLight('#9fd0ff', 1.4); rim.position.set(-3, 1, -2); iconScene.add(rim);
    iconCam = new THREE.PerspectiveCamera(20, IW / IH, 0.1, 50);
    return true;
  } catch { iconR = null; return false; }
}
function iconTeardown() {
  if (!iconR) return;
  iconR.dispose();
  try { iconR.forceContextLoss(); } catch { /* già perso */ }
  iconR = null; iconScene = null;
}
/** immagine (data URL) dell'arma vista di lato, oppure null se WebGL non è disponibile */
export function weaponIcon(id, rarity = 0) {
  const key = id + '|' + rarity;
  if (ICONS.has(key)) return ICONS.get(key);
  if (!MODELS[id] || !iconSetup()) { ICONS.set(key, null); return null; }
  const g = buildWeaponMesh(id, rarity);
  const piv = new THREE.Group(); piv.add(g);
  piv.rotation.set(0.05, -Math.PI / 2 + 0.12, 0);     // canna verso destra, un filo di prospettiva
  iconScene.add(piv);
  piv.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(piv), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  piv.position.sub(c);
  const fit = Math.max(size.x / (IW / IH), size.y) * 1.08;
  iconCam.position.set(0, 0.04 * fit, fit / (2 * Math.tan(THREE.MathUtils.degToRad(iconCam.fov / 2))) + size.z * 0.5);
  iconCam.lookAt(0, 0, 0);
  iconR.setClearColor(0x000000, 0);
  iconR.clear();
  iconR.render(iconScene, iconCam);
  let url = null;
  try { url = iconR.domElement.toDataURL('image/png'); } catch { url = null; }
  iconScene.remove(piv);
  ICONS.set(key, url);
  clearTimeout(iconTimer);
  iconTimer = setTimeout(iconTeardown, 4000);           // chiude il contesto WebGL quando non serve più
  return url;
}
/** prepara in anticipo le icone di tutte le armi e rarità */
export function preloadWeaponIcons() {
  for (const id of Object.keys(MODELS)) for (let r = 0; r < RARITIES.length; r++) weaponIcon(id, r);
}
export const WEAPON_IDS = Object.keys(MODELS).filter(id => WEAPONS[id]);
