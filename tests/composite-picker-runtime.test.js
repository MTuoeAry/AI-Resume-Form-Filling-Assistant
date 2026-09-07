const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadHelpers() {
  const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
  const start = source.indexOf("  function collectControls(root) {");
  const end = source.indexOf("  function isFillableElement(el) {", start);
  if (start === -1 || end === -1) throw new Error("composite picker helpers not found");

  const snippet = `
    const COMPOSITE_PICKER_SELECTOR = '[role="combobox"],[aria-haspopup="listbox"],[aria-haspopup="tree"]';
    function isVisible(el) { return el.visible !== false; }
    ${source.slice(start, end)}
    module.exports = { collectControls, isCompositePickerRoot };
  `;
  const context = { module: { exports: {} }, exports: {} };
  vm.createContext(context);
  vm.runInContext(snippet, context);
  return context.module.exports;
}

test("scanner promotes an accessible combobox root and removes its proxy input", () => {
  const { collectControls } = loadHelpers();
  const root = {
    tagName: "DIV",
    visible: true,
    matches: (selector) => selector.includes('[role="combobox"]'),
  };
  const proxyInput = {
    tagName: "INPUT",
    visible: true,
    matches: () => false,
    closest: () => root,
  };
  const ordinaryInput = {
    tagName: "INPUT",
    visible: true,
    matches: () => false,
    closest: () => null,
  };
  const scope = {
    querySelectorAll: () => [root, proxyInput, ordinaryInput],
  };

  assert.deepEqual(Array.from(collectControls(scope)), [root, ordinaryInput]);
});

test("native selects are not misclassified as custom combobox roots", () => {
  const { isCompositePickerRoot } = loadHelpers();
  assert.equal(
    isCompositePickerRoot({
      tagName: "SELECT",
      matches: () => true,
    }),
    false
  );
});
