// ─────────────────────────────────────────────────────────────
//  Motore grafico: post-processing (bloom, occlusione ambientale, anti-aliasing),
//  ombre morbide, risoluzione di rendering, preset di qualità.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

/** preset di qualità (le chiavi sono quelle di settings.gfx) */
export const PRESETS = {
  basso: { scale: 0.7, shadows: 'off', texq: 'low', aniso: 1, aa: 'fxaa', bloom: false, ao: false, view: 0.75, grass: 0.4 },
  medio: { scale: 0.85, shadows: 'low', texq: 'normal', aniso: 4, aa: 'fxaa', bloom: false, ao: false, view: 1, grass: 0.8 },
  alto: { scale: 1, shadows: 'high', texq: 'high', aniso: 8, aa: 'msaa', bloom: true, ao: false, view: 1, grass: 1 },
  ultra: { scale: 1.25, shadows: 'ultra', texq: 'high', aniso: 16, aa: 'smaa', bloom: true, ao: true, view: 1.4, grass: 1.4 },
};
export const GFX_DEFAULT = { preset: 'alto', ...PRESETS.alto, fpsShow: false, fpsCap: 0 };

const SHADOW = {
  low: { size: 1024, radius: 1.5, ext: 55 },
  high: { size: 2048, radius: 3, ext: 70 },
  ultra: { size: 4096, radius: 4, ext: 95 },
};

export function createGfx(renderer, scene, camera, sun) {
  let opts = { ...GFX_DEFAULT };
  let composer = null, renderPass, bloomPass, gtaoPass, outputPass, aaPass;
  let usePost = false;
  let maxAniso = renderer.capabilities.getMaxAnisotropy();

  function pixelRatio() {
    return THREE.MathUtils.clamp(Math.min(window.devicePixelRatio || 1, 1.5) * opts.scale, 0.4, 3);
  }

  function disposeComposer() {
    if (!composer) return;
    for (const p of composer.passes) p.dispose?.();
    composer.renderTarget1.dispose(); composer.renderTarget2.dispose();
    composer = null;
  }

  function buildComposer() {
    disposeComposer();
    usePost = opts.bloom || opts.ao || opts.aa !== 'off';
    if (!usePost) return;
    const w = innerWidth, h = innerHeight, pr = pixelRatio();
    // HDR (half float) così il bloom prende solo le luci davvero forti; MSAA nel render target
    const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: opts.aa === 'msaa' ? 4 : 0 });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    gtaoPass = null; bloomPass = null; aaPass = null;
    if (opts.ao) {
      gtaoPass = new GTAOPass(scene, camera, w * pr, h * pr);
      gtaoPass.output = GTAOPass.OUTPUT.Default;
      gtaoPass.blendIntensity = 0.8;
      gtaoPass.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.5, thickness: 1.5, scale: 1, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
      gtaoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      composer.addPass(gtaoPass);
    }
    if (opts.bloom) {
      // soglia alta: brillano sole, lampi degli spari, oggetti leggendari, riflessi sull'acqua
      bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.55, 0.92);
      composer.addPass(bloomPass);
    }
    outputPass = new OutputPass();
    composer.addPass(outputPass);
    if (opts.aa === 'fxaa') { aaPass = new FXAAPass(); composer.addPass(aaPass); }
    else if (opts.aa === 'smaa') { aaPass = new SMAAPass(); composer.addPass(aaPass); }
  }

  function applyShadows() {
    const s = SHADOW[opts.shadows];
    sun.castShadow = !!s;
    if (!s) return;
    if (sun.shadow.mapSize.x !== s.size) {
      sun.shadow.mapSize.set(s.size, s.size);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    sun.shadow.radius = s.radius;
    sun.shadow.blurSamples = 12;
    Object.assign(sun.shadow.camera, { left: -s.ext, right: s.ext, top: s.ext, bottom: -s.ext });
    sun.shadow.camera.updateProjectionMatrix();
  }

  /** applica tutte le opzioni grafiche (quelle che cambiano il composer lo ricostruiscono) */
  function apply(o) {
    const prev = opts;
    opts = { ...GFX_DEFAULT, ...o };
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(innerWidth, innerHeight);
    applyShadows();
    const postKey = x => [x.bloom, x.ao, x.aa, x.scale].join('|');
    const want = opts.bloom || opts.ao || opts.aa !== 'off';
    if (want !== !!composer || postKey(prev) !== postKey(opts)) buildComposer();
  }

  function setSize(w, h) {
    renderer.setSize(w, h);
    if (composer) { composer.setPixelRatio(pixelRatio()); composer.setSize(w, h); }
  }

  /** disegna la scena principale (con o senza post-processing) */
  function render(sc = scene, cam = camera) {
    if (composer && usePost) {
      renderPass.scene = sc; renderPass.camera = cam;
      if (gtaoPass) gtaoPass.enabled = sc === scene;   // l'occlusione solo in partita
      composer.render();
    } else renderer.render(sc, cam);
  }

  buildComposer();
  return {
    apply, render, setSize,
    get opts() { return opts; },
    get maxAniso() { return maxAniso; },
    get usePost() { return usePost; },
  };
}
