import test from "node:test";
import assert from "node:assert/strict";
import { bundle, SOURCES } from "../scripts/bundle.mjs";

test("the bundle keeps the sources in dependency order", () => {
  assert.deepEqual(SOURCES, [
    "src/engine/rng.js",
    "src/engine/estimate.js",
    "src/engine/model.js",
    "src/data/scenario.js",
    "src/engine/reducer.js",
    "src/engine/report.js",
    "src/ui/render.js",
    "src/app.js",
  ]);
});

test("the bundle has no module syntax left", () => {
  const code = bundle(SOURCES);
  assert.equal(/^\s*(import|export)\s/m.test(code), false);
  assert.equal(/export\s+default/.test(code), false);
});

test("the bundle exposes the api and contains the app", () => {
  const code = bundle(SOURCES);
  assert.match(code, /function mount\(/);
  assert.match(code, /window\.PlanningTutor = \{ mount \};/);
  assert.match(code, /function renderReport\(/);
});
