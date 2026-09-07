const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function extract(source, startSignature, endSignature) {
  const start = source.indexOf(startSignature);
  const end = source.indexOf(endSignature, start);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Failed to locate snippet: ${startSignature}`);
  }
  return source.slice(start, end);
}

function loadContentSecurityHelpers() {
  const contentSource = fs.readFileSync(
    path.join(__dirname, "../content.js"),
    "utf8"
  );
  const schemaSource = fs.readFileSync(
    path.join(__dirname, "../shared/resume-schema.js"),
    "utf8"
  );
  const fieldSemanticsApi = require("../shared/field-semantics.js");
  const snippet = `
    ${schemaSource}
    const schema = window.ResumeSchema;
    const fieldSemantics = fieldSemanticsApi;
    ${extract(contentSource, "function sanitizePageUrl(value) {", "function cssEscape(value) {")}
    ${extract(contentSource, "function normalizeMappings(rawMappings, fields, resumeProfile = null) {", "function normalizeTransform(transform) {")}
    ${extract(contentSource, "function normalizeTransform(transform) {", "function deriveFillValue(rawValue, transform, runtime) {")}
    module.exports = { normalizeMappings, sanitizePageUrl };
  `;
  const context = {
    module: { exports: {} },
    exports: {},
    window: {},
    URL,
    fieldSemanticsApi,
  };
  vm.createContext(context);
  vm.runInContext(snippet, context);
  return context.module.exports;
}

test("page URLs sent to the model exclude query and hash", () => {
  const helpers = loadContentSecurityHelpers();
  assert.equal(
    helpers.sanitizePageUrl("https://example.com/app?token=secret#section"),
    "https://example.com/app"
  );
});

test("mapping paths are restricted to the schema catalog", () => {
  const helpers = loadContentSecurityHelpers();
  const mappings = helpers.normalizeMappings(
    [
      { fieldId: "f_1", resumePath: "personal.email" },
      { fieldId: "f_2", resumePath: "../../apiKey" },
      { fieldId: "f_3", resumePath: "[object Object]" },
      { fieldId: "f_4", resumePath: "workExperiences.0.company" },
    ],
    [
      { fieldId: "f_1" },
      { fieldId: "f_2" },
      { fieldId: "f_3" },
      { fieldId: "f_4", sectionKey: "internship" },
    ]
  );

  assert.equal(mappings[0].resumePath, "personal.email");
  assert.equal(mappings[1].resumePath, "");
  assert.equal(mappings[2].resumePath, "");
  assert.equal(mappings[3].resumePath, "internships.0.company");
});

test("Midea structured repeat fields use deterministic section indexes", () => {
  const helpers = loadContentSecurityHelpers();
  const mappings = helpers.normalizeMappings(
    [
      { fieldId: "p_1", resumePath: "projects.0.description" },
      { fieldId: "a_1", resumePath: "additional.awards" },
    ],
    [
      {
        fieldId: "p_1",
        sectionKey: "project",
        sectionItemIndex: 2,
        label: "项目成果",
      },
      {
        fieldId: "a_1",
        sectionKey: "award",
        sectionItemIndex: 1,
        label: "奖项名称",
      },
      {
        fieldId: "j_1",
        sectionKey: "publication",
        sectionItemIndex: 2,
        label: "论文详情",
      },
    ]
  );

  assert.equal(mappings[0].resumePath, "projects.2.highlights");
  assert.equal(mappings[1].resumePath, "awards.1.name");
  assert.equal(mappings[2].resumePath, "publications.2.details");
  assert.match(mappings[2].reason, /确定映射/);
});

test("work-only forms map each row to the corresponding internship source", () => {
  const helpers = loadContentSecurityHelpers();
  const profile = {
    workExperiences: [],
    internships: [
      { company: "甲公司", description: "第一段实习" },
      { company: "乙公司", description: "第二段实习" },
    ],
  };
  const mappings = helpers.normalizeMappings(
    [],
    [
      { fieldId: "w_1", sectionKey: "work", sectionItemIndex: 0, label: "单位名称" },
      { fieldId: "w_2", sectionKey: "work", sectionItemIndex: 1, label: "单位名称" },
      { fieldId: "w_3", sectionKey: "work", sectionItemIndex: 1, label: "工作职责" },
    ],
    profile
  );

  assert.equal(mappings[0].resumePath, "internships.0.company");
  assert.equal(mappings[1].resumePath, "internships.1.company");
  assert.equal(mappings[2].resumePath, "internships.1.description");
});

test("work-only generic placeholders keep company, title, and description on each row", () => {
  const helpers = loadContentSecurityHelpers();
  const profile = {
    workExperiences: [],
    internships: [
      { company: "甲公司", title: "算法实习生", description: "第一段实习" },
      { company: "乙公司", title: "后端实习生", description: "第二段实习" },
    ],
  };
  const mappings = helpers.normalizeMappings(
    [],
    [
      { fieldId: "w_1", sectionKey: "work", sectionItemIndex: 0, label: "请输入", nearbyLabels: ["公司名称", "职位名称"] },
      { fieldId: "w_2", sectionKey: "work", sectionItemIndex: 0, label: "请输入", nearbyLabels: ["职位名称", "公司名称"] },
      { fieldId: "w_3", sectionKey: "work", sectionItemIndex: 0, label: "请输入", nearbyLabels: ["工作职责"] },
      { fieldId: "w_4", sectionKey: "work", sectionItemIndex: 1, label: "请输入", nearbyLabels: ["公司名称", "职位名称"] },
      { fieldId: "w_5", sectionKey: "work", sectionItemIndex: 1, label: "请输入", nearbyLabels: ["职位名称", "公司名称"] },
      { fieldId: "w_6", sectionKey: "work", sectionItemIndex: 1, label: "请输入", nearbyLabels: ["工作职责"] },
    ],
    profile
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(mappings.map((mapping) => mapping.resumePath))),
    [
      "internships.0.company",
      "internships.0.title",
      "internships.0.description",
      "internships.1.company",
      "internships.1.title",
      "internships.1.description",
    ]
  );
});

test("normalization blocks incompatible and unsupported AI mappings", () => {
  const helpers = loadContentSecurityHelpers();
  const mappings = helpers.normalizeMappings(
    [
      { fieldId: "gender", resumePath: "personal.fullName", reason: "AI guessed" },
      { fieldId: "email", resumePath: "personal.fullName", reason: "AI guessed" },
      { fieldId: "paper", resumePath: "educations.0.degree", reason: "AI guessed" },
    ],
    [
      { fieldId: "gender", kind: "radio_group", label: "性别", options: ["男", "女"] },
      { fieldId: "email", kind: "text", inputType: "email", label: "邮箱" },
      { fieldId: "paper", kind: "select", sectionKey: "education", sectionItemIndex: 0, label: "paperGrad" },
    ],
    { educations: [{ degree: "硕士" }] }
  );

  assert.equal(mappings.find((item) => item.fieldId === "gender").resumePath, "personal.gender");
  assert.equal(mappings.find((item) => item.fieldId === "email").resumePath, "");
  assert.equal(mappings.find((item) => item.fieldId === "paper").resumePath, "");
});

test("single present checkboxes map to current-status fields even when their label is noisy", () => {
  const helpers = loadContentSecurityHelpers();
  const mappings = helpers.normalizeMappings(
    [{ fieldId: "current", resumePath: "internships.0.title", reason: "AI guessed" }],
    [{
      fieldId: "current",
      kind: "checkbox_group",
      sectionKey: "internship",
      sectionItemIndex: 0,
      label: "职位名称",
      options: ["至今"],
    }],
    { internships: [{ isCurrent: "否" }] }
  );

  assert.equal(mappings[0].resumePath, "internships.0.isCurrent");
});
