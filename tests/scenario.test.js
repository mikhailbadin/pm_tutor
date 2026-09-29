import test from "node:test";
import assert from "node:assert/strict";
import { SPRINTS, SCENARIO, plannedTruthDays, eventsTruthDays } from "../src/data/scenario.js";

test("the scenario has six sprints of four tasks and two events", () => {
  assert.equal(SPRINTS.length, 6);
  for (const sprint of SPRINTS) {
    assert.equal(sprint.tasks.length, 4, `sprint ${sprint.id} tasks`);
    assert.equal(sprint.events.length, 2, `sprint ${sprint.id} events`);
  }
});

test("every task and event id is unique", () => {
  const ids = SPRINTS.flatMap((s) => [...s.tasks, ...s.events].map((item) => item.id));
  assert.equal(new Set(ids).size, ids.length);
});

test("planned truth is 202 days and events add 74", () => {
  assert.equal(plannedTruthDays(), 202);
  assert.equal(eventsTruthDays(), 74);
});

test("total capacity is 240 and the plan leaves only a 38 day buffer", () => {
  assert.equal(SCENARIO.totalCapacity, 240);
  assert.equal(SCENARIO.totalCapacity - plannedTruthDays(), 38);
});

test("every task has a positive likely estimate and a priority", () => {
  for (const sprint of SPRINTS) {
    for (const task of sprint.tasks) {
      assert.ok(task.likely > 0, `${task.id} likely`);
      assert.ok(task.priority >= 1 && task.priority <= 4, `${task.id} priority`);
    }
  }
});
