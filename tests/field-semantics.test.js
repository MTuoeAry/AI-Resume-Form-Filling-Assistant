const test = require("node:test");
const assert = require("node:assert/strict");

const semantics = require("../shared/field-semantics.js");

test("inferSectionFromTexts recognizes education sections", () => {
  const section = semantics.inferSectionFromTexts([
    "教育经历",
    "学校名称",
    "学历类型",
    "实验室",
  ]);

  assert.equal(section.key, "education");
  assert.equal(section.label, "教育经历");
  assert.match(section.evidence, /学历类型|实验室|学校名称/);
});

test("inferSectionFromTexts prefers internship over generic work for intern labels", () => {
  const section = semantics.inferSectionFromTexts([
    "实习经历",
    "公司名称",
    "职位名称",
    "后端开发实习生",
  ]);

  assert.equal(section.key, "internship");
  assert.equal(section.label, "实习经历");
});

test("inferSectionFromTexts recognizes campus sections", () => {
  const section = semantics.inferSectionFromTexts([
    "校园经历",
    "学生组织",
    "社团",
    "技术负责人",
  ]);

  assert.equal(section.key, "campus");
  assert.equal(section.label, "校园经历");
});

test("inferSectionFromTexts recognizes Midea project, award, and publication sections", () => {
  assert.equal(
    semantics.inferSectionFromTexts(["项目经验", "项目职责", "项目成果"]).key,
    "project"
  );
  assert.equal(
    semantics.inferSectionFromTexts(["获奖经历", "奖项名称", "奖项级别"]).key,
    "award"
  );
  assert.equal(
    semantics.inferSectionFromTexts(["论文", "发表时间", "论文详情"]).key,
    "publication"
  );
});

test("inferSectionFromTexts recognizes generic English structured sections", () => {
  assert.equal(
    semantics.inferSectionFromTexts(["Project experience", "Project responsibilities"]).key,
    "project"
  );
  assert.equal(
    semantics.inferSectionFromTexts(["Awards", "Award level"]).key,
    "award"
  );
  assert.equal(
    semantics.inferSectionFromTexts(["Patents", "Patent number"]).key,
    "patent"
  );
  assert.equal(
    semantics.inferSectionFromTexts(["Publications", "Paper title"]).key,
    "publication"
  );
});

test("framework paper identifiers are recognized as publication fields", () => {
  assert.equal(
    semantics.inferSectionFromTexts([
      "basic Info recruit Paper List 0 impact Factor",
      "请输入",
    ]).key,
    "publication"
  );
});

test("inferSectionFromTexts recognizes common English resume sections", () => {
  assert.equal(
    semantics.inferSectionFromTexts(["Education", "University", "Degree"]).key,
    "education"
  );
  assert.equal(
    semantics.inferSectionFromTexts(["Internship experience", "Intern position"]).key,
    "internship"
  );
  assert.equal(
    semantics.inferSectionFromTexts(["Employment history", "Job title"]).key,
    "work"
  );
  assert.equal(
    semantics.inferSectionFromTexts(["Student organization", "Campus activities"]).key,
    "campus"
  );
});

test("structured repeat fields resolve by section label and item index", () => {
  const validPaths = new Set([
    "projects.1.highlights",
    "awards.2.level",
    "publications.1.title",
  ]);

  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "project", sectionItemIndex: 1, label: "项目成果" },
      "projects.0.description",
      validPaths
    ),
    "projects.1.highlights"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "award", sectionItemIndex: 2, label: "奖项级别" },
      "additional.awards",
      validPaths
    ),
    "awards.2.level"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "publication", sectionItemIndex: 1, label: "论文名称" },
      "educations.0.thesisTitle",
      validPaths
    ),
    "publications.1.title"
  );
});

test("structured repeat fields resolve from generic English labels", () => {
  const validPaths = new Set([
    "projects.0.role",
    "awards.1.name",
    "patents.0.number",
    "publications.2.details",
  ]);

  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "project", sectionItemIndex: 0, label: "Project responsibilities" },
      "",
      validPaths
    ),
    "projects.0.role"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "award", sectionItemIndex: 1, label: "Award title" },
      "",
      validPaths
    ),
    "awards.1.name"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "patent", sectionItemIndex: 0, label: "Patent number" },
      "",
      validPaths
    ),
    "patents.0.number"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "publication", sectionItemIndex: 2, label: "Abstract" },
      "",
      validPaths
    ),
    "publications.2.details"
  );
});

test("project responsibilities and descriptions resolve to distinct fields", () => {
  const validPaths = new Set([
    "projects.2.role",
    "projects.2.description",
  ]);

  assert.equal(
    semantics.resolvePreferredResumePath(
      {
        sectionKey: "project",
        sectionItemIndex: 2,
        label: "项目职责",
        id: "basicInfo_recruitProjectList_2_projectDuty",
        nearbyLabels: ["项目描述", "项目成果"],
      },
      "projects.2.description",
      validPaths
    ),
    "projects.2.role"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      {
        sectionKey: "project",
        sectionItemIndex: 2,
        label: "项目描述",
        nearbyLabels: ["项目职责", "项目成果"],
      },
      "projects.2.role",
      validPaths
    ),
    "projects.2.description"
  );
});

test("structured award dates resolve from framework-generated identifiers", () => {
  const validPaths = new Set(["awards.3.date"]);

  assert.equal(
    semantics.resolvePreferredResumePath(
      {
        sectionKey: "award",
        sectionItemIndex: 3,
        label: "请选择",
        id: "basicInfo_recruitAwardList_3_awardTime",
      },
      "",
      validPaths
    ),
    "awards.3.date"
  );
});

test("publication impact factors and links never fall back to paper details", () => {
  const validPaths = new Set([
    "publications.0.impactFactor",
    "publications.0.url",
    "publications.0.details",
  ]);

  assert.equal(
    semantics.resolvePreferredResumePath(
      {
        sectionKey: "publication",
        sectionItemIndex: 0,
        label: "请输入",
        id: "basicInfo_recruitPaperList_0_impactFactor",
      },
      "publications.0.details",
      validPaths
    ),
    "publications.0.impactFactor"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      {
        sectionKey: "publication",
        sectionItemIndex: 0,
        label: "请输入",
        id: "basicInfo_recruitPaperList_0_paperLink",
      },
      "publications.0.details",
      validPaths
    ),
    "publications.0.url"
  );
});

test("a unique structured path is a safe fallback when item markup is unknown", () => {
  const validPaths = new Set(["publications.3.title"]);
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "publication", sectionItemIndex: -1, label: "Paper title" },
      "",
      validPaths
    ),
    "publications.3.title"
  );

  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "award", sectionItemIndex: -1, label: "Award title" },
      "",
      new Set(["awards.0.name", "awards.1.name"])
    ),
    ""
  );
});

test("internship page fields cannot keep a work-experience resume path", () => {
  const validPaths = new Set([
    "workExperiences.0.company",
    "internships.0.company",
  ]);
  assert.equal(
    semantics.alignResumePathToFieldSection(
      "workExperiences.0.company",
      "internship",
      validPaths
    ),
    "internships.0.company"
  );
  assert.equal(
    semantics.alignResumePathToFieldSection(
      "workExperiences.0.company",
      "work",
      validPaths
    ),
    "workExperiences.0.company"
  );
});
