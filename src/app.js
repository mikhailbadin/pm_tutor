// Единственное место, где есть DOM. Всё остальное — чистые функции.
import { SPRINTS } from "./data/scenario.js";
import { createInitialState, runSprint, pendingEvents } from "./engine/reducer.js";
import { summarise, counterfactual } from "./engine/report.js";
import { renderApp } from "./ui/render.js";

export function mount(root) {
  let state = createInitialState();
  let view = "briefing";
  let lastResult = null;
  let report = null;

  const draw = () => {
    // innerHTML только с нашим собственным шаблоном: все подставляемые значения —
    // задачи, события и заголовки сценария — проходят через esc() в src/ui/render.js.
    // Пользовательского ввода и внешних данных в приложении нет.
    root.innerHTML = renderApp(state, view, lastResult, report);
  };

  root.addEventListener("click", (event) => {
    const element = event.target.closest("[data-action]");
    if (!element) return;
    const { action, value, id } = element.dataset;

    if (action === "start") {
      view = "decisions";
    } else if (action === "estimate") {
      state = { ...state, estimateMode: value };
    } else if (action === "event") {
      state = { ...state, eventChoices: { ...state.eventChoices, [id]: value } };
    } else if (action === "debt") {
      state = { ...state, debtPlan: value };
    } else if (action === "overtime") {
      state = { ...state, overtime: value === "yes" };
    } else if (action === "run") {
      if (pendingEvents(state).length > 0) {
        // Не молчим: объясняем, что спринт не проведён, подсвечиваем нерешённые входящие
        // и подводим игрока к ним — иначе клик по кнопке выглядит как поломка.
        state = { ...state, nudge: (state.nudge || 0) + 1 };
        view = "decisions";
        draw();
        const first = root.querySelector && root.querySelector('[data-action="event"]');
        if (first && typeof first.scrollIntoView === "function") {
          first.scrollIntoView({ block: "center" });
        }
        return;
      }
      lastResult = runSprint(state);
      state = lastResult;
      view = "result";
    } else if (action === "next") {
      if (state.sprintIndex >= SPRINTS.length) {
        report = { mine: summarise(state, "report"), counter: counterfactual(state.seed) };
        view = "report";
      } else {
        view = "decisions";
      }
    } else if (action === "restart") {
      state = createInitialState();
      lastResult = null;
      report = null;
      view = "briefing";
    } else {
      return;
    }
    draw();
  });

  draw();
}
