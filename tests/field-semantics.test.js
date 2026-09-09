const test = require("node:test");
const assert = require("node:assert/strict");

const semantics = require("../shared/field-semantics.js");

test("inferSectionFromTexts leaves mixed work and project keywords unlocked", () => {
  const section = semantics.inferSectionFromTexts([
    "工作经历 项目经历 公司名称 项目名称",
  ]);
  assert.equal(section.key, "");
  assert.equal(section.score, 0);
});

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

test("self-evaluation labels do not collapse into the personal summary", () => {
  const validPaths = new Set(["personal.summary", "personal.selfEvaluation", "additional.coverLetterHighlights"]);
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "personal", label: "自我评价" },
      "",
      validPaths
    ),
    "personal.selfEvaluation"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      {
        sectionKey: "personal",
        label: "内容",
        sectionEvidence: "自我评价",
        nearbyLabels: ["自我评价"],
      },
      "",
      validPaths
    ),
    "personal.selfEvaluation"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "personal", label: "个人简介" },
      "",
      validPaths
    ),
    "personal.summary"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "personal", label: "内容" },
      "",
      validPaths
    ),
    ""
  );
});

test("emergency-contact relationship stays out of the family section", () => {
  const section = semantics.inferSectionFromTexts([
    "紧急联系人姓名",
    "与本人关系",
    "紧急联系人电话",
  ]);
  assert.notEqual(section.key, "family");
  const validPaths = new Set([
    "contactAndLocation.emergencyContactName",
    "contactAndLocation.emergencyContactRelationship",
    "contactAndLocation.emergencyContactPhone",
    "familyMembers.0.relationship",
  ]);
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "personal", label: "与本人关系" },
      "",
      validPaths
    ),
    "contactAndLocation.emergencyContactRelationship"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "family", sectionItemIndex: 0, sectionLocked: true, label: "与本人关系" },
      "",
      validPaths
    ),
    "familyMembers.0.relationship"
  );
});

test("inferSectionFromTexts recognizes family member sections", () => {
  const section = semantics.inferSectionFromTexts([
    "亲属信息",
    "亲属姓名",
    "与本人关系",
    "是否移动系统内任职",
  ]);
  assert.equal(section.key, "family");
  assert.equal(section.label, "亲属信息");
});

test("family member fields stay in the family list instead of personal identity", () => {
  const validPaths = new Set([
    "personal.fullName",
    "personal.gender",
    "personal.birthDate",
    "personal.phoneNumber",
    "identityAndAuthorization.politicalStatus",
    "contactAndLocation.currentAddressLine1",
    "contactAndLocation.emergencyContactName",
    "applicationDeclarations.relativesAtEmployer",
    "familyMembers.0.name",
    "familyMembers.0.relationship",
    "familyMembers.0.birthDate",
    "familyMembers.0.gender",
    "familyMembers.0.employedAtTargetOrg",
    "familyMembers.0.employer",
    "familyMembers.0.title",
    "familyMembers.0.phone",
    "familyMembers.0.politicalStatus",
    "familyMembers.0.currentAddress",
  ]);
  const familyField = (label, extra = {}) => ({
    sectionKey: "family",
    sectionItemIndex: 0,
    sectionLocked: true,
    label,
    ...extra,
  });

  assert.equal(
    semantics.resolvePreferredResumePath(familyField("亲属姓名"), "", validPaths),
    "familyMembers.0.name"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(familyField("姓名"), "", validPaths),
    "familyMembers.0.name"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(familyField("紧急联系人姓名"), "", validPaths),
    "contactAndLocation.emergencyContactName"
  );
  assert.equal(
    semantics.isResumePathCompatibleWithField(
      familyField("是否在应聘单位任职", { kind: "select", options: ["是", "否"] }),
      "familyMembers.0.employedAtTargetOrg"
    ),
    true
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      familyField("性别", { kind: "select", options: ["", "男", "女"] }),
      "",
      validPaths
    ),
    "familyMembers.0.gender"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(familyField("是否移动系统内任职"), "", validPaths),
    "familyMembers.0.employedAtTargetOrg"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(familyField("联系电话", { inputType: "tel" }), "", validPaths),
    "familyMembers.0.phone"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "work", label: "您是否有亲属在我公司工作" },
      "",
      validPaths
    ),
    "applicationDeclarations.relativesAtEmployer"
  );
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

