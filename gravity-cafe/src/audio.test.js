import { test } from "node:test";
import assert from "node:assert/strict";
import { createAudioFeedback } from "./audio.js";

function fakeContext(state = "running") {
  const events = [];
  return {
    state,
    currentTime: 42,
    destination: {},
    events,
    async resume() {
      events.push("resume");
      this.state = "running";
    },
    createOscillator() {
      events.push("oscillator");
      return {
        frequency: {},
        connect() {},
        start(time) {
          events.push(["start", time]);
        },
        stop(time) {
          events.push(["stop", time]);
        },
      };
    },
    createGain() {
      return {
        connect() {},
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      };
    },
  };
}

test("suspended audio resumes before scheduling a sound", async () => {
  const context = fakeContext("suspended");
  await createAudioFeedback(() => context).beep();
  assert.deepEqual(context.events.slice(0, 2), ["resume", "oscillator"]);
  assert.deepEqual(context.events[2], ["start", 42]);
});

test("running audio does not resume unnecessarily", async () => {
  const context = fakeContext();
  const audio = createAudioFeedback(() => context);
  await audio.beep();
  await audio.beep();
  assert.equal(context.events.filter((e) => e === "resume").length, 0);
  assert.equal(context.events.filter((e) => e === "oscillator").length, 2);
});

test("rejected resume is handled without scheduling or unhandled rejection", async () => {
  const context = fakeContext("suspended");
  context.resume = () => Promise.reject(new Error("blocked"));
  await assert.doesNotReject(createAudioFeedback(() => context).beep());
  assert.deepEqual(context.events, []);
});

test("a browser that stays suspended remains silent", async () => {
  const context = fakeContext("suspended");
  context.resume = async () => {};
  await createAudioFeedback(() => context).beep();
  assert.deepEqual(context.events, []);
});

test("concurrent gestures share one pending resume", async () => {
  const context = fakeContext("suspended");
  let done,
    calls = 0;
  context.resume = () => {
    calls++;
    return new Promise((resolve) => {
      done = () => {
        context.state = "running";
        resolve();
      };
    });
  };
  const audio = createAudioFeedback(() => context);
  const first = audio.unlock(),
    second = audio.beep();
  assert.equal(calls, 1);
  done();
  await Promise.all([first, second]);
  assert.equal(context.events.filter((e) => e === "oscillator").length, 1);
});

test("closed contexts are recreated lazily and unsupported audio is harmless", async () => {
  const context = fakeContext();
  let calls = 0;
  const audio = createAudioFeedback(() => {
    calls++;
    return context;
  });
  await audio.beep();
  context.state = "closed";
  await audio.unlock();
  assert.equal(calls, 2);
  await assert.doesNotReject(createAudioFeedback(() => null).beep());
  await assert.doesNotReject(
    createAudioFeedback(() => {
      throw new Error("no audio");
    }).beep(),
  );
});
