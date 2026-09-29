// Собирает ES-модули в один классический скрипт: модули не работают из file://.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Порядок обязателен: константы вычисляются на верхнем уровне модуля.
export const SOURCES = [
  "src/engine/rng.js",
  "src/engine/estimate.js",
  "src/engine/model.js",
  "src/data/scenario.js",
  "src/engine/reducer.js",
  "src/engine/report.js",
  "src/ui/render.js",
  "src/app.js",
];

export const API = ["mount"];

// Вырезает модульный синтаксис. Импорты бывают многострочными, поэтому идём по строкам,
// а не регуляркой: от строки `import` до строки, которая закрывается `;`.
function stripModuleSyntax(code) {
  const out = [];
  let skipping = false;
  for (const line of code.split("\n")) {
    if (!skipping && /^\s*import\b/.test(line)) {
      if (/;\s*$/.test(line)) continue;
      skipping = true;
      continue;
    }
    if (skipping) {
      if (/;\s*$/.test(line)) skipping = false;
      continue;
    }
    out.push(line.replace(/^export\s+(function|const|let|class)\b/, "$1"));
  }
  return out.join("\n");
}

export function bundle(sources) {
  const parts = sources.map((relative) => {
    const code = stripModuleSyntax(readFileSync(join(ROOT, relative), "utf8"));
    return `/* --- ${relative} --- */\n${code.trim()}`;
  });
  const api = API.join(", ");
  return `(function () {\n"use strict";\n${parts.join("\n\n")}\n\nwindow.PlanningTutor = { ${api} };\n})();\n`;
}

export function pageScript() {
  return bundle(SOURCES);
}

export function pageHtml() {
  const css = readFileSync(join(ROOT, "styles.css"), "utf8");
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Тренажёр планирования релиза</title>
<style>
${css}
</style>
</head>
<body>
<main id="app" class="app"></main>
<script>
${pageScript()}
window.PlanningTutor.mount(document.getElementById("app"));
</script>
</body>
</html>
`;
}

export function writeBundle() {
  const js = pageScript();
  writeFileSync(join(ROOT, "bundle.js"), js);
  mkdirSync(join(ROOT, "dist"), { recursive: true });
  writeFileSync(join(ROOT, "dist/planning-tutor.html"), pageHtml());
  return { js, html: join(ROOT, "dist/planning-tutor.html") };
}

if (process.argv[1] && process.argv[1].endsWith("bundle.mjs")) {
  const result = writeBundle();
  console.log(`bundle.js: ${SOURCES.length} файлов, ${result.js.length} байт`);
  console.log("dist/planning-tutor.html: готов");
}
