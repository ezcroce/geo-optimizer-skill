import { test } from "node:test";
import assert from "node:assert/strict";
import { modelURL } from "./model-assets.js";
test("web model URLs work at root or in a relative static subfolder", () => {
  for (const name of ["barista", "customer", "cup"]) {
    assert.equal(modelURL(name), `/models/${name}.glb`);
    assert.equal(modelURL(name, "./"), `./models/${name}.glb`);
    assert.equal(modelURL(name, "/cafe/"), `/cafe/models/${name}.glb`);
  }
  assert.throws(() => modelURL("../secret"));
});
