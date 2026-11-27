import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createState,
  LEVELS,
  advanceState,
  serveDrink,
  formatTime,
} from "./game-state.js";

function activeState(options) {
  return { ...createState(0, options), running: true };
}
function order(type = "espresso", time = 60) {
  return { type, time };
}

test("gravity changes on schedule and pause freezes all clocks", () => {
  const s = activeState();
  advanceState(s, LEVELS[0].gravityInterval);
  assert.equal(s.gravity, 0);
  s.paused = true;
  const before = structuredClone(s);
  advanceState(s, 10);
  assert.deepEqual(s, before);
});

test("serving a matching order consumes it and rewards the combo", () => {
  const s = activeState();
  const orders = [order("latte"), order()];
  assert.equal(serveDrink(s, "espresso", orders), true);
  assert.deepEqual(orders, [order("latte")]);
  assert.equal(s.score, 100);
  assert.equal(s.combo, 1);
  assert.equal(s.served, 1);
});

test("wrong, empty, unknown or unsolicited drinks do not mutate state or orders", () => {
  for (const type of ["latte", null, undefined, "", "tea"]) {
    const s = activeState();
    const orders = [order()];
    const before = structuredClone({ s, orders });
    assert.equal(serveDrink(s, type, orders), false);
    assert.deepEqual({ s, orders }, before);
  }
  const s = activeState();
  const before = structuredClone(s);
  assert.equal(serveDrink(s, "espresso", []), false);
  assert.equal(serveDrink(s, "espresso"), false);
  assert.deepEqual(s, before);
});

test("paused or inactive shifts cannot serve orders", () => {
  for (const overrides of [{ paused: true }, { running: false }]) {
    const s = { ...activeState(), ...overrides };
    const orders = [order()];
    const before = structuredClone({ s, orders });
    assert.equal(serveDrink(s, "espresso", orders), false);
    assert.deepEqual({ s, orders }, before);
  }
});

test("expired orders cannot be served before the UI removes them", () => {
  for (const time of [0, -1]) {
    const s = activeState();
    const orders = [order("espresso", time)];
    const before = structuredClone({ s, orders });
    assert.equal(serveDrink(s, "espresso", orders), false);
    assert.deepEqual({ s, orders }, before);
  }
});

test("only one valid matching order is consumed, skipping expired ones", () => {
  const s = activeState();
  const expired = order("espresso", 0);
  const first = order();
  const second = order();
  const orders = [expired, first, second];
  assert.equal(serveDrink(s, "espresso", orders), true);
  assert.deepEqual(orders, [expired, second]);
  assert.equal(s.served, 1);
});

test("two players cannot score twice for the same order", () => {
  const s = activeState();
  const orders = [order("latte")];
  assert.equal(serveDrink(s, "latte", orders), true);
  const afterFirst = structuredClone(s);
  assert.equal(serveDrink(s, "latte", orders), false);
  assert.deepEqual(s, afterFirst);
});

test("consecutive orders increase reward up to the combo cap", () => {
  const s = activeState();
  const orders = Array.from({ length: 6 }, () => order());
  for (let i = 0; i < 6; i++)
    assert.equal(serveDrink(s, "espresso", orders), true);
  assert.equal(s.score, 950);
  assert.equal(s.combo, 6);
  assert.equal(s.served, 6);
});

test("shift ends at zero and stays stopped", () => {
  const s = activeState();
  advanceState(s, LEVELS[0].duration + 1);
  assert.equal(s.remaining, 0);
  assert.equal(s.running, false);
  const before = structuredClone(s);
  advanceState(s, 10);
  assert.deepEqual(s, before);
  assert.equal(formatTime(65), "01:05");
});

test("large time steps preserve gravity cycle parity", () => {
  const s = activeState();
  advanceState(s, LEVELS[0].gravityInterval * 3 + 1);
  assert.equal(s.gravity, 0);
  assert.equal(s.gravityClock, LEVELS[0].gravityInterval - 1);
});

test("practice freezes the shift timer without stopping gravity or elapsed time", () => {
  const s = activeState({ practice: true });
  advanceState(s, 181);
  assert.equal(s.remaining, LEVELS[0].duration);
  assert.equal(s.running, true);
  assert.equal(s.elapsed, 181);
  assert.equal(s.gravity, 0);
  assert.equal(s.gravityClock, 11);
});

test("enabling practice just before timeout and disabling it resumes the countdown", () => {
  const s = activeState();
  advanceState(s, LEVELS[0].duration - 0.5);
  s.practice = true;
  advanceState(s, 100);
  assert.equal(s.remaining, 0.5);
  assert.equal(s.running, true);
  s.practice = false;
  advanceState(s, 0.5);
  assert.equal(s.remaining, 0);
  assert.equal(s.running, false);
});

test("practice with a zero timer never temporarily ends or revives the shift", () => {
  const s = activeState({ practice: true });
  s.remaining = 0;
  advanceState(s, 2);
  assert.equal(s.remaining, 0);
  assert.equal(s.running, true);
  s.running = false;
  const before = structuredClone(s);
  advanceState(s, 2);
  assert.deepEqual(s, before);
});

test("pause still freezes gravity and elapsed time during practice", () => {
  const s = { ...activeState({ practice: true }), paused: true };
  const before = structuredClone(s);
  advanceState(s, 100);
  assert.deepEqual(s, before);
});

test("practice orders ignore expiry but still require the correct recipe", () => {
  const s = activeState({ practice: true });
  const orders = [order("latte", 0)];
  assert.equal(serveDrink(s, "espresso", orders), false);
  assert.equal(serveDrink(s, "latte", orders), true);
});

