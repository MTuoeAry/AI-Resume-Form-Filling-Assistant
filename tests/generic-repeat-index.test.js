const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadIdentifierIndexHelper() {
  const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
  const start = source.indexOf("function inferRepeatItemIndexFromIdentifier(el, schemaSectionKey) {");
  const end = source.indexOf("function countRenderedRepeatItems(trigger, rule)", start);
  const context = {
    module: { exports: {} },
    exports: {},
    fieldSemantics: {
      inferStructuredFieldKeyFromField(field) {
        return field.semanticFieldKey || "";
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(
    `${source.slice(start, end)}\nmodule.exports = inferRepeatItemIndexFromIdentifier;`,
    context
  );
  return context.module.exports;
}

function loadOccurrenceIndexHelper() {
  const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
  const start = source.indexOf("function assignFallbackRepeatItemIndexes(fields) {");
  const end = source.indexOf("function getRadioScopeId(element) {", start);
  const context = {
    module: { exports: {} },
    exports: {},
    fieldSemantics: {
      inferStructuredFieldKeyFromField(field) {
        return field.semanticFieldKey || "";
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(
    `function normalizeDeepScanText(value) { return String(value || "").toLowerCase().replace(/\\s+/g, "").replace(/[＊*]/g, "").trim(); }\n${source.slice(start, end)}\nmodule.exports = assignFallbackRepeatItemIndexes;`,
    context
  );
  return context.module.exports;
}

test("repeat item indexing has generic fallbacks and does not require a site adapter", () => {
  const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
  const start = source.indexOf("function inferRepeatItemIndex(el, semanticSectionKey) {");
  const end = source.indexOf("function countRenderedRepeatItems(trigger, rule)", start);

  assert.ok(start >= 0 && end > start);
  const implementation = source.slice(start, end);
  assert.match(implementation, /COMMON_REPEAT_ITEM_SELECTORS/);
  assert.match(implementation, /activeSiteAdapter\?\.repeatItemSelector/);
  assert.doesNotMatch(implementation, /!itemSelector/);
  assert.match(implementation, /GENERIC_REPEAT_TRIGGER_SELECTOR/);
  assert.match(source, /GENERIC_REPEAT_TRIGGER_SELECTOR[\s\S]*button:not[\s\S]*span,div\[class\],div\[id\]/);
  assert.match(implementation, /inferRepeatItemIndexFromIdentifier/);
  assert.match(implementation, /data-field/);
});

test("repeat item indexing reads React form-list indexes from stable control ids", () => {
  const inferIndex = loadIdentifierIndexHelper();
  const element = {
    id: "basicInfo_recruitAwardList_7_awardTime",
    getAttribute() {
      return "";
    },
  };

  assert.equal(inferIndex(element, "awards"), 7);
  assert.equal(inferIndex(element, "projects"), -1);
});

test("id-less repeated rows receive indexes from recurring field labels", () => {
  const assignIndexes = loadOccurrenceIndexHelper();
  const fields = [
    { sectionKey: "education", label: "学校名称", sectionItemIndex: -1 },
    { sectionKey: "education", label: "开始时间", sectionItemIndex: -1 },
    { sectionKey: "education", label: "学校名称", sectionItemIndex: -1 },
    { sectionKey: "education", label: "开始时间", sectionItemIndex: -1 },
  ];

  assignIndexes(fields);
  assert.deepEqual(
    fields.map((field) => field.sectionItemIndex),
    [0, 0, 1, 1]
  );
});

test("generic placeholders are indexed by semantic field role instead of raw placeholder", () => {
  const assignIndexes = loadOccurrenceIndexHelper();
  const fields = [
    { sectionKey: "work", label: "请输入", semanticFieldKey: "company", sectionItemIndex: -1 },
    { sectionKey: "work", label: "请输入", semanticFieldKey: "title", sectionItemIndex: -1 },
    { sectionKey: "work", label: "开始时间", semanticFieldKey: "startDate", sectionItemIndex: -1 },
    { sectionKey: "work", label: "结束时间", semanticFieldKey: "endDate", sectionItemIndex: -1 },
    { sectionKey: "work", label: "请输入", semanticFieldKey: "description", sectionItemIndex: -1 },
    { sectionKey: "work", label: "请输入", semanticFieldKey: "company", sectionItemIndex: -1 },
    { sectionKey: "work", label: "请输入", semanticFieldKey: "title", sectionItemIndex: -1 },
    { sectionKey: "work", label: "开始时间", semanticFieldKey: "startDate", sectionItemIndex: -1 },
    { sectionKey: "work", label: "结束时间", semanticFieldKey: "endDate", sectionItemIndex: -1 },
    { sectionKey: "work", label: "请输入", semanticFieldKey: "description", sectionItemIndex: -1 },
  ];

  assignIndexes(fields);
  assert.deepEqual(
    fields.map((field) => field.sectionItemIndex),
    [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]
  );
});
