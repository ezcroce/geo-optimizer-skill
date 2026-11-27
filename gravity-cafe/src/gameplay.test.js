import { test } from "node:test";
import assert from "node:assert/strict";
import {
  preparationFor,
  advancePreparation,
  starsFor,
  nextObjective,
  makeOrder,
} from "./gameplay.js";
const active = {
  running: true,
  paused: false,
  station: "coffee",
  drink: "empty",
};
test("a cup must be taken before espresso can be brewed", () => {
  assert.equal(preparationFor("coffee", null), null);
  assert.equal(preparationFor("coffee", "espresso").result, "doppio");
  assert.equal(preparationFor("coffee", "empty").result, "espresso");
});
test("preparations require time, and complete only at their duration", () => {
  const job = preparationFor("coffee", "empty");
  assert.equal(advancePreparation(job, 0.7, active), "working");
  assert.equal(advancePreparation(job, 0.7, active), "complete");
  assert.equal(job.elapsed, job.duration);
});
test("pause freezes extraction and cannot finish it in the background", () => {
  const job = preparationFor("coffee", "empty");
  assert.equal(
    advancePreparation(job, 10, { ...active, paused: true }),
    "waiting",
  );
  assert.equal(job.elapsed, 0);
});
test("leaving a station or losing the cup cancels preparation", () => {
  for (const context of [
    { ...active, station: null },
    { ...active, drink: null },
  ]) {
    const job = preparationFor("coffee", "empty");
    assert.equal(advancePreparation(job, 0.1, context), "cancelled");
    assert.equal(job.elapsed, 0);
  }
});
test("milk and foam are two distinct preparation stages", () => {
  assert.equal(preparationFor("milk", "empty"), null);
  assert.equal(preparationFor("milk", "espresso").result, "latte");
  assert.equal(preparationFor("milk", "latte").result, "cappuccino");
  assert.equal(preparationFor("milk", "cappuccino"), null);
});
test("real score thresholds determine success and three-star mastery", () => {
  assert.equal(starsFor(0), 0);
  assert.equal(starsFor(449), 0);
  assert.equal(starsFor(450), 1);
  assert.equal(starsFor(900), 2);
  assert.equal(starsFor(1500), 3);
});
test("world guidance follows the held recipe and active orders", () => {
  assert.equal(nextObjective(null, []), "coffee");
  assert.equal(nextObjective("empty", []), "coffee");
  assert.equal(
    nextObjective("espresso", [{ type: "espresso", time: 5 }]),
    "service",
  );
  assert.equal(
    nextObjective("espresso", [{ type: "espresso", time: 0 }]),
    "milk",
  );
  assert.equal(
    nextObjective("latte", [{ type: "cappuccino", time: 5 }]),
    "milk",
  );
});
test("new orders have bounded patience, unique serial ids and rotating recipes", () => {
  for (let i = 0; i < 1000; i++) {
    const order = makeOrder(i, () => 0.5);
    assert.equal(order.id, i + 1);
    assert.ok(order.time >= 95 && order.time <= 140);
    assert.equal(order.total, order.time);
  }
  assert.deepEqual(
    [0, 1, 2].map((i) => makeOrder(i).type),
    ["espresso", "latte", "cappuccino"],
  );
});

test("expanded-room order patience has exact endpoints and a fixed complex-recipe bonus", () => {
  assert.equal(makeOrder(0, () => 0).time, 95);
  assert.equal(makeOrder(0, () => 1).time, 120);
  assert.equal(makeOrder(2, () => 0).time, 115);
  assert.equal(makeOrder(2, () => 1).time, 140);
});
test("VIPs, second extractions and demanding customers are introduced progressively", () => {
  assert.equal(makeOrder(3, () => 0.5, { elapsed: 44 }).variant, "regular");
  const vip = makeOrder(3, () => 0.5, { elapsed: 45 });
  assert.equal(vip.variant, "vip");
  assert.equal(vip.time, makeOrder(3, () => 0.5).time * 0.72);
  assert.equal(makeOrder(4, () => 0.5, { elapsed: 74 }).type, "latte");
  assert.equal(makeOrder(4, () => 0.5, { elapsed: 75 }).type, "doppio");
  assert.equal(makeOrder(8, () => 0.5, { elapsed: 89 }).items.length, 1);
  assert.equal(makeOrder(8, () => 0.5, { elapsed: 90 }).items.length, 2);
  assert.equal(preparationFor("coffee", "espresso").result, "doppio");
  assert.equal(
    nextObjective("espresso", [{ type: "doppio", time: 40 }]),
    "coffee",
  );
});
