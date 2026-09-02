const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadImpactFactorNormalizer() {
  const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
  const start = source.indexOf("function normalizeImpactFactorValue(value) {");
  const end = source.indexOf("function buildTextFallbackValues", start);
  const context = { module: { exports: {} }, exports: {} };
  vm.createContext(context);
  vm.runInContext(
    `${source.slice(start, end)}\nmodule.exports = normalizeImpactFactorValue;`,
    context
  );
  return context.module.exports;
}

test("impact factor fields accept compact numeric values only", () => {
  const normalize = loadImpactFactorNormalizer();
  assert.equal(normalize("6.7"), "6.7");
  assert.equal(normalize("IF: 6.7"), "6.7");
  assert.equal(normalize("影响因子 6.7"), "6.7");
  assert.equal(
    normalize("提出轻量级网络，在MSCOCO上达到72.4% AP，并降低计算量。"),
    ""
  );
});
