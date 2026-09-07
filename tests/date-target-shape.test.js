const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function extract(source, startSignature, endSignature) {
  const start = source.indexOf(startSignature);
  const end = source.indexOf(endSignature, start);
  if (start < 0 || end <= start) throw new Error(`snippet not found: ${startSignature}`);
  return source.slice(start, end);
}

function loadDeriver() {
  const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
  const fillRuntime = require("../shared/fill-runtime.js");
  const snippet = `
    ${extract(source, "function deriveFillValue(rawValue, transform, runtime) {", "function hasSourceValue(value) {")}
    ${extract(source, "function hasSourceValue(value) {", "function normalizeCheckboxCandidates(value) {")}
    ${extract(source, "function getDatePart(value, part) {", "function getPhonePart(value, part) {")}
    module.exports = deriveFillValue;
  `;
  const context = { module: { exports: {} }, exports: {}, fillRuntime };
  vm.createContext(context);
  vm.runInContext(snippet, context);
  return context.module.exports;
}

test("target year/month components override AI transforms and full source dates", () => {
  const derive = loadDeriver();
  const yearRuntime = {
    kind: "select",
    inputType: "select-one",
    el: { options: ["2024", "2025", "2026"].map((text) => ({ textContent: text })) },
  };
  const monthRuntime = {
    kind: "select",
    inputType: "select-one",
    el: {
      options: Array.from({ length: 12 }, (_, index) => ({
        textContent: String(index + 1),
      })),
    },
  };

  assert.equal(
    derive("2026-09-02", { type: "date_part", part: "day" }, yearRuntime),
    "2026"
  );
  assert.equal(derive("2026-09-02", { type: "none" }, monthRuntime), "09");
});
