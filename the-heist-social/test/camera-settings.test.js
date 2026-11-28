import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GAME_CAMERA_ZOOM, LOBBY_CAMERA_ZOOM, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM, CAMERA_ZOOM_STEP, clampCameraZoom } from '../src/graphics/cameraSettings.js';

test('game starts close, but controls can both zoom in further and zoom out', () => {
  assert.ok(LOBBY_CAMERA_ZOOM / GAME_CAMERA_ZOOM > 1.8);
  assert.ok(clampCameraZoom(GAME_CAMERA_ZOOM - CAMERA_ZOOM_STEP) < GAME_CAMERA_ZOOM);
  assert.ok(clampCameraZoom(GAME_CAMERA_ZOOM + CAMERA_ZOOM_STEP) > GAME_CAMERA_ZOOM);
  assert.equal(clampCameraZoom(-100), MIN_CAMERA_ZOOM);
  assert.equal(clampCameraZoom(100), MAX_CAMERA_ZOOM);
});

test('entering online gameplay does not recursively restart the transition', async () => {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const entry = source.slice(source.indexOf('function enterMatchGameplay('), source.indexOf('function showRoleRevealBanner('));
  assert.match(entry, /villaScene\.cameraZoom = GAME_CAMERA_ZOOM/);
  assert.match(entry, /if \(playMode === 'offline'\) handlePhaseTransitions/);
});
