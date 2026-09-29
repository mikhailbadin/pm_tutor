import test from "node:test";
import assert from "node:assert/strict";
import { SPRINTS } from "../src/data/scenario.js";
import {
  TOTAL_CAPACITY,
  createInitialState,
  planSprint,
  runSprint,
  pendingEvents,
  remainingPromised,
  remainingEstimates,
} from "../src/engine/reducer.js";

function playOneSprint(overrides = {}) {
  const state = { ...createInitialState(), ...overrides };
  return runSprint(state);
}

test("initial state is a fresh run of the scenario", () => {
  const state = createInitialState();
  assert.equal(state.seed, "onboarding-2-0");
  assert.equal(state.sprintIndex, 0);
  assert.equal(state.phase, "decisions");
  assert.equal(state.debt, 0);
  assert.equal(state.burnout, 0);
  assert.equal(state.carryoverDays, 0);
  assert.equal(state.usedDays, 0);
  assert.equal(state.overheadDays, 0);
  assert.deepEqual(state.carryover, []);
  assert.deepEqual(state.deferred, []);
  assert.deepEqual(state.backlog, []);
  assert.deepEqual(state.history, []);
});

test("total capacity is the deadline times the sprint capacity", () => {
  assert.equal(TOTAL_CAPACITY, 240);
});

test("a PERT plan promises the truth, a blind plan promises a lie", () => {
  const honest = planSprint({ ...createInitialState(), estimateMode: "pert" });
  const blind = planSprint({ ...createInitialState(), estimateMode: "blind" });
  assert.equal(honest.promisedDays, 34); // 8 + 10 + 10 + 6
  assert.ok(Math.abs(blind.promisedDays - 23.8) < 1e-9); // 0.7 от 34
  assert.equal(honest.planned.length, 4);
});

test("only taken or swapped events enter the sprint plan, and they come first", () => {
  const state = createInitialState();
  state.eventChoices = { e1: "take", e2: "decline" };
  const plan = planSprint(state);
  assert.equal(plan.taken.length, 1);
  assert.equal(plan.taken[0].id, "e1");
  assert.equal(plan.taken[0].priority, 0);
  assert.equal(plan.sprint.id, SPRINTS[0].id);
});

test("pendingEvents names every event the player has not decided yet", () => {
  assert.deepEqual(pendingEvents(createInitialState()), ["e1", "e2"]);
  assert.deepEqual(pendingEvents({ ...createInitialState(), eventChoices: { e1: "take" } }), ["e2"]);
  assert.deepEqual(
    pendingEvents({ ...createInitialState(), eventChoices: { e1: "take", e2: "decline" } }),
    []
  );
});

test("a clean weighted sprint fits inside its own capacity", () => {
  const next = playOneSprint({ estimateMode: "pert" });
  assert.equal(next.sprintIndex, 1);
  assert.equal(next.phase, "decisions");
  assert.equal(next.history.length, 1);
  const sprint = next.history[0];
  assert.equal(sprint.raw, 40);
  assert.ok(sprint.spent + next.carryoverDays <= 40 + 1e-9);
  assert.equal(sprint.doneCount + sprint.carriedCount, 4);
});

test("refactoring costs five days and keeps the debt at zero", () => {
  const next = playOneSprint({ debtPlan: "refactor" });
  assert.equal(next.debt, 0);
  assert.equal(next.history[0].refactorCost, 5);
});

test("ignoring debt grows it and slows the next sprint", () => {
  const first = playOneSprint();
  assert.equal(first.debt, 5);
  const second = runSprint({ ...first, sprintIndex: 1 });
  assert.equal(second.history.at(-1).debtDays, 40 * 0.1);
});

test("overtime adds capacity now and takes thirty percent of the base away next sprint", () => {
  const withOvertime = playOneSprint({ overtime: true });
  assert.equal(withOvertime.history[0].raw, 48);
  assert.equal(withOvertime.burnout, 1);
  assert.equal(withOvertime.overtimeRecovery, 1);
  const next = runSprint({ ...withOvertime, sprintIndex: 1 });
  assert.equal(next.history.at(-1).raw, 28); // 40 * 0.7: переработка не запрошена заново
  assert.ok(next.history.at(-1).burnoutDays > 0);
});

