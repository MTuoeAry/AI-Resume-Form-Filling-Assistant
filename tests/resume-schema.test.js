const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadResumeSchema() {
  const source = fs.readFileSync(
    path.join(__dirname, "../shared/resume-schema.js"),
    "utf8"
  );
  const context = {
    window: {},
    console,
    structuredClone: global.structuredClone,
  };

  vm.createContext(context);
  vm.runInContext(source, context);

  return context.window.ResumeSchema;
}

test("resume schema exposes campus recruiting education and experience fields", () => {
  const schema = loadResumeSchema();
  const catalog = schema.getFieldCatalog({ mode: "max" });
  const template = JSON.parse(schema.createImportTemplateString());

  assert.ok(catalog.some((field) => field.path === "educations.0.educationType"));
  assert.ok(catalog.some((field) => field.path === "educations.0.studyMode"));
  assert.ok(catalog.some((field) => field.path === "educations.0.laboratory"));
  assert.ok(catalog.some((field) => field.path === "educations.0.researchDirection"));
  assert.ok(catalog.some((field) => field.path === "educations.0.advisor"));
  assert.ok(catalog.some((field) => field.path === "internships.0.company"));
  assert.ok(catalog.some((field) => field.path === "campusExperiences.0.organization"));
  assert.ok(catalog.some((field) => field.path === "publications.0.impactFactor"));

  assert.ok(Array.isArray(template.internships));
  assert.ok(Array.isArray(template.campusExperiences));
  assert.equal("educationType" in template.educations[0], true);
  assert.equal("studyMode" in template.educations[0], true);
  assert.equal("laboratory" in template.educations[0], true);
  assert.equal("researchDirection" in template.educations[0], true);
  assert.equal("advisor" in template.educations[0], true);
});

test("resume schema normalizes campus recruiting resume data", () => {
  const schema = loadResumeSchema();
  const normalized = schema.normalizeResumeProfile({
    educations: [
      {
        school: "浙江大学",
        educationType: "统招全日制",
        studyMode: "联合培养",
        laboratory: "CAD&CG 国家重点实验室",
        researchDirection: ["AIGC", "多模态生成"],
        advisor: "王老师",
        studentId: 20231234,
        academicSystem: 3,
      },
    ],
    internships: [
      {
        company: "字节跳动",
        title: "后端开发实习生",
        description: ["负责推荐服务接口开发", "支持线上稳定性治理"],
      },
    ],
    campusExperiences: [
      {
        organization: "浙江大学 ACM 协会",
        category: "学生组织",
        role: "技术负责人",
        isCurrent: true,
      },
    ],
  });

  assert.equal(normalized.educations[0].educationType, "统招全日制");
  assert.equal(normalized.educations[0].studyMode, "联合培养");
  assert.equal(normalized.educations[0].laboratory, "CAD&CG 国家重点实验室");
  assert.equal(normalized.educations[0].researchDirection, "AIGC, 多模态生成");
  assert.equal(normalized.educations[0].advisor, "王老师");
  assert.equal(normalized.educations[0].studentId, "20231234");
  assert.equal(normalized.educations[0].academicSystem, "3");
  assert.equal(normalized.internships[0].company, "字节跳动");
  assert.equal(
    normalized.internships[0].description,
    "负责推荐服务接口开发, 支持线上稳定性治理"
  );
  assert.equal(normalized.campusExperiences[0].category, "学生组织");
  assert.equal(normalized.campusExperiences[0].isCurrent, "是");
});

test("resume schema preserves flexible date precision and legacy aliases", () => {
  const schema = loadResumeSchema();
  const normalized = schema.normalizeResumeProfile({
    personal: {
      birthYearMonth: "2001/06",
    },
    contactAndLocation: {
      nativePlace: "江西南昌",
    },
    identityAndAuthorization: {
      idCardNumber: "362202200106265976",
    },
    educations: [
      {
        learningModality: "全国普通高等院校全日制",
        schoolSystem: "2年及以上",
        timeRange: "2021年09月 至 2025年06月",
      },
    ],
  });

  assert.equal(normalized.personal.birthDate, "2001-06");
  assert.equal(normalized.contactAndLocation.hometownCity, "江西南昌");
  assert.equal(normalized.contactAndLocation.hometownProvince, "江西南昌");
  assert.equal(
    normalized.identityAndAuthorization.personalIdNumber,
    "362202200106265976"
  );
  assert.equal(normalized.identityAndAuthorization.personalIdType, "身份证");
  assert.equal(normalized.educations[0].studyMode, "统招");
  assert.equal(normalized.educations[0].academicSystem, "2年及以上");
  assert.equal(normalized.educations[0].startDate, "2021-09");
  assert.equal(normalized.educations[0].endDate, "2025-06");
});

