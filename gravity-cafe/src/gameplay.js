export const STAR_TARGETS = [450, 900, 1500];
export const DRINK_NAMES = {
  empty: "Tazza vuota",
  espresso: "Espresso",
  latte: "Caffellatte",
  cappuccino: "Cappuccino",
  doppio: "Doppio espresso",
};

export function preparationFor(station, drink) {
  if (station === "coffee" && drink === "empty")
    return {
      station,
      source: drink,
      result: "espresso",
      duration: 1.35,
      elapsed: 0,
      label: "Estrazione espresso",
    };
  if (station === "coffee" && drink === "espresso")
    return {
      station,
      source: drink,
      result: "doppio",
      duration: 1.1,
      elapsed: 0,
      label: "Seconda estrazione",
    };
  if (station === "milk" && drink === "espresso")
    return {
      station,
      source: drink,
      result: "latte",
      duration: 1,
      elapsed: 0,
      label: "Versando il latte",
    };
  if (station === "milk" && drink === "latte")
    return {
      station,
      source: drink,
      result: "cappuccino",
      duration: 0.85,
      elapsed: 0,
      label: "Montando la schiuma",
    };
  return null;
}

export function advancePreparation(
  job,
  dt,
  { running, paused, station, drink },
) {
  if (!running || paused || !Number.isFinite(dt) || dt <= 0) return "waiting";
  if (station !== job.station || drink !== job.source) return "cancelled";
  job.elapsed = Math.min(job.duration, job.elapsed + dt);
  return job.elapsed >= job.duration ? "complete" : "working";
}

export function starsFor(score) {
  return STAR_TARGETS.filter((target) => score >= target).length;
}

export function nextObjective(drink, orders) {
  if (!drink || drink === "empty") return "coffee";
  if (
    orders.some(
      (order) => pendingDrinks(order).includes(drink) && order.time > 0,
    )
  )
    return "service";
  if (
    drink === "espresso" &&
    orders.some(
      (order) => pendingDrinks(order).includes("doppio") && order.time > 0,
    )
  )
    return "coffee";
  return ["cappuccino", "doppio"].includes(drink) ? "service" : "milk";
}

// Compatibilità con gli scontrini singoli preesistenti; le consegne parziali
// vengono consumate una sola volta, senza premiare un ordine ancora incompleto.
export function pendingDrinks(order) {
  return order.items
    ? order.items.filter((item) => !item.delivered).map((item) => item.type)
    : [order.type];
}
export function orderPenalty(order) {
  return order.variant === "vip" ? 50 : 25;
}
export function makeOrder(serial, random = Math.random, { elapsed = 0 } = {}) {
  const types = ["espresso", "latte", "cappuccino"];
  let type = types[serial % 3];
  if (elapsed >= 75 && serial % 5 === 4) type = "doppio";
  const variant =
    elapsed >= 90 && serial % 4 === 0
      ? "double"
      : elapsed >= 45 && serial % 3 === 0
        ? "vip"
        : "regular";
  const items = (
    variant === "double"
      ? [type, type === "cappuccino" ? "espresso" : "cappuccino"]
      : [type]
  ).map((type) => ({ type, delivered: false }));
  const complex =
    items.length > 1 ||
    items.some((item) => ["cappuccino", "doppio"].includes(item.type));
  const base = 95 + Math.floor(Math.min(0.999999, Math.max(0, random())) * 26);
  const time = (base + (complex ? 20 : 0)) * (variant === "vip" ? 0.72 : 1);
  return {
    id: serial + 1,
    type,
    items,
    variant,
    customer: serial % 3,
    time,
    total: time,
  };
}
