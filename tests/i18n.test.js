"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const I18n = require("../js/i18n.js");
const PF = require("../js/algorithms.js");

function memoryStorage(initial) {
  const values = new Map(initial ? [[I18n.STORAGE_KEY, initial]] : []);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test("Chinese and English have identical keys and interpolation parameters", () => {
  const chinese = I18n.messages["zh-CN"];
  const english = I18n.messages.en;
  assert.deepEqual(Object.keys(chinese).sort(), Object.keys(english).sort());
  for (const key of Object.keys(chinese)) {
    assert.ok(chinese[key].trim());
    assert.ok(english[key].trim());
    const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    assert.deepEqual(placeholders(chinese[key]), placeholders(english[key]), key);
  }
});

test("all declarative UI translations and controller message keys exist", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  const keys = [
    ...[...html.matchAll(/data-i18n(?:-(?:title|aria-label|placeholder|content))?="([^"]+)"/g)].map(match => match[1]),
    ...[...app.matchAll(/"((?:status|controls|metrics|grid|mobile|errors)\.[A-Za-z]+)"/g)].map(match => match[1])
  ];
  assert.ok(keys.length > 100);
  for (const language of ["zh-CN", "en"]) {
    keys.forEach(key => assert.ok(Object.hasOwn(I18n.messages[language], key), `${language}: ${key}`));
  }
  assert.equal(html.includes('id="algorithm-description"'), false, "keep the user's simplified UI");
  assert.equal(app.includes('$("algorithm-description")'), false, "no stale deleted-element references");
});

test("saved preferences win; supported browser locales are normalized; unknown locales fall back", () => {
  assert.equal(I18n.resolveLocale("zh-CN", ["en-US"]), "zh-CN");
  assert.equal(I18n.resolveLocale("en", ["zh-CN"]), "en");
  assert.equal(I18n.resolveLocale(null, ["en-GB"]), "en");
  assert.equal(I18n.resolveLocale(null, ["zh-SG"]), "zh-CN");
  assert.equal(I18n.resolveLocale(null, ["fr-FR", "en-US"]), "en");
  assert.equal(I18n.resolveLocale("invalid", ["de-DE"]), "zh-CN");
  assert.equal(I18n.resolveLocale("__proto__", []), "zh-CN");
});

test("language preference persists across localizer instances", () => {
  const storage = memoryStorage();
  const localizer = I18n.createLocalizer({ storage, languages: ["zh-CN"] });
  assert.equal(localizer.language, "zh-CN");
  assert.equal(localizer.setLanguage("en"), true);
  assert.equal(localizer.t("controls.run"), "Find path");
  assert.equal(storage.getItem(I18n.STORAGE_KEY), "en");
  assert.equal(I18n.createLocalizer({ storage, languages: ["zh-CN"] }).language, "en");
  assert.equal(localizer.setLanguage("unknown"), false);
  assert.equal(localizer.language, "en");
});

test("blocked storage does not prevent startup or switching", () => {
  const storage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  const localizer = I18n.createLocalizer({ storage, languages: ["en-US"] });
  assert.equal(localizer.language, "en");
  assert.equal(localizer.setLanguage("zh-CN"), true);
  assert.equal(localizer.t("status.mapReady"), "地图已就绪");
});

test("dynamic messages interpolate safely, retaining seed text and using fallback keys", () => {
  assert.equal(I18n.translate("controls.speedValue", { speed: 50 }, "en"), "50 steps / sec");
  assert.equal(I18n.translate("grid.size", { width: 11, height: 9 }, "zh-CN"), "11 × 9 网格");
  const params = { algorithm: "DFS backtracking", walls: 40, seed: "<img src=x> {seed} 中文" };
  assert.equal(I18n.translate("status.mazeDone", params, "en"), "DFS backtracking maze generated · 40 walls · Seed: <img src=x> {seed} 中文");
  assert.equal(I18n.translate("controls.run", {}, "invalid"), "开始寻路");
  for (const key of ["missing.key", "toString", "__proto__"]) assert.equal(I18n.translate(key), key);
});

test("algorithm errors expose stable localizable codes without changing RangeError behavior", () => {
  const grid = PF.createGrid(5, 5);
  const cases = [
    [() => PF.createGrid(0, 5), "dimensions"],
    [() => PF.findPath(grid, "unknown"), "searchAlgorithm"],
    [() => PF.generateMaze(5, 5, "unknown"), "mazeAlgorithm"],
    [() => PF.findPath({ ...grid, start: -1 }), "grid"],
    [() => PF.findPath({ ...grid, walls: new Uint8Array(25).fill(1) }), "endpoints"]
  ];
  for (const [run, code] of cases) {
    assert.throws(run, error => {
      assert.ok(error instanceof RangeError);
      assert.equal(error.code, code);
      const english = I18n.translate(`errors.${error.code}`, error.params, "en");
      assert.ok(!/[\u3400-\u9fff]/.test(english));
      assert.ok(!/\{\w+\}/.test(english));
      return true;
    });
  }
});
