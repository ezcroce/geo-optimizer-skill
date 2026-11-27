import { pendingDrinks } from "./gameplay.js";
import { getMapEnvironment } from "./map-mechanics.js";

export const LEVELS = [
  {
    name: "Orbita tranquilla",
    subtitle: "Il tuo primo turno tra le stelle",
    tag: "CLASSICO",
    duration: 240,
    gravityInterval: 32,
  },
  {
    name: "La stazione rotante",
    subtitle: "Un nuovo punto di vista. Ogni volta.",
    tag: "ROTANTE",
    duration: 240,
    gravityInterval: 25,
  },
  {
    name: "Un caffè nel vuoto",
    subtitle: "Attenzione al buco nero da tavolo.",
    tag: "BUCO NERO",
    duration: 210,
    gravityInterval: 22,
  },
  {
    name: "Il Nucleo in Ebollizione",
    subtitle: "Tre piani. Un guasto. Nessun caffè al sicuro.",
    tag: "MELT-CORE",
    duration: 300,
    gravityInterval: 45,
    difficulty: "Difficile",
    brief:
      "E sugli ascensori per cambiare piano. Caffè al piano 1, latte al 2. Ogni 45s: pavimento rovente e 15s di 0G! R/F cambia quota in volo; il ventilatore centrale ti catapulta in alto. Durante il guasto servi al piano 2.",
  },
  {
    name: "L’Osservatorio Zen",
    subtitle: "Respira. Le piante hanno altri programmi.",
    tag: "BOTANICAL",
    duration: 300,
    gravityInterval: 18,
    difficulty: "Intermedio",
    brief:
      "Caffè e latte al centro. Servi sul tavolo orbitante con l’anello dorato. Il campo passa da normale a nord, soffitto e radiale. E vicino a una liana ti dà slancio; urtarla in velocità libera spore.",
  },
  {
    name: "Il Crogiolo Magnetico",
    subtitle: "Nord, sud. Il caffè segue il campo.",
    tag: "MAGNETIC",
    duration: 270,
    gravityInterval: 20,
    difficulty: "Intermedio",
    brief:
      "La polarità cambia ogni 20s. In 0G il campo ti trascina verso le pareti: gli anelli ciano sul pavimento sono piastre di ancoraggio. Caffè e latte sui bracci opposti della croce.",
  },
  {
    name: "La Serra Criogenica",
    subtitle: "Ghiaccio sotto i piedi, cristalli nella tazza.",
    tag: "CRYO",
    duration: 300,
    gravityInterval: 24,
    difficulty: "Intermedio",
    brief:
      "Sulle passerelle azzurre l’attrito è ridotto del 75%, anche in 1G. Shift frena. I getti di azoto sollevano corpi e tazze; in 0G i cristalli deviano le tazze lanciate.",
  },
  {
    name: "Il Reattore a Impulsi",
    subtitle: "Tre secondi per trovare un riparo.",
    tag: "REACTOR",
    duration: 300,
    gravityInterval: 16,
    difficulty: "Difficile",
    brief:
      "Ogni 16s un impulso radiale: il conto alla rovescia di 3s ti avverte. Riparati dietro banconi o paratie; seguono 12s di 0G turbolenta. La consegna è sul ponte: raggiungilo dalla rampa centrale o in volo con R/F.",
  },
];
export const DRINK_TYPES = Object.freeze([
  "espresso",
  "latte",
  "cappuccino",
  "doppio",
]);

export function createState(level = 0, { practice = false } = {}) {
  return {
    level,
    running: false,
    paused: false,
    remaining: LEVELS[level].duration,
    elapsed: 0,
    gravity: 1,
    gravityClock: LEVELS[level].gravityInterval,
    score: 0,
    served: 0,
    combo: 0,
    spills: 0,
    missed: 0,
    practice,
    practiceUsed: practice,
  };
}
export function advanceState(state, dt) {
  if (!state.running || state.paused || !Number.isFinite(dt) || dt <= 0) return;
  if (state.practice) state.practiceUsed = true;
  else state.remaining = Math.max(0, state.remaining - dt);
  state.elapsed += dt;
  const environment = getMapEnvironment(state.level, state.elapsed);
  if (environment) {
    state.gravity = environment.gravity;
    state.gravityClock = environment.clock;
  } else {
    state.gravityClock -= dt;
    while (state.gravityClock <= 0) {
      state.gravity = 1 - state.gravity;
      state.gravityClock += LEVELS[state.level].gravityInterval;
    }
  }
  if (!state.practice && state.remaining === 0) state.running = false;
}

// Usa lo stesso gate dei clock del turno, anche quando una modale è aperta.
export function advanceOrders(state, orders, dt) {
  if (
    !state.running ||
    state.paused ||
    state.practice ||
    !Number.isFinite(dt) ||
    dt <= 0
  )
    return false;
  const activeTime = Math.min(dt, state.remaining);
  let expired = false;
  for (const order of orders) {
    order.time = Math.max(0, order.time - activeTime);
    if (order.time === 0) expired = true;
  }
  if (expired) state.combo = 0;
  return expired;
}

// La bevanda appartiene al singolo giocatore nel mondo, non allo stato condiviso.
// Consuma un solo ordine valido; in caso di rifiuto non modifica nulla.
export function serveDrink(state, type, orders = [], orderId = undefined) {
  if (!state.running || state.paused || !DRINK_TYPES.includes(type))
    return false;
  const index = orders.findIndex(
    (order) =>
      (orderId === undefined || order.id === orderId) &&
      pendingDrinks(order).includes(type) &&
      (state.practice || order.time > 0),
  );
  if (index < 0) return false;
  const order = orders[index];
  if (order.items) {
    const item = order.items.find(
      (item) => !item.delivered && item.type === type,
    );
    item.delivered = true;
    if (pendingDrinks(order).length) {
      order.type = pendingDrinks(order)[0];
      return true;
    }
  }
  orders.splice(index, 1);
  state.combo++;
  state.score +=
    (100 + Math.min(4, state.combo - 1) * 25) *
    (order.variant === "vip" ? 2 : 1) *
    (order.items?.length ?? 1);
  state.served++;
  return true;
}
export function formatTime(seconds) {
  const s = Math.ceil(seconds);
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}
