// Состояние -> HTML-строка. Никаких побочных эффектов: тестируется без браузера.
import { SPRINTS, SCENARIO } from "../data/scenario.js";
import { capacityLosses, DEBT_REFACTOR_COST, BUGS_PER_DEBT_UNIT } from "../engine/model.js";
import { planSprint, TOTAL_CAPACITY } from "../engine/reducer.js";

export function esc(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

export function num(value, digits = 1) {
  return Number(value).toFixed(digits).replace(/\.0+$/, "");
}

export function bar(value, max, cls = "") {
  const width = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return `<div class="bar ${cls}"><span style="width:${width.toFixed(1)}%"></span></div>`;
}

export function histBars(spread, budgetLeft) {
  const peak = Math.max(1, ...spread.buckets);
  return spread.buckets
    .map((count, index) => {
      const low = spread.min + index * spread.width;
      const hit = low <= budgetLeft;
      const height = Math.round((count / peak) * 100);
      const title = `${num(low, 0)}-${num(low + spread.width, 0)} дн: ${count} прогонов`;
      return `<span class="${hit ? "hit" : ""}" style="height:${Math.max(2, height)}%" title="${title}"></span>`;
    })
    .join("");
}

export function renderApp(state, view, lastResult, report) {
  if (view === "briefing") return renderBriefing(state);
  if (view === "result") return renderResult(state, lastResult);
  if (view === "report") return renderReport(state, report);
  return renderDecisions(state);
}

export function renderBriefing(state) {
  const tasks = SPRINTS.reduce((sum, sprint) => sum + sprint.tasks.length, 0);
  const events = SPRINTS.reduce((sum, sprint) => sum + sprint.events.length, 0);
  return `
  <h1>${esc(SCENARIO.title)}</h1>
  <p class="dim">Вы тимлид. Через ${SPRINTS.length} спринтов — релиз. В каждом спринте вы принимаете
  четыре решения и платите за них ёмкостью команды.</p>
  <div class="panel">
    <div class="grid">
      <div><h3>Команда</h3><div class="big">${SCENARIO.developers}</div><div class="small dim">разработчика</div></div>
      <div><h3>Спринтов до релиза</h3><div class="big">${SPRINTS.length}</div><div class="small dim">по ${SCENARIO.sprintDays} рабочих дней</div></div>
      <div><h3>Ёмкость</h3><div class="big">${TOTAL_CAPACITY}</div><div class="small dim">человеко-дней всего</div></div>
      <div><h3>Скоуп</h3><div class="big">${tasks}</div><div class="small dim">задач в плане</div></div>
    </div>
  </div>
  <div class="panel">
    <h3>Как это работает</h3>
    <p>Каждый спринт: оценка задач, входящие требования, техдолг и переработки. После шестого
    спринта — разбор: успели ли вы к дедлайну, куда ушла ёмкость и что дала бы дисциплина.</p>
    <p class="dim small">За релиз прилетит ${events} внеплановых запросов. Каких — заранее не видно.</p>
  </div>
  <button class="primary" data-action="start">Начать спринт 1</button>`;
}

function choice(active, action, value, label, hint, id) {
  const idAttr = id ? ` data-id="${id}"` : "";
  return `<button class="${active ? "on" : ""}" data-action="${action}"${idAttr} data-value="${value}">
    ${esc(label)}<div class="hint">${esc(hint)}</div></button>`;
}

export function renderDecisions(state) {
  const sprint = SPRINTS[state.sprintIndex];
  const plan = planSprint(state);
  const losses = capacityLosses(state);
  const refactorCost = state.debtPlan === "refactor" ? DEBT_REFACTOR_COST : 0;
  const capacity = Math.max(0, losses.raw - losses.total - refactorCost);
  const overtime = state.overtime;
  const overload = plan.promisedDays - capacity;

  const taskRows = plan.planned
    .map(
      (task) => `<tr><td>${esc(task.title)}</td><td class="num">${num(task.promised)}</td>
      <td class="dim">${task.priority === 4 ? "можно порезать" : "критично"}</td></tr>`
    )
    .join("");

  const eventBlocks = sprint.events
    .map((event) => {
      const chosen = state.eventChoices[event.id];
      return `
      <div class="panel">
        <h3>${event.urgent ? "Срочно" : "Не срочно"}</h3>
        <p><strong>${esc(event.title)}</strong> — примерно ${num(event.likely)} дней работы</p>
        <div class="grid">
          ${choice(chosen === "take", "event", "take", "Взять", "внеплановая работа влезает в спринт как есть", event.id)}
          ${choice(chosen === "swap", "event", "swap", "Взять со обменом", "возьмём, но снимем самую низкоприоритетную задачу плана в бэклог", event.id)}
          ${choice(chosen === "defer", "event", "defer", "Отложить", "не сейчас, но скоуп не отменён — релиз сдвинется", event.id)}
          ${choice(chosen === "decline", "event", "decline", "Отказать", "скоуп не растёт вообще", event.id)}
        </div>
      </div>`;
    })
    .join("");

  return `
  <h1>Спринт ${sprint.id}: ${esc(sprint.theme)}</h1>
  <p class="dim">Спринтов пройдено: ${state.sprintIndex} из ${SPRINTS.length}. Техдолг: ${state.debt},
  выгорание: ${state.burnout}, незавершёнка: ${num(state.carryoverDays)} дн.</p>

  <div class="panel">
    <h3>1. Оценка задач</h3>
    <div class="grid">
      ${choice(state.estimateMode === "pert", "estimate", "pert", "Трёхточечная оценка (PERT)", "дёшево по времени, план перестаёт врать")}
      ${choice(state.estimateMode === "blind", "estimate", "blind", "Без оценки, просто начинаем", "план будет обещать меньше, чем выйдет")}
    </div>
    <p class="small dim">План спринта обещает <strong>${num(plan.promisedDays)} дней</strong> против
    доступной ёмкости ${num(capacity)} дней.</p>
  </div>

  <div class="panel">
    <h3>2. План спринта</h3>
    <table>
      <tr><th>Задача</th><th class="num">Обещано</th><th></th></tr>
      ${taskRows}
    </table>
  </div>

  <div class="panel">
    <h3>3. Входящие</h3>
    ${eventBlocks || "<p>Входящих нет.</p>"}
  </div>

  <div class="panel">
    <h3>4. Техдолг</h3>
    <p class="small dim">Сейчас долг ${state.debt}: это отнимает ${num(losses.debtDays)} дней ёмкости
    в этом спринте и ${num(state.debt * BUGS_PER_DEBT_UNIT)} дней на баги.</p>
    <div class="grid">
      ${choice(state.debtPlan === "refactor", "debt", "refactor", "Погасить долг", `−${DEBT_REFACTOR_COST} дней ёмкости сейчас, скорость перестаёт падать`)}
      ${choice(state.debtPlan === "ignore", "debt", "ignore", "Отложить долг", "+5 к долгу, скорость падает дальше")}
    </div>
  </div>

  <div class="panel">
    <h3>5. Переработки</h3>
    <div class="grid">
      ${choice(!overtime, "overtime", "no", "Не просить", "обычная ёмкость")}
      ${choice(overtime, "overtime", "yes", "Попросить", "+20% ёмкости сейчас, −30% в следующем спринте, +выгорание")}
    </div>
  </div>

  <div class="panel">
    <h3>Итого</h3>
    <div class="row">
      <div>
        <div class="big ${overload > 0 ? "warn" : "ok"}">${overload > 0 ? "+" : ""}${num(overload)} дн</div>
        <div class="small dim">${overload > 0 ? "план превышает ёмкость — часть работы уедет в следующий спринт" : "план помещается в ёмкость"}</div>
      </div>
      <button class="primary" data-action="run">Провести спринт</button>
    </div>
  </div>`;
}

export function renderResult(state, lastResult) {
  const record = lastResult.history[lastResult.history.length - 1];
  const doneRows = record.done
    .map((task) => `<tr><td>${esc(task.title)}</td><td class="num">${num(task.promised)}</td>
      <td class="num ${task.actual > task.promised ? "bad" : "ok"}">${num(task.actual)}</td></tr>`)
    .join("");
  const carriedRows = record.carried
    .map((task) => `<tr><td>${esc(task.title)}</td><td class="num">${num(task.remaining)}</td></tr>`)
    .join("");
  const droppedRows = record.dropped.map((title) => `<li>${esc(title)} — ушла в бэклог</li>`).join("");
  const lost = record.debtDays + record.wipDays + record.burnoutDays + record.refactorCost + record.bugs;
  const finished = state.sprintIndex >= SPRINTS.length;
  return `
  <h1>Спринт ${record.sprint}: итог</h1>
  <p class="dim">${esc(record.theme)}. Ёмкость ${num(record.raw)} дней, из них утекло ${num(lost)} дней
  (техдолг ${num(record.debtDays)}, незавершёнка ${num(record.wipDays)}, усталость ${num(record.burnoutDays)},
  рефакторинг ${num(record.refactorCost)}, баги ${num(record.bugs)}). Работы поместилось: ${num(record.spent)} дней.</p>

  <div class="panel">
    <h3>Сделано</h3>
    <table>
      <tr><th>Задача</th><th class="num">Обещали</th><th class="num">Вышло</th></tr>
      ${doneRows || "<tr><td colspan='3' class='dim'>Ничего не закрыли</td></tr>"}
    </table>
  </div>

  <div class="panel">
    <h3>Перенесено на следующий спринт</h3>
    <table>
      <tr><th>Задача</th><th class="num">Осталось дней</th></tr>
      ${carriedRows || "<tr><td colspan='2' class='dim'>Переносов нет</td></tr>"}
    </table>
    ${droppedRows ? `<h3 style="margin-top:12px">Обмены за счёт плана</h3><ul>${droppedRows}</ul>` : ""}
  </div>

  <button class="primary" data-action="next">${finished ? "Показать разбор" : "Следующий спринт"}</button>`;
}

function attributionRows(summary) {
  const a = summary.attribution;
  const rows = [
    ["Внеплановая работа, которую взяли", a.scopeAdded],
    ["Техдолг съел скорости", a.debtLoss],
    ["Переключения из-за незавершёнки", a.wipLoss],
    ["Усталость команды", a.burnoutLoss],
    ["Баги из-за долга", a.bugLoss],
    ["Рефакторинг (заплатили, чтобы не терять дальше)", a.refactorCost],
  ];
  return rows
    .map(([label, value]) => `<tr><td>${label}</td><td class="num">${num(value)}</td></tr>`)
    .join("");
}

export function renderReport(state, report) {
  const mine = report.mine;
  const counter = report.counter;
  const onTimePct = Math.round(mine.onTime * 100);
  const counterPct = Math.round(counter.onTime * 100);
  const verdict = mine.onTime >= 0.8 ? "ok" : mine.onTime >= 0.4 ? "warn" : "bad";
  const estimationNote =
    state.estimateMode === "blind" || mine.attribution.estimationGap > 20
      ? "Вы не оценивали задачи: план обещал меньше, чем вышло. Разница осела в переносах."
      : "Вы оценивали задачи: план не врал, но и запаса в нём не было.";

  const sprintRows = mine.history
    .map(
      (s) => `<tr><td>Спринт ${s.sprint}</td><td class="num">${num(s.raw)}</td>
      <td class="num">${num(s.spent)}</td>
      <td class="num">${num(s.debtDays + s.wipDays + s.burnoutDays + s.refactorCost + s.bugs)}</td>
      <td class="num">${s.doneCount}/${s.doneCount + s.carriedCount}</td></tr>`
    )
    .join("");

  return `
  <h1>Разбор</h1>
  <p class="dim">${esc(SCENARIO.title)}: шесть спринтов пройдены.</p>

  <div class="panel">
    <h3>Вероятность успеть к дедлайну</h3>
    <div class="big ${verdict}">${onTimePct}%</div>
    <p>${estimationNote}</p>
    ${bar(onTimePct, 100, verdict)}
    <p class="small dim">Монте-Карло на 2000 прогонов по <strong>оставшейся</strong> работе:
    медиана ещё ${num(mine.p50)} дней, 85-й процентиль ${num(mine.p85)} дней. В бюджете осталось
    ${num(mine.budgetLeft)} дней.</p>
    ${
      mine.spread.buckets.length
        ? `<div class="hist">${histBars(mine.spread, mine.budgetLeft)}</div>
    <p class="small dim">Гистограмма: сколько ещё дней работы осталось по прогонам. Подсвеченные
    столбцы — те, что укладывались в остаток бюджета.</p>`
        : ""
    }
  </div>

  <div class="panel">
    <h3>Куда ушла ёмкость</h3>
    <div class="grid">
      <div><h3>Работа</h3><div class="big ok">${num(mine.usedDays)}</div><div class="small dim">дней стало продуктом</div></div>
      <div><h3>Ушло в никуда</h3><div class="big bad">${num(mine.overheadDays)}</div><div class="small dim">дней сгорело в долге, багах и переключениях</div></div>
      <div><h3>КПД ёмкости</h3><div class="big">${Math.round(mine.efficiency * 100)}%</div><div class="small dim">работа / израсходованная ёмкость</div></div>
      <div><h3>Израсходовано</h3><div class="big">${num(mine.consumed)} / ${TOTAL_CAPACITY}</div><div class="small dim">человеко-дней</div></div>
    </div>
    ${bar(mine.overheadDays, Math.max(1, mine.consumed), "bad")}
  </div>

  <div class="panel">
    <h3>Вклад решений</h3>
    <table>${attributionRows(mine)}
      <tr><td>Обещали работы</td><td class="num">${num(mine.committedPromised)} дн</td></tr>
      <tr><td>Из неё закрыли к дедлайну</td><td class="num">${num(mine.promisedDelivered)} дн</td></tr>
      <tr><td>Осталось в скоупе после дедлайна</td><td class="num">${num(mine.remaining)} дн</td></tr>
      <tr><td>Отказались от внеплановой работы</td><td class="num">${num(mine.attribution.declinedDays)} дн</td></tr>
      <tr><td>Техдолг на руках к релизу</td><td class="num">${mine.debt}</td></tr>
    </table>
  </div>

  <div class="panel">
    <h3>По спринтам</h3>
    <table>
      <tr><th>Спринт</th><th class="num">Ёмкость</th><th class="num">Работа</th>
      <th class="num">Потери</th><th class="num">Закрыто</th></tr>
      ${sprintRows}
    </table>
  </div>

  <div class="panel">
    <h3>Та же команда с дисциплиной</h3>
    <p>Тот же сценарий, тот же seed, тот же движок. Отличия только в решениях: задачи оценивали
    трёхточечной оценкой, во внеплане отказывали, долг гасили, переработок не просили.</p>
    <div class="grid">
      <div><h3>Успели к дедлайну</h3><div class="big ok">${counterPct}%</div></div>
      <div><h3>КПД ёмкости</h3><div class="big">${Math.round(counter.efficiency * 100)}%</div></div>
      <div><h3>Израсходовано</h3><div class="big">${num(counter.consumed)} / ${TOTAL_CAPACITY}</div></div>
      <div><h3>Техдолг</h3><div class="big ok">${counter.debt}</div></div>
    </div>
    <p class="small dim">Дисциплина не ускоряет работу — она не даёт ёмкости исчезнуть.
    Разница между вашим прогоном и этим: ${num(Math.abs(mine.overheadDays - counter.overheadDays))} дней
    ёмкости, сожжённых впустую.</p>
  </div>

  <button class="primary" data-action="restart">Пройти заново</button>`;
}
