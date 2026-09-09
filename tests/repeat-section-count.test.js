const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadExtension } = require("./helpers/dom-extension");

test("repeat row labels ignore leading and trailing required markers", () => {
  const ext = loadExtension("<main></main>");
  try {
    assert.equal(ext.api.normalizeDeepScanText("*项目名称"), "项目名称");
    assert.equal(ext.api.normalizeDeepScanText("奖项名称＊"), "奖项名称");
  } finally {
    ext.close();
  }
});

test("content mapping failure keeps a deterministic local fallback", () => {
  const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
  assert.match(source, /mappings = localMappings/);
  assert.match(source, /已降级使用本地结构化映射继续填写/);
});

test("repeat counting uses stable form-list ids when a site uses unexpected labels", () => {
  const ids = Array.from(
    { length: 8 },
    (_, index) => `basicInfo_recruitAwardList_${index}_awardTime`
  );
  const ext = loadExtension(ids.map((id) => `<input id="${id}">`).join(""));
  try {
    const indexes = Array.from(ext.window.document.querySelectorAll("input")).map((el) =>
      ext.api.inferRepeatItemIndexFromIdentifier(el, "awards")
    );
    assert.equal(new Set(indexes.filter((index) => index >= 0)).size, 8);
  } finally {
    ext.close();
  }
});
