const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadIdentifierIndexHelper() {
  const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
  const start = source.indexOf("function inferRepeatItemIndexFromIdentifier(el, schemaSectionKey) {");
  const end = source.indexOf("function countRenderedRepeatItems(trigger, rule)", start);
  const context = { module: { exports: {} }, exports: {} };
  vm.createContext(context);
  vm.runInContext(
    `${source.slice(start, end)}\nmodule.exports = inferRepeatItemIndexFromIdentifier;`,
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
  assert.match(implementation, /\[class\*='add'\]/);
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
