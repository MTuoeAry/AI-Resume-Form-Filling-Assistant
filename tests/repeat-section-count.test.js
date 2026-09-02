const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadNormalizer() {
  const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
  const start = source.indexOf("function normalizeDeepScanText(value) {");
  const end = source.indexOf("function getDeepScanText(el) {", start);
  const context = { module: { exports: {} }, exports: {} };
  vm.createContext(context);
  vm.runInContext(
    `${source.slice(start, end)}\nmodule.exports = normalizeDeepScanText;`,
    context
  );
  return context.module.exports;
}

function loadRepeatCounter() {
  const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
  const start = source.indexOf("function inferRepeatItemIndexFromIdentifier(el, schemaSectionKey) {");
  const end = source.indexOf("async function waitForRepeatItem", start);
  const context = {
    module: { exports: {} },
    exports: {},
    LABEL_LIKE_SELECTOR: "label",
    getRepeatSectionRoot: (trigger) => trigger.root,
    normalizeDeepScanText: (value) => String(value || "").replace(/^\*|\*$/g, "").trim(),
    isVisible: () => true,
  };
  vm.createContext(context);
  vm.runInContext(
    `${source.slice(start, end)}\nmodule.exports = countRenderedRepeatItems;`,
    context
  );
  return context.module.exports;
}

test("repeat row labels ignore leading and trailing required markers", () => {
  const normalize = loadNormalizer();
  assert.equal(normalize("*项目名称"), "项目名称");
  assert.equal(normalize("奖项名称＊"), "奖项名称");
});

test("content mapping failure keeps a deterministic local fallback", () => {
  const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
  assert.match(source, /mappings = localMappings/);
  assert.match(source, /已降级使用本地结构化映射继续填写/);
});

test("repeat counting uses stable form-list ids when a site uses unexpected labels", () => {
  const countRendered = loadRepeatCounter();
  const controls = Array.from({ length: 8 }, (_, index) => ({
    id: `basicInfo_recruitAwardList_${index}_awardTime`,
    getAttribute: () => "",
  }));
  const root = {
    querySelectorAll(selector) {
      return selector === "label" ? [] : controls;
    },
  };

  assert.equal(
    countRendered({ root }, { sectionKey: "awards", rowLabels: ["奖项名称"] }),
    8
  );
});
