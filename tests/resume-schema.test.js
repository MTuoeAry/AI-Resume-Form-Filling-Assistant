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

test("resume schema v7 keeps academic fields on education records and derives summaries", () => {
  const schema = loadResumeSchema();
  const catalog = schema.getFieldCatalog({ mode: "max" });

  assert.equal(schema.version, 11);
  assert.ok(catalog.some((field) => field.path === "awards.0.name"));
  assert.ok(catalog.some((field) => field.path === "familyMembers.0.name"));
  assert.ok(catalog.some((field) => field.path === "familyMembers.0.employedAtTargetOrg"));
  assert.ok(catalog.some((field) => field.path === "personal.selfEvaluation"));
  assert.ok(catalog.some((field) => field.path === "languages.0.examType"));
  assert.ok(catalog.some((field) => field.path === "languages.0.examLevel"));
  assert.ok(catalog.some((field) => field.path === "languages.0.scoreValue"));
  assert.ok(catalog.some((field) => field.path === "languages.0.cefrLevel"));
  assert.ok(catalog.some((field) => field.path === "patents.0.number"));
  assert.ok(catalog.some((field) => field.path === "publications.0.title"));
  assert.ok(catalog.some((field) => field.path === "customFields.0.value"));
  assert.ok(catalog.some((field) => field.path === "personal.heightCm"));
  assert.ok(catalog.some((field) => field.path === "personal.weightKg"));
  assert.ok(catalog.some((field) => field.path === "educations.0.weightedAverageScore"));
  assert.ok(catalog.some((field) => field.path === "educations.0.hasDualDegree"));
  assert.ok(catalog.some((field) => field.path === "applicationDeclarations.healthRestrictionHistory"));
  assert.ok(catalog.some((field) => field.path === "derived.achievementCategories"));
  assert.equal(catalog.some((field) => field.path.startsWith("campusApplication.")), false);
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

test("award, publication, and patent checkbox categories are derived without duplicate storage", () => {
  const schema = loadResumeSchema();
  const normalized = schema.normalizeResumeProfile({
    awards: [
      { name: "全国大学生竞赛一等奖", level: "国家级" },
      { name: "优秀学生奖学金", level: "校级" },
    ],
    publications: [{ title: "A Paper", venue: "SCI 期刊" }],
    patents: [{ name: "一种检测方法", type: "发明专利" }],
  });

  assert.equal("derived" in normalized, false);
  assert.deepEqual(
    Array.from(schema.getValueByPath(normalized, "derived.achievementCategories")),
    ["国家级荣誉", "校级荣誉", "国际论文SCI", "发明专利"]
  );
});

test("highest education and English certificate summaries are derived independent of list order", () => {
  const schema = loadResumeSchema();
  const normalized = schema.normalizeResumeProfile({
    educations: [
      { school: "本科院校", degree: "本科", endDate: "2024-06", gpa: "3.5/4.0" },
      { school: "研究生院校", degree: "硕士", graduationStatus: "在读", endDate: "2027-06", gpa: "3.8/4.0" },
    ],
    certificates: [
      { name: "计算机技术认证", score: "优秀" },
      { name: "大学英语六级 CET-6", score: "520" },
    ],
  });

  assert.equal(
    schema.getValueByPath(normalized, "derived.highestEducation.school"),
    "研究生院校"
  );
  assert.equal(
    schema.getValueByPath(normalized, "derived.highestEducation.gpa"),
    "3.8/4.0"
  );
  assert.equal(
    schema.getValueByPath(normalized, "derived.englishCertificate.name"),
    "大学英语六级 CET-6"
  );
  assert.equal(
    schema.getValueByPath(normalized, "derived.englishCertificate.score"),
    "520"
  );
  assert.equal("derived" in normalized, false);
});

test("temporary campus supplement data migrates into canonical sections", () => {
  const schema = loadResumeSchema();
  const normalized = schema.normalizeResumeProfile({
    educations: [{ school: "示例大学" }],
    campusApplication: {
      weightedAverageScore: "88.5",
      gpa: "3.7/4.0",
      majorRankingPercent: "前10%",
      hasDualDegree: "否",
      englishCertificateName: "CET-6",
      englishCertificateScore: "520",
      relativesAtEmployer: "否",
      healthRestrictionHistory: "无",
    },
  });

  assert.equal(normalized.educations[0].weightedAverageScore, "88.5");
  assert.equal(normalized.educations[0].gpa, "3.7/4.0");
  assert.equal(normalized.educations[0].ranking, "前10%");
  assert.equal(normalized.educations[0].hasDualDegree, "否");
  assert.equal(normalized.certificates[0].name, "CET-6");
  assert.equal(normalized.certificates[0].score, "520");
  assert.equal(normalized.applicationDeclarations.relativesAtEmployer, "否");
  assert.equal(normalized.applicationDeclarations.healthRestrictionHistory, "无");
  assert.equal("campusApplication" in normalized, false);
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

test("language exam text migrates into explicit fields without overwriting or dropping the original", () => {
  const schema = loadResumeSchema();
  const first = schema.normalizeResumeProfile({
    languages: [
      { name: "英语", testScore: "大学英语六级 425分" },
      { name: "英语", testScore: "雅思 7.5" },
      { name: "英语", testScore: "托福 105" },
      { name: "英语", testScore: "CET-6" },
      { name: "英语", testScore: "英语良好" },
      { name: "英语", testScore: "六级/雅思7.5" },
      { name: "英语", testScore: "CET-6", examType: "USER", examLevel: "X" },
    ],
  });
  assert.equal(first.languages[0].testScore, "大学英语六级 425分");
  assert.equal(first.languages[0].examType, "CET");
  assert.equal(first.languages[0].examLevel, "6");
  assert.equal(first.languages[0].scoreValue, "425");
  assert.equal(first.languages[1].examType, "IELTS");
  assert.equal(first.languages[1].scoreValue, "7.5");
  assert.equal(first.languages[2].examType, "TOEFL");
  assert.equal(first.languages[2].scoreValue, "105");
  assert.equal(first.languages[3].examType, "CET");
  assert.equal(first.languages[3].examLevel, "6");
  assert.equal(first.languages[4].examType, "");
  assert.equal(first.languages[5].examType, "");
  assert.equal(first.languages[6].examType, "USER");
  assert.equal(first.languages[6].examLevel, "X");

  const second = schema.normalizeResumeProfile(first);
  assert.deepEqual(second.languages, first.languages);
});

test("T19 single document roundtrip keeps original language text and new exam fields", () => {
  const schema = loadResumeSchema();
  const profileDocument = require("../shared/profile-document.js");
  const profile = schema.normalizeResumeProfile({
    languages: [{ name: "英语", testScore: "大学英语六级 425分", cefrLevel: "" }],
  });
  const serialized = profileDocument.serializeDocument({
    profile,
    schemaVersion: schema.version,
    extensionVersion: "1.3.0",
  });
  const parsed = profileDocument.parseDocument(serialized, {
    currentSchemaVersion: schema.version,
    normalizeProfile: (value) => schema.normalizeResumeProfile(value),
  });
  assert.equal(parsed.profile.languages[0].testScore, "大学英语六级 425分");
  assert.equal(parsed.profile.languages[0].examType, "CET");
  assert.equal(parsed.profile.languages[0].examLevel, "6");
  assert.equal(parsed.profile.languages[0].scoreValue, "425");
});
