// Прогон сценария: решения -> последствия. Всё детерминировано для данного seed.
import { SPRINTS, SCENARIO } from "../data/scenario.js";
import { createRng } from "./rng.js";
import {
  capacityLosses,
  rawCapacity,
  bugDays,
  applyDebt,
  nextBurnout,
  DEBT_REFACTOR_COST,
} from "./model.js";
import { blindEstimate, tripleEstimate, sampleEstimate, pertMean } from "./estimate.js";

export const TOTAL_CAPACITY = SCENARIO.deadlineSprint * rawCapacity();

export function createInitialState(seedText = SCENARIO.seed) {
  return {
    seed: seedText,
    sprintIndex: 0,
    phase: "decisions", // decisions -> result ... -> report
    estimateMode: "pert", // pert | blind
    debtPlan: "ignore", // refactor | ignore
    overtime: false,
    eventChoices: {}, // eventId -> take | swap | defer | decline
    debt: 0,
    burnout: 0,
    carryoverDays: 0,
    overtimeRecovery: 0,
    carryover: [],
    deferred: [],
    declinedDays: 0,
    usedDays: 0,
    overheadDays: 0,
    committedPromised: 0,
    promisedDelivered: 0,
    history: [],
    attribution: {
      estimationGap: 0,
      scopeAdded: 0,
      declinedDays: 0,
      debtLoss: 0,
      wipLoss: 0,
      burnoutLoss: 0,
      bugLoss: 0,
      refactorCost: 0,
      droppedToBacklog: 0,
    },
  };
}

export function estimateFor(likely, mode) {
  return mode === "blind" ? blindEstimate(likely) : tripleEstimate(likely);
}

// Что игрок записывает в план. Оценивал — идёт PERT-среднее (план не врёт).
// Не оценивал — в план идёт одна оптимистичная цифра, а факт тянется из широкого
// распределения: именно поэтому «план без оценки» систематически занижен.
export function promisedFor(est, mode) {
  return mode === "blind" ? est.m : pertMean(est.o, est.m, est.p);
}

// Что попадает в план спринта и сколько этот план обещает (для игрока).
export function planSprint(state) {
  const sprint = SPRINTS[state.sprintIndex];
  const planned = sprint.tasks.map((t) => {
    const est = estimateFor(t.likely, state.estimateMode);
    return {
      id: t.id,
      title: t.title,
      priority: t.priority,
      est,
      promised: promisedFor(est, state.estimateMode),
    };
  });
  const taken = sprint.events
    .filter((e) => ["take", "swap"].includes(state.eventChoices[e.id]))
    .map((e) => {
      const est = estimateFor(e.likely, state.estimateMode);
      return {
        id: e.id,
        title: e.title,
        priority: 0, // внеплановое всегда берётся в первую очередь
        est,
        promised: promisedFor(est, state.estimateMode),
        event: true,
      };
    });
  const promisedDays = planned.concat(taken).reduce((s, t) => s + t.promised, 0);
  return { sprint, planned, taken, promisedDays };
}

