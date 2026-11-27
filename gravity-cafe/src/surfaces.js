import * as THREE from "three";

// Texture originali locali e deterministiche, riutilizzate da tutta la sala.
export function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
export function createSurfaces() {
  let seed = 6327;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const wood = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#678779";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 200; i++) {
      ctx.strokeStyle = `rgba(24,45,34,${0.04 + random() * 0.13})`;
      ctx.beginPath();
      const y = random() * h;
      for (let x = 0; x <= w; x += 8)
        ctx.lineTo(x, y + Math.sin(x * 0.035 + i) * 2);
      ctx.stroke();
    }
  });
  const marble = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#e7e4d6";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 28; i++) {
      ctx.lineWidth = 0.4 + random();
      ctx.strokeStyle = `rgba(74,105,99,${0.04 + random() * 0.08})`;
      ctx.beginPath();
      const x = random() * w;
      for (let y = 0; y <= h; y += 8)
        ctx.lineTo(x + Math.sin(y * 0.017 + i) * 35 + y * 0.18, y);
      ctx.stroke();
    }
  });
  const brushed = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#b5babb";
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      ctx.strokeStyle = `rgba(12,29,33,${random() * 0.22})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  });
  brushed.colorSpace = THREE.NoColorSpace;
  const grip = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#576765";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#c8d1c5";
    ctx.lineWidth = 4;
    for (let x = -w; x < w * 2; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + w, h);
      ctx.stroke();
    }
    ctx.strokeStyle = "#2b393a";
    ctx.lineWidth = 2;
    for (let y = 0; y < h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  });
  for (const texture of [wood, marble, brushed, grip]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
  }
  return { wood, marble, brushed, grip };
}
export function createLocalEnvironment() {
  const images = Array.from({ length: 6 }, (_, i) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, i === 2 ? "#f8eed8" : "#b2d4d0");
    gradient.addColorStop(0.4, "#709a98");
    gradient.addColorStop(1, "#102d37");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#e2f6e7";
    ctx.fillRect(10, 10, 7, 32);
    ctx.fillStyle = "#fff2d0";
    ctx.fillRect(40, 6, 16, 8);
    return canvas;
  });
  const environment = new THREE.CubeTexture(images);
  environment.colorSpace = THREE.SRGBColorSpace;
  environment.needsUpdate = true;
  return environment;
}
export function signTexture(
  title,
  subtitle = "",
  color = "#a6ebd0",
  icon = "cup",
) {
  return canvasTexture(768, 192, (ctx, w, h) => {
    ctx.fillStyle = "#0b252e";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 7;
    if (icon === "bell") {
      ctx.beginPath();
      ctx.arc(70, 106, 36, Math.PI, 0);
      ctx.stroke();
      ctx.fillRect(29, 111, 82, 7);
      ctx.beginPath();
      ctx.arc(70, 62, 7, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeRect(34, 65, 58, 56);
      ctx.beginPath();
      ctx.arc(96, 88, 15, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(40, 134);
      ctx.lineTo(102, 134);
      ctx.moveTo(49, 49);
      ctx.lineTo(49, 28);
      ctx.moveTo(73, 49);
      ctx.lineTo(73, 28);
      ctx.stroke();
    }
    ctx.fillStyle = "#fff5dc";
    ctx.font = "bold 47px sans-serif";
    ctx.fillText(title, 140, 86);
    ctx.font = "24px sans-serif";
    ctx.fillStyle = color;
    ctx.fillText(subtitle, 142, 132);
  });
}
