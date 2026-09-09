const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadExtension } = require("./helpers/dom-extension");

test("repeat item indexing has generic fallbacks and does not require a site adapter", () => {
  const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
  assert.match(source, /COMMON_REPEAT_ITEM_SELECTORS/);
  assert.match(source, /GENERIC_REPEAT_TRIGGER_SELECTOR/);
  assert.match(source, /inferRepeatItemIndexFromIdentifier/);
});

test("repeat item indexing reads React form-list indexes from stable control ids", () => {
  const ext = loadExtension(
    '<input id="basicInfo_recruitAwardList_7_awardTime">'
  );
  try {
    const el = ext.window.document.querySelector("input");
    assert.equal(ext.api.inferRepeatItemIndexFromIdentifier(el, "awards"), 7);
    assert.equal(ext.api.inferRepeatItemIndexFromIdentifier(el, "projects"), -1);
  } finally {
    ext.close();
  }
});

test("id-less repeated rows receive indexes from recurring field labels", () => {
  const ext = loadExtension("<main></main>");
  try {
    const fields = [
      { sectionKey: "education", label: "学校名称", sectionItemIndex: -1 },
      { sectionKey: "education", label: "开始时间", sectionItemIndex: -1 },
      { sectionKey: "education", label: "学校名称", sectionItemIndex: -1 },
      { sectionKey: "education", label: "开始时间", sectionItemIndex: -1 },
    ];
    ext.api.assignFallbackRepeatItemIndexes(fields);
    assert.deepEqual(
      fields.map((field) => field.sectionItemIndex),
      [0, 0, 1, 1]
    );
  } finally {
    ext.close();
  }
});

test("generic placeholders are indexed by semantic field role instead of raw placeholder", () => {
  const ext = loadExtension("<main></main>");
  try {
    const fields = [
      { sectionKey: "work", label: "请输入", nearbyLabels: ["公司名称"], sectionItemIndex: -1 },
      { sectionKey: "work", label: "请输入", nearbyLabels: ["职位名称"], sectionItemIndex: -1 },
      { sectionKey: "work", label: "开始时间", sectionItemIndex: -1 },
      { sectionKey: "work", label: "结束时间", sectionItemIndex: -1 },
      { sectionKey: "work", label: "请输入", nearbyLabels: ["工作职责"], sectionItemIndex: -1 },
      { sectionKey: "work", label: "请输入", nearbyLabels: ["公司名称"], sectionItemIndex: -1 },
      { sectionKey: "work", label: "请输入", nearbyLabels: ["职位名称"], sectionItemIndex: -1 },
      { sectionKey: "work", label: "开始时间", sectionItemIndex: -1 },
      { sectionKey: "work", label: "结束时间", sectionItemIndex: -1 },
      { sectionKey: "work", label: "请输入", nearbyLabels: ["工作职责"], sectionItemIndex: -1 },
    ];
    ext.api.assignFallbackRepeatItemIndexes(fields);
    assert.deepEqual(
      fields.map((field) => field.sectionItemIndex),
      [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]
    );
  } finally {
    ext.close();
  }
});
