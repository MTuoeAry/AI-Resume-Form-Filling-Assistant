const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadAligner(visibleText = "") {
  const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
  const start = source.indexOf("const INCREMENTAL_REPEAT_ANCHOR_KEYS");
  const end = source.indexOf("function getRadioScopeId(element)", start);
  if (start < 0 || end <= start) throw new Error("incremental alignment helpers not found");

  const sectionMap = {
    education: "educations",
    internship: "internships",
    work: "workExperiences",
    project: "projects",
    campus: "campusExperiences",
    certificate: "certificates",
    language: "languages",
    award: "awards",
    patent: "patents",
    publication: "publications",
  };
  const context = {
    module: { exports: {} },
    exports: {},
    fieldSemantics: { getSchemaSectionKey: (key) => sectionMap[key] || "" },
    document: {
      body: { innerText: visibleText },
      documentElement: { innerText: visibleText },
    },
    sendLog() {},
  };
  vm.createContext(context);
  vm.runInContext(
    `${source.slice(start, end)}\nmodule.exports = alignIncrementalRepeatSourceIndexes;`,
    context
  );
  return context.module.exports;
}

test("incremental blank rows use the first resume item not already rendered", () => {
  const align = loadAligner("国家一等奖 国家二等奖");
  const scan = {
    fields: [
      { fieldId: "name", sectionKey: "award", sectionItemIndex: 0 },
      { fieldId: "date", sectionKey: "award", sectionItemIndex: 0 },
    ],
    runtime: [
      { fieldId: "name", kind: "text", el: { value: "" } },
      { fieldId: "date", kind: "text", el: { value: "" } },
    ],
  };
  const profile = {
    awards: [
      { name: "国家一等奖" },
      { name: "国家二等奖" },
      { name: "省级一等奖" },
    ],
  };

  align(scan, profile);
  assert.deepEqual(
    scan.fields.map((field) => field.sectionItemIndex),
    [2, 2]
  );
});

test("incremental editing aligns an existing row by its anchor value, not page order", () => {
  const align = loadAligner("");
  const scan = {
    fields: [{ fieldId: "project", sectionKey: "project", sectionItemIndex: 0 }],
    runtime: [{ fieldId: "project", kind: "text", el: { value: "第二个项目" } }],
  };
  const profile = {
    projects: [{ name: "第一个项目" }, { name: "第二个项目" }],
  };

  align(scan, profile);
  assert.equal(scan.fields[0].sectionItemIndex, 1);
});