test("practice preference can be retained across restarts and level changes", () => {
  const old = activeState({ practice: true });
  const s = createState(2, { practice: old.practice });
  assert.equal(s.practice, true);
  assert.equal(s.remaining, LEVELS[2].duration);
  assert.equal(s.running, false);
});

test("invalid time steps cannot corrupt clocks", () => {
  for (const dt of [-1, 0, NaN, Infinity]) {
    const s = activeState();
    const before = structuredClone(s);
    advanceState(s, dt);
    assert.deepEqual(s, before);
  }
});

test("order timers freeze throughout modal pause and resume without catch-up", async () => {
  const { advanceOrders } = await import("./game-state.js");
  const s = activeState();
  const orders = [order("espresso", 10), order("latte", 20)];
  advanceOrders(s, orders, 2);
  assert.deepEqual(
    orders.map((o) => o.time),
    [8, 18],
  );
  s.paused = true;
  const before = structuredClone(orders);
  advanceOrders(s, orders, 600);
  advanceState(s, 600);
  assert.deepEqual(orders, before);
  s.paused = false;
  advanceOrders(s, orders, 1);
  assert.deepEqual(
    orders.map((o) => o.time),
    [7, 17],
  );
});

test("orders never expire in practice or after the shift has stopped", async () => {
  const { advanceOrders } = await import("./game-state.js");
  const s = activeState({ practice: true }),
    orders = [order("espresso", 1)];
  assert.equal(advanceOrders(s, orders, 100), false);
  assert.equal(orders[0].time, 1);
  s.practice = false;
  s.running = false;
  assert.equal(advanceOrders(s, orders, 100), false);
  assert.equal(orders[0].time, 1);
});

test("order expiry is clamped and resets the combo exactly when due", async () => {
  const { advanceOrders } = await import("./game-state.js");
  const s = activeState();
  s.combo = 3;
  const orders = [order("espresso", 1), order("latte", 10)];
  assert.equal(advanceOrders(s, orders, 2), true);
  assert.equal(s.combo, 0);
  assert.deepEqual(
    orders.map((o) => o.time),
    [0, 8],
  );
});

test("order countdown cannot run beyond the remaining shift or invalid delta", async () => {
  const { advanceOrders } = await import("./game-state.js");
  const s = activeState();
  s.remaining = 0.5;
  const orders = [order("espresso", 10)];
  advanceOrders(s, orders, 30);
  assert.equal(orders[0].time, 9.5);
  for (const dt of [-1, NaN, Infinity]) advanceOrders(s, orders, dt);
  assert.equal(orders[0].time, 9.5);
});

test("using practice invalidates this shift's record even after disabling it", () => {
  const s = activeState();
  assert.equal(s.practiceUsed, false);
  s.practice = true;
  advanceState(s, 1);
  s.practice = false;
  advanceState(s, 1);
  assert.equal(s.practiceUsed, true);
  assert.equal(createState(0).practiceUsed, false);
});

test("double tickets consume one drink at a time and pay only once on completion", () => {
  const s = activeState(),
    ticket = {
      id: 9,
      type: "cappuccino",
      time: 100,
      variant: "double",
      items: [
        { type: "cappuccino", delivered: false },
        { type: "espresso", delivered: false },
      ],
    },
    orders = [ticket];
  assert.equal(serveDrink(s, "espresso", orders, 9), true);
  assert.equal(orders.length, 1);
  assert.equal(s.score, 0);
  assert.equal(s.served, 0);
  const partial = structuredClone({ s, orders });
  assert.equal(serveDrink(s, "espresso", orders, 9), false);
  assert.deepEqual({ s, orders }, partial);
  assert.equal(serveDrink(s, "cappuccino", orders, 9), true);
  assert.equal(s.score, 200);
  assert.equal(s.served, 1);
  assert.equal(orders.length, 0);
  assert.equal(serveDrink(s, "cappuccino", orders, 9), false);
  assert.equal(s.score, 200);
});
test("looking at a different customer cannot consume another customer’s matching ticket", () => {
  const s = activeState(),
    orders = [
      { id: 1, type: "espresso", time: 100 },
      { id: 2, type: "latte", time: 100 },
    ];
  const before = structuredClone({ s, orders });
  assert.equal(serveDrink(s, "espresso", orders, 2), false);
  assert.deepEqual({ s, orders }, before);
  assert.equal(serveDrink(s, "espresso", orders, 1), true);
  assert.equal(orders[0].id, 2);
});
test("VIP rewards and penalties are double, without changing the missed-customer count", async () => {
  const { makeOrder, orderPenalty } = await import("./gameplay.js");
  const s = activeState(),
    vip = makeOrder(6, () => 0, { elapsed: 50 });
  assert.equal(serveDrink(s, "espresso", [vip]), true);
  assert.equal(s.score, 200);
  assert.equal(s.served, 1);
  assert.equal(s.missed, 0);
  assert.equal(orderPenalty(vip), 50);
  assert.equal(orderPenalty(makeOrder(0)), 25);
});
test("an expired partial ticket cannot be completed, but practice still supports partial deliveries", () => {
  const ticket = {
    id: 1,
    type: "espresso",
    time: 1,
    items: [
      { type: "espresso", delivered: false },
      { type: "cappuccino", delivered: false },
    ],
  };
  const s = activeState(),
    orders = [ticket];
  serveDrink(s, "espresso", orders);
  ticket.time = 0;
  const before = structuredClone({ s, orders });
  assert.equal(serveDrink(s, "cappuccino", orders), false);
  assert.deepEqual({ s, orders }, before);
  s.practice = true;
  assert.equal(serveDrink(s, "cappuccino", orders), true);
  assert.equal(orders.length, 0);
});
