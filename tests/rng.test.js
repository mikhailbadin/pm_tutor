import test from "node:test";
import assert from "node:assert/strict";
import { createRng, seedFromString, mulberry32 } from "../src/engine/rng.js";

test("same seed produces the same sequence", () => {
  const a = createRng("onboarding-2-0");
  const b = createRng("onboarding-2-0");
  const first = [a.next(), a.next(), a.next()];
  const second = [b.next(), b.next(), b.next()];
  assert.deepEqual(first, second);
});

test("different seeds produce different sequences", () => {
  const a = createRng("seed-a").next();
  const b = createRng("seed-b").next();
  assert.notEqual(a, b);
});

test("values stay inside [0, 1)", () => {
  const rng = createRng("range");
  for (let i = 0; i < 500; i += 1) {
    const value = rng.next();
    assert.ok(value >= 0 && value < 1, `value out of range: ${value}`);
  }
});

test("int() stays inside the inclusive bounds", () => {
  const rng = createRng("dice");
  for (let i = 0; i < 500; i += 1) {
    const value = rng.int(1, 6);
    assert.ok(value >= 1 && value <= 6 && Number.isInteger(value), `bad int: ${value}`);
  }
});

test("seedFromString is stable and mulberry32 is pure", () => {
  assert.equal(seedFromString("abc"), seedFromString("abc"));
  const next = mulberry32(1);
  assert.equal(next(), mulberry32(1)());
});
