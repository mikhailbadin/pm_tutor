import test from "node:test";
import assert from "node:assert/strict";
import { playStrategy, summarise, STRATEGIES } from "../src/engine/report.js";

const EXPECTED = {
  usual: { usedDays: 96.6, consumed: 221.5, overheadDays: 124.9, remaining: 136.5, onTime: 0 },
  estimated_but_all_scope: { usedDays: 147.8, consumed: 219.6, overheadDays: 71.9, remaining: 123.0, onTime: 0 },
  disciplined: { usedDays: 199.2, consumed: 229.2, overheadDays: 30.0, remaining: 0, onTime: 1 },
  deferred_scope: { usedDays: 199.2, consumed: 229.2, overheadDays: 30.0, remaining: 74.0, onTime: 0 },
  swap_everything: { usedDays: 175.3, consumed: 205.3, overheadDays: 30.0, remaining: 98.0, onTime: 0 },
  blind_overtime: { usedDays: 87.6, consumed: 227.0, overheadDays: 139.5, remaining: 154.0, onTime: 0 },
};

const close = (actual, expected, label) =>
  assert.ok(Math.abs(actual - expected) < 0.1, `${label}: ожидалось ${expected}, получено ${actual}`);

for (const [name, expected] of Object.entries(EXPECTED)) {
  test(`strategy "${name}" reproduces the calibrated run`, () => {
    const summary = summarise(playStrategy(STRATEGIES[name]), `strategies-${name}`);
    close(summary.usedDays, expected.usedDays, `${name} usedDays`);
    close(summary.consumed, expected.consumed, `${name} consumed`);
    close(summary.overheadDays, expected.overheadDays, `${name} overheadDays`);
    close(summary.remaining, expected.remaining, `${name} remaining`);
    assert.equal(summary.onTime, expected.onTime, `${name} onTime`);
  });
}

test("every strategy balances promised, delivered and the scope that is left", () => {
  for (const [name, strategy] of Object.entries(STRATEGIES)) {
    const s = summarise(playStrategy(strategy), `balance-${name}`);
    close(
      s.committedPromised - s.promisedDelivered,
      s.carryoverPromised + s.backlogPromised,
      `${name}: обещанное = доставленное + перенос + бэклог`
    );
    close(
      s.remaining,
      s.carryoverPromised + s.backlogPromised + s.deferredPromised,
      `${name}: остаток = перенос + бэклог + отложенное`
    );
  }
});

test("the lessons the trainer is supposed to teach actually hold", () => {
  const usual = summarise(playStrategy(STRATEGIES.usual), "lesson-usual");
  const estimated = summarise(playStrategy(STRATEGIES.estimated_but_all_scope), "lesson-estimated");
  const disciplined = summarise(playStrategy(STRATEGIES.disciplined), "lesson-disciplined");
  const deferred = summarise(playStrategy(STRATEGIES.deferred_scope), "lesson-deferred");
  const swapped = summarise(playStrategy(STRATEGIES.swap_everything), "lesson-swap");
  const overtime = summarise(playStrategy(STRATEGIES.blind_overtime), "lesson-overtime");

  // 1. Оценка не ускоряет работу, но улучшает план: сделали больше при той же ёмкости.
  assert.ok(estimated.usedDays > usual.usedDays);
  // 2. Отложить != отказаться: работы столько же, но релиз сдвигается.
  assert.equal(deferred.usedDays, disciplined.usedDays);
  assert.ok(deferred.remaining > disciplined.remaining);
  // 3. Овертайм делает хуже, а не лучше.
  assert.ok(overtime.usedDays < usual.usedDays);
  // 4. Обмен тоже сдвигает релиз, просто иначе: снятая работа остаётся в скоупе.
  assert.ok(swapped.remaining > disciplined.remaining);
  assert.ok(swapped.backlogPromised > 0);
  // 5. Дисциплина даёт результат только вместе: план, отказ от внеплана, погашенный долг.
  assert.equal(disciplined.onTime, 1);
  assert.equal(disciplined.debt, 0);
});
