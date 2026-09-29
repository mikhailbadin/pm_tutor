import test from "node:test";
import assert from "node:assert/strict";
import {
  BASE_CAPACITY,
  debtPenalty,
  wipPenalty,
  burnoutPenalty,
  rawCapacity,
  capacityLosses,
  effectiveCapacity,
  bugDays,
  applyDebt,
  nextBurnout,
  DEBT_REFACTOR_COST,
} from "../src/engine/model.js";
import { createRng } from "../src/engine/rng.js";

test("base capacity is four developers times ten days", () => {
  assert.equal(BASE_CAPACITY, 40);
  assert.equal(rawCapacity(), 40);
});

test("overtime adds twenty percent, recovery takes thirty", () => {
  assert.equal(rawCapacity({ overtime: true }), 48);
  assert.ok(Math.abs(rawCapacity({ overtime: true, overtimePenalty: true }) - 33.6) < 1e-9);
  assert.equal(rawCapacity({ overtimePenalty: true }), 28);
});

test("tech debt penalty is two percent per unit and capped at thirty", () => {
  assert.equal(debtPenalty(0), 0);
  assert.equal(debtPenalty(10), 0.2);
  assert.equal(debtPenalty(100), 0.3);
  assert.equal(debtPenalty(-5), 0);
});

test("work in progress penalty is one percent per carried day, capped", () => {
  assert.equal(wipPenalty(10), 0.1);
  assert.equal(wipPenalty(1000), 0.25);
});

test("burnout penalty is six percent per unit", () => {
  assert.equal(burnoutPenalty(3), 0.18);
  assert.equal(burnoutPenalty(99), 0.3);
});

test("losses are additive and expressed in days", () => {
  const losses = capacityLosses({ overtime: false, overtimeRecovery: 0, debt: 10, carryoverDays: 10, burnout: 2 });
  assert.equal(losses.raw, 40);
  assert.equal(losses.debtDays, 8);
  assert.equal(losses.wipDays, 4);
  assert.ok(Math.abs(losses.burnoutDays - 4.8) < 1e-9);
  assert.ok(Math.abs(losses.total - 16.8) < 1e-9);
  assert.ok(Math.abs(effectiveCapacity({ debt: 10, carryoverDays: 10, burnout: 2 }) - 23.2) < 1e-9);
});

test("a clean sprint keeps the full capacity", () => {
  assert.equal(effectiveCapacity({ debt: 0, carryoverDays: 0, burnout: 0 }), 40);
});

test("no debt means no bug days", () => {
  assert.equal(bugDays({ debt: 0 }), 0);
});

test("bug days are expected debt times four tenths without jitter", () => {
  assert.equal(bugDays({ debt: 5 }), 2);
  assert.equal(bugDays({ debt: 10 }), 4);
});

test("bug days stay inside the jitter band", () => {
  const rng = createRng("bugs");
  for (let i = 0; i < 200; i += 1) {
    const days = bugDays({ debt: 10 }, rng);
    assert.ok(days >= 2 && days <= 6, `bug days out of band: ${days}`);
  }
});

test("ignoring debt grows it by five per sprint", () => {
  assert.deepEqual(applyDebt({ debt: 0 }, "ignore"), { debt: 5, spentDays: 0 });
  assert.deepEqual(applyDebt({ debt: 5 }, "ignore"), { debt: 10, spentDays: 0 });
});

test("refactoring costs days and reliefs ten units of debt", () => {
  const result = applyDebt({ debt: 0 }, "refactor");
  assert.equal(result.debt, 0);
  assert.equal(result.spentDays, DEBT_REFACTOR_COST);
  assert.equal(applyDebt({ debt: 10 }, "refactor").debt, 5);
});

test("burnout grows with overtime and heals by one without it", () => {
  assert.equal(nextBurnout(0, true), 1);
  assert.equal(nextBurnout(2, true), 3);
  assert.equal(nextBurnout(2, false), 1);
  assert.equal(nextBurnout(0, false), 0);
});
