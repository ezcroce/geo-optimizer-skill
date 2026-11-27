import * as THREE from "three";
let cached;
// Canali separati e deterministici: la tessitura NON riutilizza il rumore della pelle.
export function characterTextures() {
  if (cached) return cached;
  const size = 128,
    channels = Object.fromEntries(
      ["skinRoughness", "skinBump", "clothRoughness", "clothBump"].map((n) => [
        n,
        new Uint8Array(size * size * 4),
      ]),
    );
  let seed = 7319;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const pores = Array.from({ length: 260 }, () => ({
    x: random() * size,
    y: random() * size,
    r: 0.5 + random() * 1.1,
  }));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let pore = 0;
      for (const p of pores) {
        const dx = Math.min(Math.abs(x - p.x), size - Math.abs(x - p.x)),
          dy = Math.min(Math.abs(y - p.y), size - Math.abs(y - p.y));
        pore += Math.exp(-(dx * dx + dy * dy) / (p.r * p.r));
      }
      const grain = random(),
        warp = Math.cos((x * Math.PI) / 2),
        weft = Math.cos((y * Math.PI) / 2),
        over = (Math.floor(x / 4) + Math.floor(y / 4)) % 2;
      const weave = (over ? warp : weft) * 12 + (over ? weft : warp) * 4;
      const values = {
        skinRoughness: 237 + grain * 12 - pore * 7,
        skinBump: 151 + grain * 3 - pore * 27,
        clothRoughness: 238 + weave * 0.5 + grain * 5,
        clothBump: 128 + weave + grain * 4,
      };
      const i = (y * size + x) * 4;
      for (const [name, data] of Object.entries(channels)) {
        const v = Math.round(THREE.MathUtils.clamp(values[name], 0, 255));
        data[i] = data[i + 1] = data[i + 2] = v;
        data[i + 3] = 255;
      }
    }
  cached = Object.fromEntries(
    Object.entries(channels).map(([name, data]) => {
      const texture = new THREE.DataTexture(data, size, size);
      texture.name = name;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(
        name.startsWith("skin") ? 4 : 9,
        name.startsWith("skin") ? 4 : 9,
      );
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.needsUpdate = true;
      return [name, texture];
    }),
  );
  return cached;
}
export function prepareCharacterMaterials(model) {
  const maps = characterTextures(),
    copies = new Map();
  model.traverse((node) => {
    if (!node.isMesh) return;
    const copy = (material) => {
      if (copies.has(material)) return copies.get(material);
      const fabric = ["Outfit", "Fabric", "Apron"].includes(material.name),
        skin = material.name === "Skin";
      let result = material.clone();
      if ((fabric || skin) && !result.isMeshPhysicalMaterial) {
        result = new THREE.MeshPhysicalMaterial();
        THREE.MeshStandardMaterial.prototype.copy.call(result, material);
      }
      if (skin) {
        Object.assign(result, {
          roughness: 0.48,
          roughnessMap: maps.skinRoughness,
          bumpMap: maps.skinBump,
          bumpScale: 0.0016,
          clearcoat: 0,
          sheen: 0.14,
          sheenRoughness: 0.85,
          ior: 1.38,
        });
        result.sheenColor.set("#c9b7a2");
      }
      if (fabric) {
        Object.assign(result, {
          roughness: material.name === "Apron" ? 0.92 : 0.88,
          metalness: 0,
          roughnessMap: maps.clothRoughness,
          bumpMap: maps.clothBump,
          bumpScale: 0.0012,
          clearcoat: 0,
          sheen: material.name === "Apron" ? 0.65 : 0.42,
          sheenRoughness: 0.85,
        });
        result.sheenColor.set("#c4c1b5");
      }
      if (result.name === "Metal") {
        result.metalness = 0.75;
        result.roughness = 0.28;
      }
      copies.set(material, result);
      return result;
    };
    node.material = Array.isArray(node.material)
      ? node.material.map(copy)
      : copy(node.material);
  });
}
