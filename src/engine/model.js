// Арифметика последствий: ёмкость спринта, потерянная скорость, баги.
// Никакого DOM и никаких случайностей без явно переданного rng — всё проверяемо.

export const SPRINT_DAYS = 10;
export const TEAM_SIZE = 4;
export const BASE_CAPACITY = SPRINT_DAYS * TEAM_SIZE; // 40 человеко-дней за спринт

export const OVERTIME_BONUS = 0.2;
export const OVERTIME_RECOVERY = 0.3;

export const DEBT_PER_SPRINT = 5;
export const DEBT_REFACTOR_COST = 5;
export const DEBT_REFACTOR_RELIEF = 10;
export const DEBT_PENALTY_PER_UNIT = 0.02;
export const MAX_DEBT_PENALTY = 0.3;

export const WIP_PENALTY_PER_DAY = 0.01;
export const MAX_WIP_PENALTY = 0.25;

export const BURNOUT_PENALTY_PER_UNIT = 0.06;
export const MAX_BURNOUT_PENALTY = 0.3;

export const BUGS_PER_DEBT_UNIT = 0.4;
export const BUG_SPREAD = 0.5;

// Прожиточный минимум: даже утонувшая в долге команда что-то делает. Без этого пола
// последние спринты давали ровно ноль работы, и решения игрока перестают влиять на исход.
export const MIN_CAPACITY_SHARE = 0.15;

export function debtPenalty(debt) {
  return Math.min(MAX_DEBT_PENALTY, Math.max(0, debt) * DEBT_PENALTY_PER_UNIT);
}

export function wipPenalty(carryoverDays) {
  return Math.min(MAX_WIP_PENALTY, Math.max(0, carryoverDays) * WIP_PENALTY_PER_DAY);
}

export function burnoutPenalty(burnout) {
  return Math.min(MAX_BURNOUT_PENALTY, Math.max(0, burnout) * BURNOUT_PENALTY_PER_UNIT);
}

export function rawCapacity({ overtime = false, overtimePenalty = false } = {}) {
  let capacity = BASE_CAPACITY;
  if (overtime) capacity *= 1 + OVERTIME_BONUS;
  if (overtimePenalty) capacity *= 1 - OVERTIME_RECOVERY;
  return capacity;
}

// Потери считаем В ДНЯХ и складываем: так разбор итогов может показать,
// сколько именно дней съел техдолг, сколько — незавершёнка, сколько — усталость.
export function capacityLosses(state) {
  const raw = rawCapacity({
    overtime: Boolean(state.overtime),
    overtimePenalty: (state.overtimeRecovery || 0) > 0,
  });
  const debtDays = raw * debtPenalty(state.debt);
  const wipDays = raw * wipPenalty(state.carryoverDays || 0);
  const burnoutDays = raw * burnoutPenalty(state.burnout || 0);
  return { raw, debtDays, wipDays, burnoutDays, total: debtDays + wipDays + burnoutDays };
}

// Единственная точка, где считается доступная ёмкость: движок и экран решений обязаны
// показывать одно и то же число, иначе тренажёр врёт в самом интерфейсе.
export function capacityAfterLosses(state, { extraDays = 0, bugs = 0 } = {}) {
  const losses = capacityLosses(state);
  let capacity = losses.raw - losses.total - extraDays - bugs;
  if (capacity < losses.raw * MIN_CAPACITY_SHARE) capacity = losses.raw * MIN_CAPACITY_SHARE;
  return capacity;
}

export function effectiveCapacity(state) {
  return capacityAfterLosses(state);
}

export function bugDays(state, rng) {
  const expected = Math.max(0, state.debt || 0) * BUGS_PER_DEBT_UNIT;
  if (expected === 0) return 0;
  if (!rng) return Math.round(expected * 10) / 10;
  const jitter = 1 + (rng.next() * 2 - 1) * BUG_SPREAD;
  return Math.max(0, Math.round(expected * jitter * 10) / 10);
}

// Гасим ли долг в этом спринте: стоимость платится сейчас, выгода — дальше.
export function applyDebt(state, decision) {
  const debt = Math.max(0, state.debt || 0);
  const untreated = debt + DEBT_PER_SPRINT;
  if (decision === "refactor") {
    return { debt: Math.max(0, untreated - DEBT_REFACTOR_RELIEF), spentDays: DEBT_REFACTOR_COST };
  }
  return { debt: untreated, spentDays: 0 };
}

export function nextBurnout(burnout, overtimeUsed) {
  const current = Math.max(0, burnout || 0);
  if (overtimeUsed) return current + 1;
  return Math.max(0, current - 1);
}