test("asking for overtime twice in a row keeps the bonus and the recovery", () => {
  const first = playOneSprint({ overtime: true });
  const second = runSprint({ ...first, sprintIndex: 1, overtime: true });
  assert.ok(Math.abs(second.history.at(-1).raw - 33.6) < 1e-9); // 48 * 0.7
});

test("taken events land in the sprint, declined events disappear", () => {
  const state = { ...createInitialState(), eventChoices: { e1: "take", e2: "decline" } };
  const next = runSprint(state);
  assert.equal(next.history[0].doneCount + next.history[0].carriedCount, 5);
  assert.ok(next.attribution.scopeAdded > 0);
});

test("deferring keeps the work in scope, declining does not", () => {
  const deferred = runSprint({
    ...createInitialState(),
    estimateMode: "pert",
    eventChoices: { e1: "defer", e2: "defer" },
  });
  assert.equal(deferred.deferred.length, 2);
  assert.ok(remainingPromised(deferred) > 0);
  assert.equal(remainingEstimates(deferred).length, 2);
  assert.equal(deferred.attribution.scopeAdded, 0);
  assert.equal(deferred.deferred[0].promised, 6); // оценка зафиксирована в момент решения
});

test("swapping keeps the dropped work in scope instead of erasing it", () => {
  const state = { ...createInitialState(), estimateMode: "pert", eventChoices: { e1: "swap" } };
  const next = runSprint(state);

  // задачу сняли с плана спринта...
  assert.equal(next.history[0].dropped.length, 1);
  assert.equal(next.attribution.droppedToBacklog, 6); // s1-t4 обещана на 6 дней

  // ...но работа не исчезла: она в бэклоге, входит в остаток скоупа и в Монте-Карло
  assert.equal(next.backlog.length, 1);
  assert.equal(next.backlog[0].promised, 6);
  assert.equal(next.backlog[0].source, "swap");
  assert.equal(remainingPromised(next), 6);
  assert.equal(remainingEstimates(next).length, 1);

  // и она не считается сделанной: обещанное сходится с доставленным и оставшимся
  const left = next.carryover.concat(next.backlog).reduce((s, t) => s + t.promised, 0);
  assert.ok(Math.abs(next.committedPromised - next.promisedDelivered - left) < 1e-9);
});

test("the same seed reproduces the sprint exactly", () => {
  const a = playOneSprint({ estimateMode: "pert", eventChoices: { e1: "take" } });
  const b = playOneSprint({ estimateMode: "pert", eventChoices: { e1: "take" } });
  assert.deepEqual(a.history, b.history);
  assert.equal(a.usedDays, b.usedDays);
});

test("a drowning team still works every sprint instead of standing still", () => {
  let state = createInitialState();
  const capacities = [];
  const spent = [];
  for (let i = 0; i < SPRINTS.length; i += 1) {
    for (const event of SPRINTS[i].events) state.eventChoices[event.id] = "take";
    state.debtPlan = "ignore";
    state.overtime = true;
    state = runSprint(state);
    const record = state.history.at(-1);
    capacities.push(record.capacity);
    spent.push(record.spent);
  }
  assert.ok(
    capacities.every((c) => c > 0),
    `ёмкость не должна обнуляться: ${capacities.map((c) => c.toFixed(1)).join(", ")}`
  );
  assert.ok(
    spent.every((s) => s > 0),
    `в каждом спринте команда должна что-то делать: ${spent.map((s) => s.toFixed(1)).join(", ")}`
  );
  // и у перенесённой задачи видно, что часть работы по ней уже сделана
  const partial = state.history.find((r) => r.carried.some((t) => t.worked > 0));
  assert.ok(partial, "должен найтись спринт с частично сделанной задачей");
});