test("inferSectionFromTexts separates job preferences from work experience", () => {
  const section = semantics.inferSectionFromTexts([
    "求职意向",
    "期望从事职业",
    "期望工作城市",
    "期望月薪(税前)",
  ]);

  assert.equal(section.key, "jobPreference");
});

test("common personal, preference, education, work, and language fields map locally", () => {
  const validPaths = new Set([
    "personal.email",
    "jobPreferences.targetRole",
    "educations.1.school",
    "workExperiences.0.company",
    "languages.0.proficiency",
  ]);

  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "personal", label: "邮箱" },
      "",
      validPaths
    ),
    "personal.email"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "jobPreference", label: "期望从事职业" },
      "",
      validPaths
    ),
    "jobPreferences.targetRole"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "education", sectionItemIndex: 1, label: "学校名称" },
      "",
      validPaths
    ),
    "educations.1.school"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "work", sectionItemIndex: 0, label: "单位名称" },
      "",
      validPaths
    ),
    "workExperiences.0.company"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "language", sectionItemIndex: 0, label: "听说" },
      "",
      validPaths
    ),
    "languages.0.proficiency"
  );
});

test("gender controls override an incompatible AI full-name mapping", () => {
  const validPaths = new Set(["personal.fullName", "personal.gender"]);

  assert.equal(
    semantics.resolvePreferredResumePath(
      {
        sectionKey: "",
        kind: "radio_group",
        label: "请输入",
        nearbyLabels: ["性别"],
        options: ["男", "女"],
      },
      "personal.fullName",
      validPaths
    ),
    "personal.gender"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      {
        sectionKey: "personal",
        kind: "text",
        label: "请输入",
        nearbyLabels: ["姓名", "性别"],
      },
      "personal.fullName",
      validPaths
    ),
    "personal.fullName"
  );
});

test("education identifiers map to their exact schema fields instead of degree or major", () => {
  const validPaths = new Set([
    "educations.0.studyMode",
    "educations.0.academicSystem",
    "educations.0.graduationStatus",
    "educations.0.advisor",
    "educations.0.ranking",
    "educations.0.degree",
    "educations.0.major",
  ]);
  const cases = [
    ["learningModality", "educations.0.studyMode"],
    ["schoolSystem", "educations.0.academicSystem"],
    ["eduStatus", "educations.0.graduationStatus"],
    ["请输入导师姓名", "educations.0.advisor"],
    ["majorRank", "educations.0.ranking"],
  ];

  for (const [label, expectedPath] of cases) {
    assert.equal(
      semantics.resolvePreferredResumePath(
        { sectionKey: "education", sectionItemIndex: 0, label },
        "educations.0.degree",
        validPaths
      ),
      expectedPath
    );
  }
});

test("status-only paper and empty-section checkboxes are rejected conservatively", () => {
  assert.match(
    semantics.getUnsupportedMappingReason({
      kind: "select",
      sectionKey: "education",
      label: "paperGrad",
    }),
    /论文是否发表/
  );
  assert.match(
    semantics.getUnsupportedMappingReason({
      kind: "checkbox_group",
      sectionKey: "internship",
      label: "暂无实习经历",
    }),
    /状态开关/
  );
});

test("strong HTML input types reject unrelated resume paths", () => {
  assert.equal(
    semantics.isResumePathCompatibleWithField(
      { inputType: "email", label: "邮箱" },
      "personal.fullName"
    ),
    false
  );
  assert.equal(
    semantics.isResumePathCompatibleWithField(
      { inputType: "tel", label: "手机号码" },
      "personal.phoneNumber"
    ),
    true
  );
  assert.equal(
    semantics.isResumePathCompatibleWithField(
      { inputType: "date", label: "出生日期" },
      "personal.fullName"
    ),
    false
  );
});

test("ambiguous container text cannot authorize a precise personal mapping", () => {
  const field = {
    sectionKey: "personal",
    label: "请输入",
    context: "姓名 性别 手机号 紧急联系人姓名 紧急联系人电话",
  };

  assert.equal(
    semantics.isResumePathCompatibleWithField(field, "personal.fullName"),
    false
  );
});

