// Итоговый разбор: сколько ёмкости сожгли, какая часть стала работой и когда релиз
// с заданной вероятностью состоится. Контрфакт считается тем же движком, не «на глазок».
import { SPRINTS, SCENARIO } from "../data/scenario.js";
import { createRng } from "./rng.js";
import { monteCarloTotals, probabilityWithin, percentile, histogram } from "./estimate.js";
import {
  createInitialState,
  runSprint,
  remainingEstimates,
  remainingPromised,
  TOTAL_CAPACITY,
} from "./reducer.js";

export function summarise(state, tag = "report") {
  const totals = monteCarloTotals(remainingEstimates(state), createRng(`${state.seed}#${tag}`), 2000);
  const consumed = state.usedDays + state.overheadDays;
  const budgetLeft = Math.max(0, TOTAL_CAPACITY - consumed);
  return {
    consumed,
    budgetLeft,
    usedDays: state.usedDays,
    overheadDays: state.overheadDays,
    efficiency: consumed === 0 ? 0 : state.usedDays / consumed,
    remaining: remainingPromised(state),
    onTime: probabilityWithin(totals, budgetLeft),
    p50: percentile(totals, 50),
    p85: percentile(totals, 85),
    spread: histogram(totals, 20),
    debt: state.debt,
    burnout: state.burnout,
    committedPromised: state.committedPromised,
    promisedDelivered: state.promisedDelivered,
    attribution: state.attribution,
    history: state.history,
  };
}

export const STRATEGIES = {
  usual: { estimateMode: "blind", events: "take", debt: "ignore", overtime: false },
  estimated_but_all_scope: { estimateMode: "pert", events: "take", debt: "refactor", overtime: false },
  disciplined: { estimateMode: "pert", events: "decline", debt: "refactor", overtime: false },
  deferred_scope: { estimateMode: "pert", events: "defer", debt: "refactor", overtime: false },
  blind_overtime: { estimateMode: "blind", events: "take", debt: "ignore", overtime: true },
};

export function playStrategy(strategy, seedText = SCENARIO.seed) {
  let state = createInitialState(seedText);
  state.estimateMode = strategy.estimateMode;
  for (let i = 0; i < SPRINTS.length; i += 1) {
    for (const event of SPRINTS[i].events) state.eventChoices[event.id] = strategy.events;
    state.debtPlan = strategy.debt;
    state.overtime = strategy.overtime;
    state = runSprint(state);
  }
  return state;
}

export function counterfactual(seedText = SCENARIO.seed) {
  return summarise(playStrategy(STRATEGIES.disciplined, seedText), "counterfactual");
}
