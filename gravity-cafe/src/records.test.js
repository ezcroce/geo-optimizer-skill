import { test } from "node:test";
import assert from "node:assert/strict";
import { createRecords } from "./records.js";

function storage() {
  const data = new Map();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

test("records are isolated per station rather than shared globally", () => {
  const s = storage(),
    records = createRecords(() => s);
  records.save("MELT-CORE", 500);
  records.save("BOTANICAL", 200);
  assert.equal(records.read("MELT-CORE"), 500);
  assert.equal(records.read("BOTANICAL"), 200);
  assert.equal(records.read("CLASSICO"), 0);
});

test("lower scores never overwrite a station record", () => {
  const s = storage(),
    stable = createRecords(() => s);
  assert.equal(stable.save("CLASSICO", 300), 300);
  assert.equal(stable.save("CLASSICO", 100), 300);
  assert.equal(stable.read("CLASSICO"), 300);
});

test("practice scores do not update records", () => {
  const s = storage(),
    records = createRecords(() => s);
  records.save("BOTANICAL", 100);
  assert.equal(records.save("BOTANICAL", 999, { eligible: false }), 100);
  assert.equal(records.read("BOTANICAL"), 100);
});

test("legacy global best is preserved without assigning it to the wrong map", () => {
  const s = storage();
  s.setItem("gravity-best", "999");
  const records = createRecords(() => s);
  assert.equal(records.read("MELT-CORE"), 0);
  records.save("MELT-CORE", 100);
  assert.equal(s.getItem("gravity-best"), "999");
});

test("invalid persisted values and scores cannot corrupt a record", () => {
  const s = storage(),
    records = createRecords(() => s);
  for (const value of ["NaN", "Infinity", "-10", "broken"]) {
    s.setItem("gravity-best:CLASSICO", value);
    assert.equal(records.read("CLASSICO"), 0);
  }
  s.data.clear();
  for (const score of [NaN, Infinity, -1]) records.save("CLASSICO", score);
  assert.equal(s.data.size, 0);
});

test("blocked storage and quota errors do not interrupt gameplay", () => {
  const records = createRecords(() => {
    throw new Error("private browsing");
  });
  assert.equal(records.read("CLASSICO"), 0);
  assert.equal(records.save("CLASSICO", 100), 100);
  const quota = createRecords(() => ({
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
  }));
  assert.equal(quota.save("CLASSICO", 100), 100);
});
