import test from "node:test";
import assert from "node:assert/strict";
import {
  pertMean,
  pertStdDev,
  sampleTriangular,
  blindEstimate,
  tripleEstimate,
  sampleEstimate,
  monteCarloTotals,
  probabilityWithin,
  percentile,
  histogram,
} from "../src/engine/estimate.js";
import { createRng } from "../src/engine/rng.js";

test("pertMean of (1, 2, 4) is 13/6", () => {
  assert.equal(pertMean(1, 2, 4), 13 / 6);
});

test("pertStdDev of (1, 2, 4) is 0.5", () => {
  assert.equal(pertStdDev(1, 2, 4), 0.5);
});

test("sampleTriangular hits the bounds at u=0 and u=1", () => {
  assert.equal(sampleTriangular(2, 5, 11, 0), 2);
  assert.equal(sampleTriangular(2, 5, 11, 1), 11);
});

test("sampleTriangular grows monotonically with u", () => {
  let prev = -Infinity;
  for (let u = 0; u <= 1.0001; u += 0.05) {
    const value = sampleTriangular(2, 5, 11, Math.min(u, 1));
    assert.ok(value >= prev, `not monotone at u=${u}`);
    prev = value;
  }
});

test("a flat triangle returns its only value", () => {
  assert.equal(sampleTriangular(4, 4, 4, 0.37), 4);
});

test("tripleEstimate is symmetric around the truth", () => {
  const est = tripleEstimate(10);
  assert.equal(pertMean(est.o, est.m, est.p), 10);
});

test("blindEstimate promises 0.7 of the truth and hides a long right tail", () => {
  const est = blindEstimate(10);
  assert.equal(est.m, 7); // именно эта цифра попадает в план
  assert.equal(est.p, 30); // хвост, которого в плане не видно
  assert.ok((est.o + est.m + est.p) / 3 > 10, "факт в среднем хуже правды");
});

test("sampleEstimate delegates to the triangle", () => {
  assert.equal(sampleEstimate({ o: 1, m: 2, p: 3 }, 0), 1);
});

test("probabilityWithin counts the share below the threshold", () => {
  assert.equal(probabilityWithin([1, 2, 3, 4], 2.5), 0.5);
  assert.equal(probabilityWithin([1, 2, 3, 4], 0), 0);
  assert.equal(probabilityWithin([1, 2, 3, 4], 10), 1);
  assert.equal(probabilityWithin([], 5), 0);
});

test("empty work means the deadline is met", () => {
  const totals = monteCarloTotals([], createRng("empty"), 100);
  assert.equal(probabilityWithin(totals, 0), 1);
});

test("percentile walks the sorted list", () => {
  assert.equal(percentile([1, 2, 3, 4], 50), 3);
  assert.equal(percentile([1, 2, 3, 4], 0), 1);
  assert.equal(percentile([1, 2, 3, 4], 100), 4);
});

test("monte carlo is deterministic for a seed and sorted", () => {
  const estimates = [tripleEstimate(5), tripleEstimate(8)];
  const first = monteCarloTotals(estimates, createRng("mc"), 200);
  const second = monteCarloTotals(estimates, createRng("mc"), 200);
  assert.deepEqual(first, second);
  assert.equal(first.length, 200);
  assert.ok(first[0] <= first[first.length - 1]);
});

test("both estimate builders return an ordered triple", () => {
  for (const build of [tripleEstimate, blindEstimate]) {
    const est = build(10);
    assert.ok(
      est.o <= est.m && est.m <= est.p,
      `нарушен домен o <= m <= p: ${JSON.stringify(est)}`
    );
  }
});

test("samples never leave the optimistic and pessimistic bounds", () => {
  const rng = createRng("bounds");
  for (const est of [tripleEstimate(10), blindEstimate(10)]) {
    for (let i = 0; i < 500; i += 1) {
      const value = sampleEstimate(est, rng.next());
      assert.ok(
        value >= est.o - 1e-9 && value <= est.p + 1e-9,
        `сэмпл ${value} вне [${est.o}, ${est.p}]`
      );
    }
  }
});

test("histogram keeps every run in a bucket", () => {
  const totals = monteCarloTotals([tripleEstimate(5)], createRng("hist"), 500);
  const h = histogram(totals, 10);
  assert.equal(h.buckets.length, 10);
  const sum = h.buckets.reduce((s, v) => s + v, 0);
  assert.equal(sum, 500);
  assert.equal(h.min, totals[0]);
  assert.equal(h.max, totals[totals.length - 1]);
});
