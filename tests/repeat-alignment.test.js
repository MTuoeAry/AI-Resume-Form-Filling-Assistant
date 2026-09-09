const test = require("node:test");
const assert = require("node:assert/strict");

const alignment = require("../shared/repeat-alignment.js");
const fieldSemantics = require("../shared/field-semantics.js");

function align(scan, profile, extra = {}) {
  return alignment.alignIncrementalRepeatSourceIndexes(scan, profile, {
    fieldSemantics,
    document: { body: { textContent: extra.pageText || "" } },
    ...extra,
  });
}

test("repeat alignment module matches an existing card by exact primary anchor", () => {
  const fields = [
    { fieldId: "name", sectionKey: "project", sectionItemIndex: 0 },
  ];
  align(
    {
      fields,
      runtime: [{ fieldId: "name", kind: "text", el: { value: "第二个项目" } }],
    },
    {
      projects: [{ name: "第一个项目" }, { name: "第二个项目" }],
    }
  );
  assert.equal(fields[0].sectionItemIndex, 1);
});

test("repeat alignment module skips tied same-name records", () => {
  const fields = [
    { fieldId: "school", sectionKey: "education", sectionItemIndex: 0 },
  ];
  align(
    {
      fields,
      runtime: [{ fieldId: "school", kind: "text", el: { value: "Example University" } }],
    },
    {
      educations: [
        { school: "Example University", startDate: "2020-09" },
        { school: "Example University", startDate: "2024-09" },
      ],
    }
  );
  assert.equal(fields[0].sectionItemIndex, 0);
});

test("identifier helper reads React form-list indexes", () => {
  const el = {
    id: "basicInfo_recruitAwardList_7_awardTime",
    getAttribute() {
      return "";
    },
  };
  assert.equal(alignment.inferRepeatItemIndexFromIdentifier(el, "awards"), 7);
  assert.equal(alignment.inferRepeatItemIndexFromIdentifier(el, "projects"), -1);
});