test("legacy project responsibility aliases normalize into role, not description", () => {
  const schema = loadResumeSchema();
  const normalized = schema.normalizeResumeProfile({
    projects: [
      {
        projectDuty: "核心算法开发",
        projectDescription: "面向城市级施工监管场景建设智能分析系统",
      },
    ],
  });

  assert.equal(normalized.projects[0].role, "核心算法开发");
  assert.equal(
    normalized.projects[0].description,
    "面向城市级施工监管场景建设智能分析系统"
  );
});

test("resume schema v5 exposes structured recruiting records and dynamic custom fields", () => {
  const schema = loadResumeSchema();
  const catalog = schema.getFieldCatalog({ mode: "max" });

  assert.equal(schema.version, 5);
  assert.ok(catalog.some((field) => field.path === "awards.0.name"));
  assert.ok(catalog.some((field) => field.path === "patents.0.number"));
  assert.ok(catalog.some((field) => field.path === "publications.0.title"));
  assert.ok(catalog.some((field) => field.path === "customFields.0.value"));
  assert.equal(catalog.some((field) => field.path === "customFields.0.label"), false);

  const normalized = schema.normalizeResumeProfile({
    additional: {
      awards: "全国大学生数学建模竞赛一等奖",
      patents: "一种智能调度方法，CN123456",
      publications: "Efficient Scheduling, AAAI 2026",
    },
    customFields: [
      { group: "美的补充", label: "外语等级", aliases: "英语等级, CET", value: "CET-6" },
    ],
  });
  assert.equal(normalized.awards[0].name, "全国大学生数学建模竞赛一等奖");
  assert.equal(normalized.patents[0].name, "一种智能调度方法，CN123456");
  assert.equal(normalized.publications[0].title, "Efficient Scheduling, AAAI 2026");

  const dynamic = schema
    .getCatalogWithValues(normalized)
    .find((field) => field.path === "customFields.0.value");
  assert.equal(dynamic.label, "外语等级");
  assert.equal(dynamic.sectionLabel, "美的补充");
  assert.deepEqual(Array.from(dynamic.aliases), ["英语等级", "CET"]);
  assert.equal(dynamic.hasValue, true);
});

test("explicit empty structured lists override legacy summary text", () => {
  const schema = loadResumeSchema();
  const normalized = schema.normalizeResumeProfile({
    awards: [],
    patents: [],
    publications: [],
    additional: {
      awards: "旧版奖项汇总",
      patents: "旧版专利汇总",
      publications: "旧版论文汇总",
    },
  });

  assert.deepEqual(Array.from(normalized.awards), []);
  assert.deepEqual(Array.from(normalized.patents), []);
  assert.deepEqual(Array.from(normalized.publications), []);
});

test("every repeatable resume section allows zero items", () => {
  const schema = loadResumeSchema();
  const empty = schema.createEmptyResumeProfile();
  const listSections = schema.sections.filter((section) => section.type === "list");

  for (const section of listSections) {
    const normalized = schema.normalizeResumeProfile({ [section.key]: [] });
    const legacyEmptySlot = schema.normalizeResumeProfile({
      [section.key]: [{}],
    });

    assert.equal(section.initialItems, 0, `${section.key} should start empty`);
    assert.equal(
      schema.getListSectionMinItems(section),
      0,
      `${section.key} should be removable to zero`
    );
    assert.deepEqual(Array.from(empty[section.key]), []);
    assert.deepEqual(Array.from(normalized[section.key]), []);
    assert.deepEqual(Array.from(legacyEmptySlot[section.key]), []);
  }
});

test("obviously misclassified internships migrate out of work experiences", () => {
  const schema = loadResumeSchema();
  const normalized = schema.normalizeResumeProfile({
    internships: [],
    workExperiences: [
      {
        company: "某科技公司",
        title: "后端开发实习生",
        employmentType: "实习",
        startDate: "2025-07",
        endDate: "2025-09",
        description: "负责接口开发",
      },
      {
        company: "正式工作单位",
        title: "软件工程师",
        employmentType: "全职",
      },
    ],
  });

  assert.equal(normalized.internships.length, 1);
  assert.equal(normalized.internships[0].company, "某科技公司");
  assert.equal(normalized.internships[0].title, "后端开发实习生");
  assert.equal(normalized.workExperiences.length, 1);
  assert.equal(normalized.workExperiences[0].company, "正式工作单位");
});
