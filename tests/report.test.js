import test from "node:test";
import assert from "node:assert/strict";
import { SPRINTS } from "../src/data/scenario.js";
import { createInitialState, runSprint } from "../src/engine/reducer.js";
import { summarise, counterfactual, playStrategy, STRATEGIES } from "../src/engine/report.js";

function playAll(overrides = {}) {
  let state = createInitialState();
  state.estimateMode = overrides.estimateMode || "pert";
  for (let i = 0; i < SPRINTS.length; i += 1) {
    for (const e of SPRINTS[i].events) state.eventChoices[e.id] = overrides.events || "decline";
    state.debtPlan = overrides.debt || "refactor";
    state.overtime = Boolean(overrides.overtime);
    state = runSprint(state);
  }
  return state;
}

test("a finished run reports its phase as report", () => {
  assert.equal(playAll().phase, "report");
});

test("summarise splits capacity into work and overhead", () => {
  const summary = summarise(playAll(), "unit");
  assert.equal(summary.consumed, summary.usedDays + summary.overheadDays);
  assert.equal(summary.budgetLeft, 240 - summary.consumed);
  assert.ok(summary.efficiency > 0.5 && summary.efficiency <= 1);
  assert.equal(summary.spread.buckets.length, 20);
});

test("an empty remaining scope means the deadline is met", () => {
  const summary = summarise(playStrategy(STRATEGIES.disciplined), "empty");
  assert.equal(summary.remaining, 0);
  assert.equal(summary.onTime, 1);
});

test("leftover scope kills the deadline", () => {
  const summary = summarise(playStrategy(STRATEGIES.deferred_scope), "deferred");
  assert.ok(summary.remaining > 50);
  assert.equal(summary.onTime, 0);
  assert.ok(summary.p50 > summary.budgetLeft);
});

test("the counterfactual is a disciplined run of the same scenario", () => {
  const counter = counterfactual();
  assert.equal(counter.onTime, 1);
  assert.equal(counter.debt, 0);
  assert.equal(counter.attribution.debtLoss, 0);
});

test("strategies are deterministic for the same seed", () => {
  const a = summarise(playStrategy(STRATEGIES.usual), "x");
  const b = summarise(playStrategy(STRATEGIES.usual), "x");
  assert.deepEqual(a, b);
  assert.notEqual(a.usedDays, summarise(playStrategy(STRATEGIES.disciplined), "x").usedDays);
});

test("summarise exposes the parts of the remaining scope", () => {
  const s = summarise(playStrategy(STRATEGIES.deferred_scope), "parts");
  assert.equal(s.carryoverPromised, 0);
  assert.equal(s.deferredPromised, 74);
  assert.equal(s.backlogPromised, 0);
  assert.ok(Math.abs(s.remaining - (s.carryoverPromised + s.deferredPromised + s.backlogPromised)) < 1e-9);
});

test("swapped-out work lands in the backlog instead of disappearing", () => {
  const s = summarise(playStrategy(STRATEGIES.swap_everything), "swap");
  assert.ok(s.backlogPromised > 0, "снятая работа должна остаться в скоупе");
  assert.ok(s.onTime === 0 || s.remaining === 0);
  assert.ok(s.remaining >= s.backlogPromised);
});