export function runSprint(state) {
  const sprint = SPRINTS[state.sprintIndex];
  const rng = createRng(`${state.seed}#sprint-${sprint.id}#${state.estimateMode}`);
  const losses = capacityLosses(state);
  const refactorCost = state.debtPlan === "refactor" ? DEBT_REFACTOR_COST : 0;
  const bugs = bugDays(state, rng); // (1) первым делом — шум багов
  const capacity = Math.max(0, losses.raw - losses.total - refactorCost - bugs);

  const { planned, taken } = planSprint(state);
  const queue = [...state.carryover, ...planned, ...taken].sort((a, b) => a.priority - b.priority);

  // «Хочешь взять — отдай»: под каждый swap снимаем задачу самого низкого приоритета.
  const swapCount = sprint.events.filter((e) => state.eventChoices[e.id] === "swap").length;
  const dropped = [];
  for (let i = 0; i < swapCount && queue.length > 0; i += 1) {
    let worst = 0;
    for (let j = 1; j < queue.length; j += 1) if (queue[j].priority > queue[worst].priority) worst = j;
    dropped.push(queue.splice(worst, 1)[0]);
  }

  let spent = 0;
  const done = [];
  const carried = [];
  for (const task of queue) {
    // (2) по одному случайному числу на задачу; у перенесённой задачи длительность уже есть
    const remaining = task.remaining === undefined ? sampleEstimate(task.est, rng.next()) : task.remaining;
    if (spent + remaining <= capacity) {
      spent += remaining;
      done.push({
        id: task.id,
        title: task.title,
        promised: task.promised,
        actual: remaining,
        event: Boolean(task.event),
      });
    } else {
      carried.push({ ...task, remaining });
    }
  }

  const promisedDone = done.reduce((s, t) => s + t.promised, 0);
  const estimationGap = done
    .concat(carried)
    .reduce((s, t) => s + ((t.actual === undefined ? t.remaining : t.actual) - t.promised), 0);
  let scopeAddedActual = 0;
  for (const t of done.concat(carried)) {
    if (t.event) scopeAddedActual += t.actual === undefined ? t.remaining : t.actual;
  }

  const debtAfter = applyDebt(state, state.debtPlan);
  const carryoverDays = carried.reduce((s, t) => s + t.remaining, 0);
  const deferred = state.deferred.concat(
    sprint.events
      .filter((e) => state.eventChoices[e.id] === "defer")
      .map((e) => ({ id: e.id, title: e.title, likely: e.likely, sprint: sprint.id }))
  );
  const declinedDays = sprint.events
    .filter((e) => state.eventChoices[e.id] === "decline")
    .reduce((s, e) => s + e.likely, 0);
  const droppedPromised = dropped.reduce((s, t) => s + t.promised, 0);

  const nextState = {
    ...state,
    sprintIndex: state.sprintIndex + 1,
    debt: debtAfter.debt,
    burnout: nextBurnout(state.burnout, state.overtime),
    overtimeRecovery: state.overtime ? 1 : 0,
    carryover: carried.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      est: t.est,
      promised: t.promised,
      remaining: t.remaining,
      event: t.event,
    })),
    carryoverDays,
    deferred,
    declinedDays: state.declinedDays + declinedDays,
    usedDays: state.usedDays + spent,
    overheadDays: state.overheadDays + losses.total + refactorCost + bugs,
    committedPromised:
      state.committedPromised + planned.concat(taken).reduce((s, t) => s + t.promised, 0),
    promisedDelivered: state.promisedDelivered + promisedDone,
    eventChoices: {},
    overtime: false,
    debtPlan: "ignore",
    attribution: {
      estimationGap: state.attribution.estimationGap + estimationGap,
      scopeAdded: state.attribution.scopeAdded + scopeAddedActual,
      declinedDays: state.attribution.declinedDays + declinedDays,
      debtLoss: state.attribution.debtLoss + losses.debtDays,
      wipLoss: state.attribution.wipLoss + losses.wipDays,
      burnoutLoss: state.attribution.burnoutLoss + losses.burnoutDays,
      bugLoss: state.attribution.bugLoss + bugs,
      refactorCost: state.attribution.refactorCost + refactorCost,
      droppedToBacklog: state.attribution.droppedToBacklog + droppedPromised,
    },
    history: state.history.concat([
      {
        sprint: sprint.id,
        theme: sprint.theme,
        raw: losses.raw,
        debtDays: losses.debtDays,
        wipDays: losses.wipDays,
        burnoutDays: losses.burnoutDays,
        refactorCost,
        bugs,
        capacity,
        promisedDone,
        actualDone: spent,
        spent,
        doneCount: done.length,
        carriedCount: carried.length,
        carried: carried.map((t) => ({ title: t.title, remaining: t.remaining })),
        done: done.map((t) => ({ title: t.title, promised: t.promised, actual: t.actual })),
        dropped: dropped.map((t) => t.title),
      },
    ]),
  };

  if (nextState.sprintIndex >= SPRINTS.length) nextState.phase = "report";
  return nextState;
}

// Остаток работы после всех спринтов — то, что придётся делать уже ПОСЛЕ дедлайна.
export function remainingEstimates(state) {
  const out = state.carryover.map((t) => t.est);
  for (const e of state.deferred) out.push(estimateFor(e.likely, state.estimateMode));
  return out;
}

export function remainingPromised(state) {
  const carried = state.carryover.reduce((s, t) => s + t.promised, 0);
  const deferredSum = state.deferred.reduce((s, e) => {
    const est = estimateFor(e.likely, state.estimateMode);
    return s + promisedFor(est, state.estimateMode);
  }, 0);
  return carried + deferredSum;
}
