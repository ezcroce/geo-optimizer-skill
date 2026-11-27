import * as T from "three";
import { canvasTexture, signTexture } from "./surfaces.js";
import { pendingDrinks, DRINK_NAMES } from "./gameplay.js";

// Modelli di postazione dettagliati; separati dalla logica e dai collider.
export function createStations(parent, { cup, surfaces }) {
  const material = (color, roughness = 0.5, metalness = 0) =>
    new T.MeshStandardMaterial({ color, roughness, metalness });
  const steel = material("#d4dcdc", 0.3, 0.86);
  steel.roughnessMap = surfaces.brushed;
  steel.bumpMap = surfaces.brushed;
  steel.bumpScale = 0.015;
  const copper = material("#c68a56", 0.29, 0.8),
    black = material("#122f35", 0.55),
    cream = material("#f7efdf"),
    gold = material("#e7bd63", 0.32, 0.7);
  const glow = new T.MeshStandardMaterial({
    color: "#f3cf7d",
    emissive: "#efb645",
    emissiveIntensity: 0.65,
    metalness: 0.5,
    roughness: 0.35,
  });
  const glass = new T.MeshPhysicalMaterial({
    color: "#a5e1da",
    transparent: true,
    opacity: 0.24,
    roughness: 0.1,
    metalness: 0.1,
    side: T.DoubleSide,
    depthWrite: false,
  });
  const groups = {
    coffee: new T.Group(),
    milk: new T.Group(),
    service: new T.Group(),
  };
  Object.values(groups).forEach((group) => parent.add(group));
  const mesh = (geo, mat, pos, group) => {
    const m = new T.Mesh(geo, mat);
    m.position.set(...pos);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const box = (size, mat, pos, g) =>
    mesh(new T.BoxGeometry(...size), mat, pos, g);
  const cyl = (rt, rb, h, mat, pos, g) =>
    mesh(new T.CylinderGeometry(rt, rb, h, 24), mat, pos, g);
  const ball = (r, mat, pos, g) =>
    mesh(new T.SphereGeometry(r, 14, 10), mat, pos, g);
  const tube = (points, r, mat, g) =>
    mesh(
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        16,
        r,
        8,
        false,
      ),
      mat,
      [0, 0, 0],
      g,
    );
  function panel(texture, width, height, pos, g) {
    const m = mesh(
      new T.PlaneGeometry(width, height),
      new T.MeshStandardMaterial({
        map: texture,
        emissive: "#ffffff",
        emissiveMap: texture,
        emissiveIntensity: 0.42,
        roughness: 0.7,
      }),
      pos,
      g,
    );
    m.castShadow = false;
    return m;
  }
  const steamTexture = canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "#ffffffa0");
    g.addColorStop(1, "#ffffff00");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const steam = [];
  function plume(g, position, station) {
    for (let i = 0; i < 7; i++) {
      const sprite = new T.Sprite(
        new T.SpriteMaterial({
          map: steamTexture,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        }),
      );
      g.add(sprite);
      sprite.position.set(...position);
      steam.push({
        sprite,
        origin: new T.Vector3(...position),
        station,
        index: i,
      });
    }
  }
  // Acciaio, manometro, vasca, due gruppi e serbatoio realmente trasparente.
  const c = groups.coffee;
  box([2.55, 1.05, 0.92], steel, [0, 0.05, -0.16], c);
  box([2.7, 0.12, 1.05], copper, [0, 0.63, -0.13], c);
  box([2.4, 0.5, 0.07], black, [0, -0.02, 0.335], c);
  box([2.75, 0.08, 1.22], steel, [0, -0.57, 0], c);
  for (let x = -1.15; x <= 1.15; x += 0.12)
    box([0.035, 0.015, 0.68], black, [x, -0.517, 0.04], c);
  for (const x of [-0.7, 0.4]) {
    cyl(0.105, 0.105, 0.18, steel, [x, -0.13, 0.42], c);
    const handle = cyl(0.06, 0.075, 0.53, black, [x + 0.22, -0.13, 0.52], c);
    handle.rotation.z = Math.PI / 2;
    box([0.25, 0.06, 0.11], copper, [x, -0.27, 0.44], c);
    ball(0.045, glow, [x, 0.25, 0.35], c);
  }
  const gauge = cyl(0.18, 0.18, 0.08, copper, [0.95, 0.25, 0.36], c);
  gauge.rotation.x = Math.PI / 2;
  const dial = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = "#fff3d9";
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "#193c3b";
    ctx.lineWidth = 3;
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * 0.75 + (i * Math.PI * 1.5) / 10;
      ctx.beginPath();
      ctx.moveTo(64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44);
      ctx.lineTo(64 + Math.cos(a) * 53, 64 + Math.sin(a) * 53);
      ctx.stroke();
    }
    ctx.strokeStyle = "#b74932";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(64, 64);
    ctx.lineTo(89, 32);
    ctx.stroke();
    ctx.fillStyle = "#254c46";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText("BAR", 50, 95);
  });
  panel(dial, 0.3, 0.3, [0.95, 0.25, 0.407], c);
  box([0.35, 0.8, 0.65], glass, [-1.49, 0.07, -0.08], c);
  box(
    [0.29, 0.48, 0.58],
    new T.MeshPhysicalMaterial({
      color: "#6ccee0",
      transparent: true,
      opacity: 0.45,
      roughness: 0.15,
    }),
    [-1.49, -0.05, -0.08],
    c,
  );
  box([0.4, 0.07, 0.7], black, [-1.49, 0.5, -0.08], c);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 2; j++) {
      const item = cup(-0.94 + i * 0.59, 0.71 + j * 0.15, -0.16, c);
      item.scale.setScalar(0.7);
      item.userData.fill.visible = false;
    }
  panel(
    signTexture("CAFFÈ", "1 · TAZZA   2 · ESTRAI   3 · DOPPIO"),
    3,
    0.75,
    [0, 1.39, -0.05],
    c,
  );
  plume(c, [-1.1, -0.05, 0.48], "coffee");
  // Distributore, cartoni tipografici, bricco e lancia vapore curva.
  const m = groups.milk;
  box([1.55, 1, 0.85], cream, [0, 0.0, -0.12], m);
  box([1.65, 0.1, 1], copper, [0, 0.55, -0.12], m);
  const display = signTexture("LATTE", "PRONTO  •  SCHIUMA", "#9ce9e2"),
    workingDisplay = signTexture("VAPORE", "PREPARAZIONE IN CORSO", "#f5d191");
  const milkDisplay = panel(display, 1.13, 0.34, [0, 0.2, 0.32], m);
  tube(
    [
      [0.66, 0.3, 0.03],
      [0.98, 0.28, 0.3],
      [1.02, -0.15, 0.42],
    ],
    0.035,
    steel,
    m,
  );
  cyl(0.23, 0.18, 0.46, steel, [0.92, -0.28, 0.38], m);
  const h = mesh(
    new T.TorusGeometry(0.15, 0.025, 8, 16),
    steel,
    [1.15, -0.26, 0.38],
    m,
  );
  h.rotation.y = Math.PI / 2;
  const cartonLabel = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = "#e7f1e7";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#175870";
    ctx.fillRect(0, 0, 256, 85);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 58px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("LATTE", 128, 65);
    ctx.fillStyle = "#65b5ce";
    ctx.beginPath();
    ctx.moveTo(128, 100);
    ctx.bezierCurveTo(65, 165, 85, 204, 128, 204);
    ctx.bezierCurveTo(171, 204, 191, 165, 128, 100);
    ctx.fill();
    ctx.fillStyle = "#174b5b";
    ctx.font = "bold 25px sans-serif";
    ctx.fillText("FRESCO", 128, 239);
  });
  for (let i = 0; i < 2; i++) {
    box([0.34, 0.56, 0.34], cream, [-1.25 - i * 0.45, -0.13, 0.05], m);
    const top = box(
      [0.34, 0.16, 0.32],
      copper,
      [-1.25 - i * 0.45, 0.23, 0.05],
      m,
    );
    top.rotation.z = 0.22;
    panel(cartonLabel, 0.29, 0.36, [-1.25 - i * 0.45, -0.08, 0.227], m);
  }
  box([1.7, 0.08, 1], steel, [0, -0.58, 0.0], m);
  plume(m, [1.02, -0.15, 0.42], "milk");
  panel(
    signTexture("LATTE / SCHIUMA", "E · LATTE   →   E · SCHIUMA", "#aae6f0"),
    3.5,
    0.75,
    [0, 1.6, -0.05],
    m,
  );
  // Vassoio antiscivolo, campanello, terminale e pasticceria sagomata.
  const s = groups.service;
  box([2.5, 0.09, 1.05], glow, [0, -0.09, 0], s);
  const nonSlip = material("#2c4943", 0.9);
  nonSlip.bumpMap = surfaces.grip;
  nonSlip.bumpScale = 0.025;
  box([2.3, 0.025, 0.85], nonSlip, [0, -0.031, 0], s);
  for (const x of [-1.21, 1.21])
    box([0.045, 0.08, 1.02], gold, [x, -0.015, 0], s);
  cyl(0.17, 0.19, 0.08, steel, [1.65, -0.07, 0], s);
  const bell = ball(0.15, copper, [1.65, -0.035, 0], s);
  bell.scale.y = 0.7;
  cyl(0.023, 0.023, 0.07, black, [1.65, 0.11, 0], s);
  box([0.9, 0.65, 0.09], black, [2.5, 0.22, 0.03], s);
  const orderScreen = canvasTexture(512, 320, () => {});
  panel(orderScreen, 0.82, 0.5, [2.5, 0.23, -0.021], s).rotation.y = Math.PI;
  panel(orderScreen, 0.82, 0.5, [2.5, 0.23, 0.081], s);
  let orderSignature = null;
  const pastryGroup = new T.Group();
  pastryGroup.position.set(-3.35, 0, 0);
  s.add(pastryGroup);
  box([2.2, 0.07, 1.1], steel, [0, -0.1, 0], pastryGroup);
  for (const z of [-0.5, 0.5])
    box([2.2, 0.8, 0.035], glass, [0, 0.31, z], pastryGroup);
  for (const x of [-1.1, 1.1])
    box([0.035, 0.8, 1], glass, [x, 0.31, 0], pastryGroup);
  box([2.2, 0.035, 1.1], glass, [0, 0.71, 0], pastryGroup);
  const dough = material("#c38b4a"),
    icing = material("#e8bd99");
  for (let i = 0; i < 3; i++) {
    const x = -0.7 + i * 0.65;
    const donut = mesh(
      new T.TorusGeometry(0.15, 0.072, 10, 20),
      dough,
      [x, 0.03, 0.23],
      pastryGroup,
    );
    donut.rotation.x = Math.PI / 2;
    const frosting = mesh(
      new T.TorusGeometry(0.15, 0.055, 8, 20),
      icing,
      [x, 0.075, 0.23],
      pastryGroup,
    );
    frosting.rotation.x = Math.PI / 2;
    const croissant = new T.Group();
    croissant.position.set(x, 0.06, -0.23);
    pastryGroup.add(croissant);
    for (let j = 0; j < 7; j++) {
      const a = (j / 6) * Math.PI * 0.9;
      const part = ball(
        0.09 + Math.sin((j / 6) * Math.PI) * 0.04,
        dough,
        [Math.cos(a) * 0.19, 0, Math.sin(a) * 0.13],
        croissant,
      );
      part.scale.set(0.8, 0.8, 1.5);
      part.rotation.y = -a;
    }
  }
  const serviceSign = signTexture(
    "CONSEGNA",
    "PUNTA IL CLIENTE O IL VASSOIO",
    "#f3d083",
    "bell",
  );
  panel(serviceSign, 3.5, 0.75, [0, 1.6, 0.09], s).rotation.y = Math.PI;
  panel(serviceSign, 3.5, 0.75, [0, 1.6, 0.11], s);
  const light = new T.PointLight("#ffe8b9", 11, 8, 2);
  light.position.set(0, 2, -1.1);
  s.add(light);
  return {
    groups,
    update(time, preparing, orders = []) {
      const signature = orders
        .map((order) => `${order.id}:${pendingDrinks(order).join(",")}`)
        .join(";");
      if (signature !== orderSignature) {
        orderSignature = signature;
        const ctx = orderScreen.image.getContext("2d");
        ctx.fillStyle = "#102c31";
        ctx.fillRect(0, 0, 512, 320);
        ctx.fillStyle = "#f4d38d";
        ctx.font = "bold 38px sans-serif";
        ctx.fillText("ORDINI IN CORSO", 20, 50);
        orders.forEach((order, index) => {
          ctx.fillStyle = order.variant === "vip" ? "#f4d38d" : "#bce5ca";
          ctx.font = "bold 23px sans-serif";
          ctx.fillText(
            `#${order.id} ${order.variant === "vip" ? "VIP " : ""}${pendingDrinks(
              order,
            )
              .map((type) => DRINK_NAMES[type])
              .join(" + ")}`,
            20,
            113 + index * 70,
          );
        });
        orderScreen.needsUpdate = true;
      }
      const busy = preparing.includes("milk");
      milkDisplay.material.map = busy ? workingDisplay : display;
      milkDisplay.material.emissiveMap = milkDisplay.material.map;
      milkDisplay.material.emissiveIntensity = busy ? 0.7 : 0.42;
      for (const effect of steam) {
        const active = preparing.includes(effect.station);
        effect.sprite.visible = active;
        const phase = (time * 0.6 + effect.index / 7) % 1;
        effect.sprite.position
          .copy(effect.origin)
          .add(
            new T.Vector3(
              Math.sin(phase * 4 + effect.index) * phase * 0.22,
              phase * 0.95,
              0,
            ),
          );
        effect.sprite.scale.setScalar(0.12 + phase * 0.34);
        effect.sprite.material.opacity = active ? (1 - phase) * 0.26 : 0;
      }
    },
  };
}
