import { CUSTOMER_COLORS } from "./avatars.js";
export const SKIN_TONES = ["#a39783", "#363c40", "#a6a092"];
// Alias conservato per i chiamanti esistenti: ora lo stesso sistema veste anche il barista.
export { prepareCharacterMaterials as prepareCustomerModel } from "./character-surfaces.js";
export function applyCustomerAppearance(model, kind = 0, vip = false) {
  kind = ((kind % 3) + 3) % 3;
  for (const [name, visible] of [
    ["TechVisor", kind === 0],
    ["OpenHelmet", kind === 1],
    ["VIPScarf", vip],
    ["VIPCape", vip],
  ]) {
    const node = model.getObjectByName(name);
    if (node) node.visible = visible;
  }
  for (const side of [-1, 1])
    for (const prefix of ["Iris", "Pupil"]) {
      const node = model.getObjectByName(prefix + side);
      if (node) node.visible = false;
    }
  model.traverse((node) => {
    if (!node.isMesh) return;
    for (const material of Array.isArray(node.material)
      ? node.material
      : [node.material]) {
      if (material.name === "Outfit") material.color.set(CUSTOMER_COLORS[kind]);
      if (material.name === "Skin") material.color.set(SKIN_TONES[kind]);
    }
  });
  model.userData.appearance = { kind, vip };
}
export function animateCustomerFace(model, mode, time) {
  for (const [name, side] of [
    ["BrowL", -1],
    ["BrowR", 1],
  ]) {
    const brow = model.getObjectByName(name);
    if (brow) {
      brow.rotation.z =
        mode === "Hurry"
          ? side * 0.13
          : mode === "Cheer"
            ? -side * 0.07
            : Math.sin(time * 0.6) * 0.025;
      brow.userData.restY ??= brow.position.y;
      brow.position.y = brow.userData.restY + (mode === "Hurry" ? -0.004 : 0);
    }
  }
}
