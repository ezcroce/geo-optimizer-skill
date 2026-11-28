// Orthographic camera width scales with cameraZoom: smaller values magnify the scene.
export const GAME_CAMERA_ZOOM = 11.5;
export const LOBBY_CAMERA_ZOOM = 22;
export const MIN_CAMERA_ZOOM = 7.5;
export const MAX_CAMERA_ZOOM = 30;
export const CAMERA_ZOOM_STEP = 1.5;

export function clampCameraZoom(zoom) {
  return Math.max(MIN_CAMERA_ZOOM, Math.min(MAX_CAMERA_ZOOM, zoom));
}
