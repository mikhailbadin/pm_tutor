// Оценки. Оценка НЕ делает работу быстрее — она делает план точнее.
// Трёхточечная (PERT) оценка: o — оптимистично, m — наиболее вероятно, p — пессимистично.

export function pertMean(o, m, p) {
  return (o + 4 * m + p) / 6;
}

export function pertStdDev(o, m, p) {
  return (p - o) / 6;
}

// Треугольное распределение — простое и объяснимое приближение для беты.
export function sampleTriangular(o, m, p, u) {
  if (p === o) return o;
  if (u <= (m - o) / (p - o)) {
    return o + Math.sqrt(u * (p - o) * (m - o));
  }
  return p - Math.sqrt((1 - u) * (p - o) * (p - m));
}

// Правда о задаче, которую знает только движок.
// Оценка вслепую («сделаем за день») — односторонний оптимизм: в плане 0.7 от правды,
// а факт уезжает вправо (среднее (0.6 + 0.7 + 3) / 3 ≈ 1.43 от правды).
export function blindEstimate(likely) {
  return { o: likely * 0.6, m: likely * 0.7, p: likely * 3 };
}

// Нормальная трёхточечная оценка: симметричный разброс вокруг правды, поэтому
// PERT-среднее равно правде и план не врёт систематически.
export function tripleEstimate(likely) {
  return { o: likely * 0.7, m: likely, p: likely * 1.3 };
}

export function sampleEstimate(est, u) {
  return sampleTriangular(est.o, est.m, est.p, u);
}

// Монте-Карло: сумма независимых задач N раз, отсортированные итоги.
export function monteCarloTotals(estimates, rng, runs = 2000) {
  const totals = [];
  for (let i = 0; i < runs; i += 1) {
    let total = 0;
    for (let j = 0; j < estimates.length; j += 1) {
      total += sampleEstimate(estimates[j], rng.next());
    }
    totals.push(total);
  }
  totals.sort((a, b) => a - b);
  return totals;
}

export function probabilityWithin(totals, days) {
  if (totals.length === 0) return 0;
  let count = 0;
  for (let i = 0; i < totals.length; i += 1) if (totals[i] <= days) count += 1;
  return count / totals.length;
}

export function percentile(totals, p) {
  if (totals.length === 0) return 0;
  const idx = Math.min(totals.length - 1, Math.max(0, Math.round((p / 100) * (totals.length - 1))));
  return totals[idx];
}

export function histogram(totals, bucketCount = 20) {
  if (totals.length === 0) return { min: 0, max: 0, width: 1, buckets: [] };
  const min = totals[0];
  const max = totals[totals.length - 1];
  const width = (max - min) / bucketCount || 1;
  const buckets = new Array(bucketCount).fill(0);
  for (let i = 0; i < totals.length; i += 1) {
    const idx = Math.min(bucketCount - 1, Math.floor((totals[i] - min) / width));
    buckets[idx] += 1;
  }
  return { min, max, width, buckets };
}