test("campus recruitment one-off fields map across generic page sections", () => {
  const validPaths = new Set([
    "personal.ethnicity",
    "personal.heightCm",
    "identityAndAuthorization.politicalStatus",
    "derived.highestEducation.weightedAverageScore",
    "derived.highestEducation.hasDualDegree",
    "applicationDeclarations.relativesAtEmployer",
    "contactAndLocation.hometownProvince",
    "contactAndLocation.hometownCity",
  ]);

  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "personal", label: "民族" },
      "",
      validPaths
    ),
    "personal.ethnicity"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "personal", label: "身高（cm）" },
      "",
      validPaths
    ),
    "personal.heightCm"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "personal", label: "政治面貌" },
      "",
      validPaths
    ),
    "identityAndAuthorization.politicalStatus"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "personal", label: "加权平均分" },
      "",
      validPaths
    ),
    "derived.highestEducation.weightedAverageScore"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "personal", label: "是否双学位" },
      "",
      validPaths
    ),
    "derived.highestEducation.hasDualDegree"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "work", label: "您是否有亲属在我公司工作" },
      "",
      validPaths
    ),
    "applicationDeclarations.relativesAtEmployer"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "personal", label: "家庭所在地", compositeRole: "regionProvince" },
      "",
      validPaths
    ),
    "contactAndLocation.hometownProvince"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "personal", label: "家庭所在地", compositeRole: "regionCity" },
      "",
      validPaths
    ),
    "contactAndLocation.hometownCity"
  );
});

test("internships project into a work-only page without changing stored types", () => {
  const profile = {
    workExperiences: [],
    internships: [
      { company: "甲公司", endDate: "2026-09" },
      { company: "乙公司", endDate: "2023-06" },
    ],
  };
  const projection = semantics.buildWorkOnlyExperienceProjection(
    [{ sectionKey: "work" }],
    profile
  );

  assert.deepEqual(
    projection.map(({ sectionKey, itemIndex }) => ({ sectionKey, itemIndex })),
    [
      { sectionKey: "internships", itemIndex: 0 },
      { sectionKey: "internships", itemIndex: 1 },
    ]
  );
  assert.deepEqual(
    semantics.projectWorkFieldToExperienceSource(
      { sectionKey: "work", sectionItemIndex: 1, label: "单位名称" },
      projection
    ),
    {
      sectionKey: "internship",
      sectionItemIndex: 1,
      label: "单位名称",
      projectedFromSectionKey: "work",
    }
  );
  assert.equal(
    semantics.buildWorkOnlyExperienceProjection(
      [{ sectionKey: "work" }, { sectionKey: "internship" }],
      profile
    ).length,
    0
  );
});

test("work-only projection preserves ordered company and title label semantics", () => {
  const validPaths = new Set([
    "internships.0.company",
    "internships.0.title",
  ]);
  const companyField = {
    sectionKey: "internship",
    projectedFromSectionKey: "work",
    sectionItemIndex: 0,
    label: "请输入",
    nearbyLabels: ["公司名称", "职位名称"],
    context: "工作经历 / 公司名称 / 职位名称",
  };
  const titleField = {
    sectionKey: "internship",
    projectedFromSectionKey: "work",
    sectionItemIndex: 0,
    label: "请输入",
    nearbyLabels: ["职位名称", "公司名称"],
    context: "工作经历 / 职位名称 / 公司名称",
  };

  assert.equal(
    semantics.resolvePreferredResumePath(companyField, "", validPaths),
    "internships.0.company"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(titleField, "", validPaths),
    "internships.0.title"
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

test("practice and competition wording maps through generic resume semantics", () => {
  assert.equal(
    semantics.inferSectionFromTexts(["实践活动（包含校内实践或校外实习经历）"]).key,
    "internship"
  );
  assert.equal(
    semantics.inferSectionFromTexts(["奖励荣誉", "竞赛名称"]).key,
    "award"
  );

  assert.equal(
    semantics.resolvePreferredResumePath(
      {
        sectionKey: "internship",
        sectionItemIndex: 1,
        label: "实践活动/公司名称",
      },
      "",
      new Set(["internships.1.title"])
    ),
    "internships.1.title"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      {
        sectionKey: "award",
        sectionItemIndex: 2,
        label: "竞赛描述",
      },
      "",
      new Set(["awards.2.details"])
    ),
    "awards.2.details"
  );
});
