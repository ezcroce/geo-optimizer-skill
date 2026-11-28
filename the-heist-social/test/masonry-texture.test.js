import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { getMasonryTextures } from '../src/graphics/textures.js';

// TextureLoader creates an HTML image; supply a tiny asynchronous stand-in.
globalThis.document = {
  createElementNS(_ns, tag) {
    assert.equal(tag, 'img');
    const events = new Map();
    return {
      complete: true,
      addEventListener(name, callback) { events.set(name, callback); },
      removeEventListener(name) { events.delete(name); },
      set src(url) { this.url = url; queueMicrotask(() => events.get('load')?.call(this)); },
    };
  },
};

test('reference stone tiles use a shared color/relief image and preserve proportions', async () => {
  const short = getMasonryTextures(3, 2.5);
  const long = getMasonryTextures(6, 2.5);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(short.map.image.url, /stone-masonry\.webp$/);
  assert.equal(short.map.image, short.bumpMap.image);
  assert.equal(short.map.image, long.map.image);
  assert.equal(short.map.colorSpace, THREE.SRGBColorSpace);
  assert.equal(short.bumpMap.colorSpace, THREE.NoColorSpace);
  assert.equal(short.map.wrapS, THREE.RepeatWrapping);
  assert.equal(long.map.repeat.x, short.map.repeat.x * 2);
  assert.equal(short.map.repeat.x, short.bumpMap.repeat.x);
  assert.ok(short.bumpScale > 0);
  assert.equal(getMasonryTextures(3, 2.5), short);
});
