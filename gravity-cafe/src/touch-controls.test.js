import { test } from "node:test";
import assert from "node:assert/strict";
import { bindTouchButton } from "./touch-controls.js";

function setup() {
  const classes = new Set(),
    button = new EventTarget(),
    keys = new Set();
  button.classList = {
    add: (c) => classes.add(c),
    remove: (c) => classes.delete(c),
  };
  button.setPointerCapture = () => {};
  let presses = 0;
  const reset = bindTouchButton(
    button,
    () => {
      presses++;
      keys.add("KeyW");
    },
    () => keys.delete("KeyW"),
  );
  const send = (type, pointerId = 1, detail = 1) => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, {
      pointerId: { value: pointerId },
      detail: { value: detail },
    });
    button.dispatchEvent(event);
  };
  return { classes, keys, reset, send, presses: () => presses };
}

test("touch feedback and input activate on pointerdown, not on release", () => {
  const s = setup();
  s.send("pointerdown");
  assert.ok(s.classes.has("active"));
  assert.ok(s.keys.has("KeyW"));
  s.send("pointerup");
  assert.equal(s.classes.size, 0);
  assert.equal(s.keys.size, 0);
});

for (const type of ["pointercancel", "lostpointercapture"]) {
  test(`${type} clears active feedback and held input`, () => {
    const s = setup();
    s.send("pointerdown");
    s.send(type);
    assert.equal(s.classes.size, 0);
    assert.equal(s.keys.size, 0);
  });
}

test("another pointer cannot release or trigger an already held button", () => {
  const s = setup();
  s.send("pointerdown", 1);
  s.send("pointerdown", 2);
  s.send("pointerup", 2);
  assert.equal(s.presses(), 1);
  assert.ok(s.classes.has("active"));
  s.send("pointerup", 1);
  assert.equal(s.keys.size, 0);
});

test("pause or focus loss can reset a held button idempotently", () => {
  const s = setup();
  s.send("pointerdown");
  s.reset();
  s.reset();
  assert.equal(s.keys.size, 0);
  assert.equal(s.classes.size, 0);
  s.send("pointerdown", 2);
  assert.equal(s.presses(), 2);
});

test("keyboard activation works without duplicating pointer clicks", () => {
  const s = setup();
  s.send("click", 0, 0);
  assert.equal(s.presses(), 1);
  assert.equal(s.keys.size, 0);
  s.send("pointerdown");
  s.send("pointerup");
  s.send("click");
  assert.equal(s.presses(), 2);
});
