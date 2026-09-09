const test = require("node:test");
const assert = require("node:assert/strict");
const { loadExtension } = require("./helpers/dom-extension");

test("content mapping parser accepts fenced JSON with trailing commas", () => {
  const ext = loadExtension("<main></main>");
  try {
    const result = ext.api.parseJsonFromAiText(
      '```json\n{"mappings":[{"fieldId":"f_1","resumePath":"projects.0.name",}],}\n```'
    );
    assert.equal(result.mappings[0].resumePath, "projects.0.name");
  } finally {
    ext.close();
  }
});

test("content mapping parser extracts balanced JSON before trailing prose", () => {
  const ext = loadExtension("<main></main>");
  try {
    const result = ext.api.parseJsonFromAiText('结果如下：{"mappings":[]} 说明里还有一个 {括号}。');
    assert.equal(result.mappings.length, 0);
  } finally {
    ext.close();
  }
});

test("content mapping parser accepts a direct mappings array", () => {
  const ext = loadExtension("<main></main>");
  try {
    const result = ext.api.parseJsonFromAiText(
      '[{"fieldId":"f_2","resumePath":"awards.1.name"}]'
    );
    assert.equal(result[0].fieldId, "f_2");
  } finally {
    ext.close();
  }
});
