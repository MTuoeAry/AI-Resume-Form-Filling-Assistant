const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function extractFunction(source, signature, nextSignature) {
  const start = source.indexOf(signature);
  const end = source.indexOf(nextSignature, start);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Failed to locate snippet: ${signature}`);
  }
  return source.slice(start, end);
}

function loadHelpers() {
  const source = fs
    .readFileSync(path.join(__dirname, "../content.js"), "utf8")
    .replace(/\r\n/g, "\n");
  const dormantConstant = source.slice(
    source.indexOf("  const DORMANT_EDITOR_ACTION_TEXTS ="),
    source.indexOf("  const DEEP_SCAN_SECTION_MAP")
  );
  const snippet = `
    ${dormantConstant}
    function isVisible() { return true; }
    ${extractFunction(source, "  function normalizeDeepScanText(value) {", "  function getDeepScanText(el) {")}
    ${extractFunction(source, "  function getDeepScanText(el) {", "  function getDeepScanTargetElements(el) {")}
    ${extractFunction(source, "  function countPotentialEditableControls(root) {", "  function isDormantEditorAction(el) {")}
    ${extractFunction(source, "  function isDormantEditorAction(el) {", "  function findDormantEditorRoot(action) {")}
    ${extractFunction(source, "  function isContextualRepeatAddTrigger(el) {", "  function findRepeatSectionTrigger(rule) {")}
    module.exports = { countPotentialEditableControls, isDormantEditorAction, isContextualRepeatAddTrigger };
  `;
  const context = { module: { exports: {} }, exports: {} };
  vm.createContext(context);
  vm.runInContext(snippet, context);
  return context.module.exports;
}

function mockAction(text, { className = "", type = "" } = {}) {
  return {
    textContent: text,
    className,
    children: [],
    disabled: false,
    getAttribute(name) {
      if (name === "type") return type;
      return null;
    },
  };
}

test("card-style editors accept explicit edit actions but never treat add as edit", () => {
  const helpers = loadHelpers();
  assert.equal(helpers.isDormantEditorAction(mockAction("编辑")), true);
  assert.equal(helpers.isDormantEditorAction(mockAction("Edit")), true);
  assert.equal(helpers.isDormantEditorAction(mockAction("添加")), false);
  assert.equal(
    helpers.isDormantEditorAction(mockAction("编辑", { className: "unedit" })),
    false
  );
});

test("plain add actions are recognized only as contextual repeat candidates", () => {
  const helpers = loadHelpers();
  assert.equal(helpers.isContextualRepeatAddTrigger(mockAction("添加")), true);
  assert.equal(helpers.isContextualRepeatAddTrigger(mockAction("Add")), true);
  assert.equal(helpers.isContextualRepeatAddTrigger(mockAction("删除")), false);
  assert.equal(
    helpers.isContextualRepeatAddTrigger(mockAction("添加", { type: "submit" })),
    false
  );
});

test("dormant editor discovery ignores metadata and upload controls", () => {
  const helpers = loadHelpers();
  const controls = [
    { disabled: false, getAttribute: (name) => (name === "type" ? "text" : null) },
    { disabled: false, getAttribute: (name) => (name === "type" ? "select-one" : null) },
    { disabled: false, getAttribute: (name) => (name === "type" ? "hidden" : null) },
    { disabled: false, getAttribute: (name) => (name === "type" ? "file" : null) },
  ];
  const root = { querySelectorAll: () => controls };
  assert.equal(helpers.countPotentialEditableControls(root), 2);
});

test("generic card support does not add a Hikvision hostname branch", () => {
  const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
  assert.doesNotMatch(source, /campushr\.hikvision\.com/i);
});
