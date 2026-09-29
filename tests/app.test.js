// UI-проводка без браузера: минимальный фейковый DOM, событие клика по data-action.
import test from "node:test";
import assert from "node:assert/strict";
import { mount } from "../src/app.js";

function fakeRoot() {
  const listeners = {};
  return {
    innerHTML: "",
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    click(action, dataset = {}) {
      listeners.click({ target: { closest: () => ({ dataset: { action, ...dataset } }) } });
    },
    miss() {
      listeners.click({ target: { closest: () => null } });
    },
  };
}

test("the app walks the whole game loop from briefing to report", () => {
  const root = fakeRoot();
  mount(root);
  assert.match(root.innerHTML, /data-action="start"/);

  root.click("start");
  assert.match(root.innerHTML, /data-action="run"/);

  // шесть спринтов: выбор оценки, отказ от внеплана, погашение долга, без переработок
  for (let sprint = 0; sprint < 6; sprint += 1) {
    root.click("estimate", { value: "pert" });
    for (const id of [`e${sprint * 2 + 1}`, `e${sprint * 2 + 2}`]) {
      root.click("event", { id, value: "decline" });
    }
    root.click("debt", { value: "refactor" });
    root.click("overtime", { value: "no" });
    root.click("run");
    assert.match(root.innerHTML, /data-action="next"/);
    root.click("next");
  }

  assert.match(root.innerHTML, /Вероятность успеть к дедлайну/);
  assert.match(root.innerHTML, />100%/);

  root.click("restart");
  assert.match(root.innerHTML, /data-action="start"/);
});

test("a click outside any action is ignored", () => {
  const root = fakeRoot();
  mount(root);
  const before = root.innerHTML;
  root.miss();
  assert.equal(root.innerHTML, before);
});

test("an unknown action does not redraw", () => {
  const root = fakeRoot();
  mount(root);
  root.click("start");
  const before = root.innerHTML;
  root.click("nonsense");
  assert.equal(root.innerHTML, before);
});

test("taken scope shows up in the report as wasted capacity", () => {
  const root = fakeRoot();
  mount(root);
  root.click("start");
  for (let sprint = 0; sprint < 6; sprint += 1) {
    root.click("estimate", { value: "blind" });
    for (const id of [`e${sprint * 2 + 1}`, `e${sprint * 2 + 2}`]) {
      root.click("event", { id, value: "take" });
    }
    root.click("debt", { value: "ignore" });
    root.click("run");
    root.click("next");
  }
  assert.match(root.innerHTML, /Вероятность успеть к дедлайну/);
  assert.match(root.innerHTML, /Ушло в никуда/);
  assert.match(root.innerHTML, /0%/);
});

test("a blocked sprint answers the click instead of staying silent", () => {
  const root = fakeRoot();
  mount(root);
  root.click("start");
  assert.doesNotMatch(root.innerHTML, /Спринт не проведён/);

  root.click("run");
  assert.doesNotMatch(root.innerHTML, /data-action="next"/); // спринт не проведён
  assert.match(root.innerHTML, /Спринт не проведён/); // но игрок получил объяснение
  assert.match(root.innerHTML, /class="panel attention"/); // и видит, куда смотреть

  root.click("event", { id: "e1", value: "take" });
  root.click("event", { id: "e2", value: "decline" });
  root.click("run");
  assert.match(root.innerHTML, /data-action="next"/);
  assert.doesNotMatch(root.innerHTML, /Спринт не проведён/);
});
