import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, runSprint } from "../src/engine/reducer.js";
import { summarise, counterfactual, playStrategy, STRATEGIES } from "../src/engine/report.js";
import {
  esc,
  num,
  renderBriefing,
  renderDecisions,
  renderResult,
  renderReport,
  renderApp,
} from "../src/ui/render.js";

test("esc escapes html metacharacters", () => {
  assert.equal(esc('<script>"x"&</script>'), "&lt;script&gt;&quot;x&quot;&amp;&lt;/script&gt;");
});

test("num trims trailing zeros", () => {
  assert.equal(num(23.8), "23.8");
  assert.equal(num(40), "40");
  assert.equal(num(33.55, 2), "33.55");
});

test("the briefing shows the scenario, the deadline and the capacity", () => {
  const html = renderBriefing(createInitialState());
  assert.match(html, /Релиз «Онбординг 2\.0»/);
  assert.match(html, /240/);
  assert.match(html, /data-action="start"/);
});

test("the decisions screen lists the sprint plan, the events and all four decisions", () => {
  const html = renderDecisions(createInitialState());
  assert.match(html, /Экран приветствия/);
  assert.match(html, /Импорт сотрудников из CSV/);
  assert.match(html, /Клиент просит экспорт в PDF к пилоту/);
  assert.match(html, /data-action="estimate"/);
  assert.match(html, /data-action="event" data-id="e1" data-value="decline"/);
  assert.match(html, /data-action="debt"/);
  assert.match(html, /data-action="overtime"/);
  assert.match(html, /data-action="run"/);
});

test("a blind plan promises less than an estimated one on the same screen", () => {
  const honest = renderDecisions({ ...createInitialState(), estimateMode: "pert" });
  const blind = renderDecisions({ ...createInitialState(), estimateMode: "blind" });
  assert.match(honest, /34 дней/);
  assert.match(blind, /23\.8 дней/);
});

test("the result screen reports what was finished and what slipped", () => {
  const state = createInitialState();
  const after = runSprint({ ...state, estimateMode: "pert" });
  const html = renderResult(after, after);
  assert.match(html, /Спринт 1/);
  assert.match(html, /data-action="next"/);
});

test("renderApp routes by view", () => {
  const state = createInitialState();
  assert.match(renderApp(state, "briefing", null, null), /data-action="start"/);
  assert.match(renderApp(state, "decisions", null, null), /data-action="run"/);
});

test("the report shows the probability, the wasted capacity and the counterfactual", () => {
  const state = playStrategy(STRATEGIES.usual);
  const html = renderReport(state, { mine: summarise(state, "report"), counter: counterfactual() });
  assert.match(html, /Вероятность успеть к дедлайну/);
  assert.match(html, /Ушло в никуда/);
  assert.match(html, /Та же команда с дисциплиной/);
  assert.match(html, /data-action="restart"/);
  assert.match(html, /не оценивали/);
});

test("a disciplined run reports a hundred percent on time", () => {
  const state = playStrategy(STRATEGIES.disciplined);
  const html = renderReport(state, { mine: summarise(state, "report"), counter: counterfactual() });
  assert.match(html, />100%</);
});

test("the run button stays disabled until every incoming event is decided", () => {
  const pending = renderDecisions(createInitialState());
  assert.match(pending, /data-action="run" disabled/);
  assert.match(pending, /Сначала решите по каждому входящему/);

  const decided = renderDecisions({
    ...createInitialState(),
    eventChoices: { e1: "take", e2: "decline" },
  });
  assert.doesNotMatch(decided, /data-action="run" disabled/);
});

test("the capacity on the screen is the capacity the sprint will really have", () => {
  const html = renderDecisions({ ...createInitialState(), debt: 10 });
  // 40 − 8 (техдолг) − 4 (ожидаемые баги) = 28
  assert.match(html, /доступной ёмкости 28 дней/);
});

test("the report lets the player reconcile promised, delivered and left", () => {
  const state = playStrategy(STRATEGIES.deferred_scope);
  const html = renderReport(state, { mine: summarise(state, "report"), counter: counterfactual() });
  assert.match(html, /Перенесено из плана/);
  assert.match(html, /Отложено и вынесено в бэклог/);
  assert.match(html, /Списано в бэклог обменом/);
  assert.match(html, /Разница между планом и фактом/);
});
