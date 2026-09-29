// Сценарий: релиз «Онбординг 2.0». 6 спринтов, дедлайн — конец 6-го спринта.
// `likely` — правда о задаче (сколько реально займёт, дни). Игрок её не видит:
// он видит только свою оценку, а факт движок сэмплит из распределения.
import { SPRINT_DAYS, TEAM_SIZE, rawCapacity } from "../engine/model.js";

export const SPRINTS = [
  {
    id: 1,
    theme: "Ядро онбординга",
    tasks: [
      { id: "s1-t1", title: "Экран приветствия", likely: 8, priority: 1 },
      { id: "s1-t2", title: "Импорт сотрудников из CSV", likely: 10, priority: 2 },
      { id: "s1-t3", title: "SSO-вход через корпоративный IdP", likely: 10, priority: 3 },
      { id: "s1-t4", title: "Валидация телефонов и почт", likely: 6, priority: 4 },
    ],
    events: [
      { id: "e1", title: "Клиент просит экспорт в PDF к пилоту", likely: 6, urgent: true },
      { id: "e2", title: "Баг в проде: не уходят письма-приглашения", likely: 4, urgent: true },
    ],
  },
  {
    id: 2,
    theme: "Мастер онбординга",
    tasks: [
      { id: "s2-t1", title: "Wizard из трёх шагов", likely: 11, priority: 1 },
      { id: "s2-t2", title: "Загрузка аватара", likely: 7, priority: 2 },
      { id: "s2-t3", title: "Права доступа по ролям", likely: 12, priority: 3 },
      { id: "s2-t4", title: "Письма-приглашения", likely: 5, priority: 4 },
    ],
    events: [
      { id: "e3", title: "PM обещал партнёру интеграцию с их SSO", likely: 8, urgent: true },
      { id: "e4", title: "Флаки-тесты валят CI", likely: 3, urgent: false },
    ],
  },
  {
    id: 3,
    theme: "Интеграции",
    tasks: [
      { id: "s3-t1", title: "Интеграция с HR-системой", likely: 12, priority: 1 },
      { id: "s3-t2", title: "Массовые операции над сотрудниками", likely: 8, priority: 2 },
      { id: "s3-t3", title: "Аудит-лог действий", likely: 8, priority: 3 },
      { id: "s3-t4", title: "Экспорт отчёта в XLSX", likely: 6, priority: 4 },
    ],
    events: [
      { id: "e5", title: "Юристы требуют журнал согласий", likely: 5, urgent: true },
      { id: "e6", title: "Срочный фикс по безопасности", likely: 7, urgent: true },
    ],
  },
  {
    id: 4,
    theme: "Аналитика",
    tasks: [
      { id: "s4-t1", title: "Дашборд онбординга", likely: 11, priority: 1 },
      { id: "s4-t2", title: "Уведомления в корпоративный мессенджер", likely: 8, priority: 2 },
      { id: "s4-t3", title: "Поиск по сотрудникам", likely: 7, priority: 3 },
      { id: "s4-t4", title: "Тёмная тема интерфейса", likely: 5, priority: 4 },
    ],
    events: [
      { id: "e7", title: "Дизайн переделан под новый бренд", likely: 9, urgent: true },
      { id: "e8", title: "Долг: дублирование кода в импорте", likely: 5, urgent: false },
    ],
  },
  {
    id: 5,
    theme: "Готовность к продажам",
    tasks: [
      { id: "s5-t1", title: "Шаблоны онбординг-планов", likely: 11, priority: 1 },
      { id: "s5-t2", title: "Мобильная вёрстка", likely: 9, priority: 2 },
      { id: "s5-t3", title: "Метрики воронки найма", likely: 8, priority: 3 },
      { id: "s5-t4", title: "Автонапоминания", likely: 6, priority: 4 },
    ],
    events: [
      { id: "e9", title: "Инвестору нужно демо-видео фичи", likely: 6, urgent: true },
      { id: "e10", title: "Инцидент: логи утекают наружу", likely: 8, urgent: true },
    ],
  },
  {
    id: 6,
    theme: "Релиз",
    tasks: [
      { id: "s6-t1", title: "Нагрузочное тестирование", likely: 9, priority: 1 },
      { id: "s6-t2", title: "Миграция данных первых клиентов", likely: 12, priority: 1 },
      { id: "s6-t3", title: "Публичный API", likely: 8, priority: 2 },
      { id: "s6-t4", title: "Гайд для администратора", likely: 5, priority: 4 },
    ],
    events: [
      { id: "e11", title: "Клиент просит кастомный отчёт", likely: 7, urgent: false },
      { id: "e12", title: "Регресс после промежуточного релиза", likely: 6, urgent: true },
    ],
  },
];

export const SCENARIO = {
  id: "onboarding-2-0",
  seed: "onboarding-2-0",
  title: "Релиз «Онбординг 2.0»",
  developers: TEAM_SIZE,
  sprintDays: SPRINT_DAYS,
  deadlineSprint: SPRINTS.length,
  totalCapacity: SPRINTS.length * rawCapacity(),
};

export function plannedTruthDays() {
  return SPRINTS.reduce((sum, s) => sum + s.tasks.reduce((acc, t) => acc + t.likely, 0), 0);
}

export function eventsTruthDays() {
  return SPRINTS.reduce((sum, s) => sum + s.events.reduce((acc, e) => acc + e.likely, 0), 0);
}
