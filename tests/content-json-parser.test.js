const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadContentJsonParser() {
  const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
  const start = source.indexOf("function parseJsonFromAiText(text) {");
  const end = source.indexOf("function createMappingCacheSignature(fields) {", start);
  if (start < 0 || end <= start) throw new Error("content JSON parser not found");

  const context = { module: { exports: {} }, exports: {} };
  vm.createContext(context);
  vm.runInContext(
    `${source.slice(start, end)}\nmodule.exports = { parseJsonFromAiText };`,
    context
  );
  return context.module.exports.parseJsonFromAiText;
}

test("content mapping parser accepts fenced JSON with trailing commas", () => {
  const parse = loadContentJsonParser();
  const result = parse('```json\n{"mappings":[{"fieldId":"f_1","resumePath":"projects.0.name",}],}\n```');
  assert.equal(result.mappings[0].resumePath, "projects.0.name");
});

test("content mapping parser extracts balanced JSON before trailing prose", () => {
  const parse = loadContentJsonParser();
  const result = parse('结果如下：{"mappings":[]} 说明里还有一个 {括号}。');
  assert.equal(result.mappings.length, 0);
});

test("content mapping parser accepts a direct mappings array", () => {
  const parse = loadContentJsonParser();
  const result = parse('[{"fieldId":"f_2","resumePath":"awards.1.name"}]');
  assert.equal(result[0].fieldId, "f_2");
});
