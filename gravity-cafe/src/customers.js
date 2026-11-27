import * as T from "three";
import { CUSTOMER_COLORS } from "./avatars.js";
import { pendingDrinks, DRINK_NAMES } from "./gameplay.js";

// Sei istanze riutilizzate: tre clienti attivi e spazio per chi sta uscendo.
// Nessun timer separato: pause, orbite e animazioni usano il clock del gioco.
export function createCustomers(parent, { person, onAgitate = () => {} }) {
  const pool = Array.from({ length: 6 }, (_, index) => {
    const group = new T.Group(),
      body = person(CUSTOMER_COLORS[index % 3], true);
    group.add(body);
    parent.add(group);
    body.scale.setScalar(1);
    group.visible = false;
    const redLight = new T.PointLight("#ff5d47", 0, 3, 2);
    redLight.position.set(0, 2, 0);
    group.add(redLight);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const badge = new T.Sprite(
      new T.SpriteMaterial({
        map: texture,
        depthTest: true,
        transparent: true,
      }),
    );
    badge.position.set(0, 2.32, 0);
    badge.scale.set(1.7, 0.85, 1);
    group.add(badge);
    const proxy = new T.Mesh(
      new T.BoxGeometry(0.85, 1.8, 0.7),
      new T.MeshBasicMaterial({ visible: false }),
    );
    proxy.position.y = 0.95;
    group.add(proxy);
    return {
      group,
      body,
      badge,
      texture,
      canvas,
      proxy,
      redLight,
      order: null,
      phase: "idle",
      age: 0,
      signature: "",
      lastBump: -10,
      color: index % 3,
    };
  });
  function reset() {
    pool.forEach((customer) => {
      customer.order = null;
      customer.phase = "idle";
      customer.group.visible = false;
      customer.signature = "";
    });
  }
  function served(id, complete = true) {
    const c = pool.find((c) => c.order?.id === id && c.phase !== "leaving");
    if (c) {
      c.celebrate = complete ? 1.2 : 0.5;
      if (complete) {
        c.phase = "leaving";
        c.age = 0;
        c.happy = true;
      }
    }
  }
  function drawBadge(c) {
    const o = c.order,
      remaining = pendingDrinks(o),
      ratio = Math.max(0, o.time / o.total),
      urgent = ratio < 0.25;
    const signature = `${o.id}:${remaining.join(",")}:${Math.ceil(o.time)}:${c.phase}:${c.happy}:${urgent}`;
    if (signature === c.signature) return;
    c.signature = signature;
    const ctx = c.canvas.getContext("2d");
    ctx.clearRect(0, 0, 512, 256);
    ctx.fillStyle = urgent ? "#481e29" : "#102e38";
    ctx.beginPath();
    ctx.roundRect(8, 8, 496, 230, 24);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = urgent
      ? "#ff715b"
      : o.variant === "vip"
        ? "#f5cf73"
        : CUSTOMER_COLORS[o.customer ?? 0];
    ctx.stroke();
    ctx.fillStyle = CUSTOMER_COLORS[o.customer ?? 0];
    ctx.beginPath();
    ctx.arc(48, 42, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff2d4";
    ctx.textAlign = "left";
    ctx.font = "bold 27px sans-serif";
    ctx.fillText(
      `#${o.id} ${o.variant === "vip" ? "VIP ×2" : o.variant === "double" ? "ORDINE DOPPIO" : "IL MIO ORDINE"}`,
      78,
      52,
    );
    const types = remaining.length ? remaining : [c.happy ? "done" : o.type];
    types.forEach((type, index) => {
      const x = types.length === 1 ? 235 : 145 + index * 220;
      ctx.fillStyle =
        type === "espresso" || type === "doppio"
          ? "#9b673a"
          : type === "latte"
            ? "#dcb88e"
            : "#fff3d8";
      ctx.fillRect(x - 27, 79, 58, 42);
      ctx.strokeStyle = "#f8ecd3";
      ctx.lineWidth = 5;
      ctx.strokeRect(x - 27, 77, 58, 45);
      ctx.beginPath();
      ctx.arc(x + 33, 96, 12, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.font =
        types.length === 1 ? "bold 31px sans-serif" : "bold 23px sans-serif";
      ctx.fillStyle = "#ffefce";
      ctx.textAlign = "center";
      ctx.fillText(type === "done" ? "GRAZIE!" : DRINK_NAMES[type], x, 162);
    });
    ctx.fillStyle = "#3c5558";
    ctx.fillRect(30, 192, 452, 20);
    ctx.fillStyle = urgent
      ? "#ff735e"
      : o.variant === "vip"
        ? "#f4c760"
        : "#9cd4a5";
    ctx.fillRect(30, 192, 452 * ratio, 20);
    ctx.font = "18px sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#f5ecd4";
    ctx.fillText(`${Math.ceil(o.time)}s`, 477, 235);
    c.texture.needsUpdate = true;
  }
  function update(
    dt,
    state,
    orders,
    service,
    { menu = false, floor = 0.13 } = {},
  ) {
    const current = menu
      ? [0, 1, 2].map((i) => ({
          id: -i - 1,
          type: ["espresso", "latte", "cappuccino"][i],
          time: 110,
          total: 110,
          customer: i,
        }))
      : orders;
    for (const c of pool)
      if (
        c.order &&
        !current.some((order) => order.id === c.order.id) &&
        c.phase !== "leaving"
      ) {
        c.phase = "leaving";
        c.age = 0;
        c.happy = false;
      }
    for (const order of current) {
      if (pool.some((c) => c.order?.id === order.id && c.phase !== "leaving"))
        continue;
      let c =
        pool.find(
          (c) => c.phase === "idle" && c.color === (order.customer ?? 0),
        ) ?? pool.find((c) => c.phase === "idle");
      if (!c)
        c = pool
          .filter((c) => c.phase === "leaving")
          .sort((a, b) => b.age - a.age)[0];
      if (!c) continue;
      const used = new Set(
        pool
          .filter(
            (other) =>
              other !== c &&
              other.order &&
              other.phase !== "leaving" &&
              other.phase !== "idle",
          )
          .map((other) => other.slot),
      );
      const slot = [0, 1, 2].find((slot) => !used.has(slot)) ?? 0;
      Object.assign(c, {
        order,
        slot,
        phase: "arriving",
        age: 0,
        celebrate: 0,
        happy: false,
        signature: "",
        lastBump: state.elapsed,
      });
      c.body.userData.customerAppearance = {
        kind: order.customer ?? 0,
        vip: order.variant === "vip",
      };
      c.group.visible = true;
      c.body.userData.actor?.model?.traverse((node) => {
        if (!node.isMesh) return;
        for (const material of Array.isArray(node.material)
          ? node.material
          : [node.material])
          if (material.name === "Outfit")
            material.color.set(CUSTOMER_COLORS[order.customer ?? 0]);
      });
    }
    const inward = new T.Vector3(-service.x, 0, -service.z);
    if (inward.length() < 0.1) inward.set(0, 0, -1);
    inward.normalize();
    const tangent = new T.Vector3(-inward.z, 0, inward.x);
    for (const c of pool) {
      if (!c.order || c.phase === "idle") continue;
      const slot = c.slot;
      c.age += dt;
      c.celebrate = Math.max(0, (c.celebrate ?? 0) - dt);
      const position = new T.Vector3(service.x, floor, service.z)
        .addScaledVector(inward, 1.55)
        .addScaledVector(tangent, (slot - 1) * 1.8);
      if (c.phase === "arriving") {
        position.addScaledVector(tangent, (1 - Math.min(1, c.age / 1.1)) * 4);
        if (c.age >= 1.1) c.phase = "waiting";
      }
      if (c.phase === "leaving") {
        position.copy(c.group.position);
        if (c.age > 1.2) position.addScaledVector(tangent, dt * 2.8);
        if (c.age > 3.2) {
          c.phase = "idle";
          c.order = null;
          c.group.visible = false;
          continue;
        }
      }
      const ratio = c.order.time / c.order.total,
        urgent = ratio < 0.25 && c.phase === "waiting";
      c.urgent = urgent;
      c.redLight.intensity = urgent
        ? 1.5 + Math.sin(state.elapsed * 10) * 0.4
        : 0;
      if (c.phase !== "leaving")
        position.y += state.gravity
          ? 0
          : Math.sin(state.elapsed * 1.8 + slot) * 0.1;
      c.group.position.copy(position);
      c.body.rotation.y =
        c.phase === "leaving" && c.age > 1.2
          ? Math.atan2(tangent.x, tangent.z)
          : c.phase === "arriving"
            ? Math.atan2(-tangent.x, -tangent.z)
            : Math.atan2(inward.x, inward.z);
      c.body.position.y =
        c.celebrate > 0
          ? Math.abs(Math.sin(c.age * 9)) * 0.22
          : urgent
            ? Math.sin(state.elapsed * 18) * 0.035
            : 0;
      c.body.rotation.z = urgent ? Math.sin(state.elapsed * 16) * 0.09 : 0;
      c.body.userData.customerAnimation =
        c.celebrate > 0
          ? "Cheer"
          : c.phase === "arriving" || c.phase === "leaving"
            ? "Walk"
            : urgent
              ? "Hurry"
              : !state.gravity
                ? "Float"
                : "Idle";
      c.proxy.userData.target =
        c.phase === "waiting" || c.phase === "arriving"
          ? { kind: "customer", station: "service", orderId: c.order.id }
          : null;
      c.badge.visible = c.phase !== "leaving" || !!c.happy;
      if (
        urgent &&
        !state.gravity &&
        dt > 0 &&
        state.elapsed - c.lastBump > 3
      ) {
        c.lastBump = state.elapsed;
        onAgitate(c.group.position);
      }
      drawBadge(c);
    }
  }
  return {
    update,
    reset,
    served,
    pool,
    targets: () =>
      pool
        .filter((c) => c.order && c.phase !== "leaving" && c.phase !== "idle")
        .map((c) => c.proxy),
  };
}
