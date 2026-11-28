import test from 'node:test';
import assert from 'node:assert/strict';
import { createRealisticHumanoid, updateHumanoidAnimation } from '../src/graphics/humanoid.js';
import { CHARACTER_PRESETS } from '../src/data/characters.js';

// CanvasTexture generation only needs the drawing interface, not a GPU.
const context = new Proxy({}, {
  get(target, key) {
    if (key in target) return target[key];
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
    return () => {};
  },
  set(target, key, value) { target[key] = value; return true; },
});
globalThis.document = { createElement: () => ({ getContext: () => context }) };

test('proportioned characters keep their animation rig and facial materials', () => {
  for (const preset of CHARACTER_PRESETS) {
    const avatar = createRealisticHumanoid(preset, true);
    const rig = avatar.userData.rig;
    assert.equal(rig.headPivot.scale.x, 1);
    assert.equal(rig.characterGroup.scale.y, rig.characterGroup.scale.x);
    updateHumanoidAnimation(avatar, { speed: 2, usingCctv: true }, 0.016, 2, true);
    assert.equal(rig.tabletMesh.visible, true);
    const originalOpacities = rig.materials.map(m => m.opacity);
    updateHumanoidAnimation(avatar, { hidden: true }, 0.016, 3, true);
    assert.ok(rig.materials.every(m => m.opacity < 0.5));
    updateHumanoidAnimation(avatar, {}, 0.016, 4, true);
    assert.deepEqual(rig.materials.map(m => m.opacity), originalOpacities);
  }
});
