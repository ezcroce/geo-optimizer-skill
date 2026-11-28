import * as THREE from 'three';

const cache = new Map();
const gold = new THREE.MeshStandardMaterial({ color: '#e4aa37', metalness: 0.8, roughness: 0.25 });
const silver = new THREE.MeshStandardMaterial({ color: '#d8eaf1', metalness: 0.72, roughness: 0.2 });
const pearl = new THREE.MeshStandardMaterial({ color: '#e9e5e8', metalness: 0.3, roughness: 0.2 });

function gemstoneMaterial(color) {
  if (cache.has(color)) return cache.get(color);
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color; ctx.fillRect(0, 0, 256, 256);
  // Painted translucent triangular facets and tiny glints; the flat geometry adds real facets.
  const facets = [
    [[0, 0], [128, 30], [64, 126]], [[128, 30], [256, 0], [196, 126]],
    [[64, 126], [196, 126], [128, 246]], [[0, 256], [64, 126], [128, 246]],
    [[256, 256], [196, 126], [128, 246]],
  ];
  facets.forEach((points, i) => {
    ctx.beginPath(); ctx.moveTo(...points[0]); ctx.lineTo(...points[1]); ctx.lineTo(...points[2]); ctx.closePath();
    ctx.fillStyle = i % 2 ? 'rgba(0,12,40,0.22)' : 'rgba(255,255,255,0.28)'; ctx.fill();
  });
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(73, 55, 5, 24); ctx.fillRect(63, 64, 25, 5);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map, metalness: 0.15, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.12 });
  cache.set(color, mat); return mat;
}

// Scaled as a display object so each item remains readable in the isometric view.
export function createJewelOrnament(id, index = 0) {
  const root = new THREE.Group();
  const colors = ['#f03a55', '#5dddbc', '#58a7fa', '#fbc34b', '#c773f0', '#89e5ff'];
  const gemMat = gemstoneMaterial(colors[index % colors.length]);
  const gems = (x, y, z, size = 0.13, mat = gemMat) => {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(size, 0), mat);
    gem.position.set(x, y, z); gem.castShadow = true; root.add(gem); return gem;
  };
  const ring = (x, y, z, radius = 0.19, metal = gold) => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.035, 8, 24), metal);
    mesh.position.set(x, y, z); mesh.castShadow = true; root.add(mesh); return mesh;
  };

  if (id === 'j_tiara' || id === 'j_crown_pin') {
    const band = ring(0, -0.01, 0, 0.23); band.rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (0.12 + i * 0.19);
      const point = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.20 + (i === 2 ? 0.1 : 0), 4), gold);
      point.position.set(Math.cos(a) * 0.20, 0.10, Math.sin(a) * 0.20); root.add(point);
      gems(point.position.x, 0.18 + (i === 2 ? 0.06 : 0), point.position.z, 0.07);
    }
  } else if (id === 'j_pearl' || id === 'j_anklet' || id === 'j_bracelet') {
    const band = ring(0, 0, 0, 0.20, id === 'j_bracelet' ? silver : gold); band.rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), id === 'j_pearl' ? pearl : gemMat);
      bead.position.set(Math.cos(a) * 0.20, 0.02, Math.sin(a) * 0.20); root.add(bead);
    }
    gems(0, 0.04, 0.21, 0.10);
  } else if (id === 'j_ring' || id === 'j_watch') {
    ring(0, 0, 0, 0.19, id === 'j_watch' ? silver : gold);
    if (id === 'j_watch') {
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.065, 20), silver);
      face.rotation.x = Math.PI / 2; face.position.z = 0.04; root.add(face);
      gems(0, 0, 0.09, 0.10);
    } else gems(0, 0.19, 0, 0.16);
  } else if (id === 'j_earrings' || id === 'j_cufflinks') {
    for (const side of [-1, 1]) { ring(side * 0.16, 0.09, 0, 0.075, silver); gems(side * 0.16, -0.08, 0, 0.12); }
  } else if (id === 'j_goblet') {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.10, 0.25, 12, 1, true), gold); cup.position.y = 0.10; root.add(cup);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.11, 0.20, 12), gold); stem.position.y = -0.12; root.add(stem);
    gems(0, 0.09, 0.18, 0.09);
  } else {
    const bezel = ring(0, 0, 0, 0.17); bezel.rotation.y = Math.PI / 2;
    gems(0, 0, 0, 0.22);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), gold);
      bead.position.set(Math.cos(a) * 0.20, Math.sin(a) * 0.20, 0); root.add(bead);
    }
  }
  return root;
}
