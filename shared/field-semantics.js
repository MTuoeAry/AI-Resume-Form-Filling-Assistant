(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.ResumeFieldSemantics = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    const SECTION_RULES = [
      {
        key: "personal",
        label: "基本信息",
        keywords: [
          "基本信息", "个人信息", "联系方式", "姓名", "邮箱", "手机", "电话", "证件",
          "personal information", "contact information", "email address", "phone number",
          "自我评价", "self evaluation", "self-evaluation",
        ],
      },
      {
        key: "education",
        label: "教育经历",
        keywords: [
          "教育经历",
          "学校名称",
          "学校",
          "学历类型",
          "培养方式",
          "学历",
          "学位",
          "学院",
          "专业",
          "实验室",
          "领域方向",
          "导师",
          "学号",
          "班级",
          "学制",
          "毕业",
          "毕业论文",
          "学位论文",
          "论文题目",
          "gpa",
          "education",
          "education experience",
          "school name",
          "university",
          "institution",
          "degree",
          "major",
          "graduation date",
        ],
      },
      {
        key: "internship",
        label: "实习经历",
        keywords: [
          "实习经历",
          "实习",
          "实践活动",
          "社会实践",
          "实习公司",
          "实习岗位",
          "实习部门",
          "实习城市",
          "实习生",
          "internship",
          "internship experience",
          "intern company",
          "intern position",
        ],
      },
      {
        key: "jobPreference",
        label: "求职偏好",
        keywords: [
          "求职意向", "求职偏好", "期望从事行业", "期望从事职业",
          "期望工作城市", "期望月薪", "到岗时间", "职业意向",
          "job preference", "career preference", "desired industry",
          "desired position", "preferred location", "salary expectation", "availability",
        ],
      },
      {
        key: "skill",
        label: "技能与亮点",
        keywords: [
          "技能与亮点", "专业技能", "核心技能", "技术能力", "代表性成绩", "兴趣爱好",
          "skills", "technical skills", "core competencies", "notable achievements",
        ],
      },
      {
        key: "work",
        label: "工作经历",
        keywords: [
          "工作经历",
          "工作",
          "公司名称",
          "职位名称",
          "所属部门",
          "工作职责",
          "工作成绩",
          "work experience",
          "employment history",
          "company name",
          "employer",
          "job title",
          "responsibilities",
        ],
      },
      {
        key: "project",
        label: "项目经历",
        keywords: [
          "项目经历",
          "项目经验",
          "项目名称",
          "项目角色",
          "项目链接",
          "项目说明",
          "项目亮点",
          "项目描述",
          "项目职责",
          "项目成果",
          "project experience",
          "project name",
          "project title",
          "project responsibilities",
          "project outcomes",
          "project achievements",
        ],
      },
      {
        key: "campus",
        label: "校园经历",
        keywords: [
          "校园经历",
          "在校职务",
          "学生组织",
          "社团",
          "班干部",
          "校园活动",
          "志愿服务",
          "科研助理",
          "组织名称",
          "campus experience",
          "campus activities",
          "student organization",
          "volunteer experience",
        ],
      },
      {
        key: "certificate",
        label: "证书与认证",
        keywords: ["证书", "认证", "发证", "等级考试", "资格证", "certificates", "certifications", "license"],
      },
      {
        key: "language",
        label: "语言能力",
        keywords: ["语言能力", "语言", "外语", "雅思", "托福", "cet", "四六级", "languages", "language proficiency"],
      },
      {
        key: "family",
        label: "亲属信息",
        keywords: [
          "亲属信息",
          "家庭成员",
          "家属信息",
          "亲属姓名",
          "family members",
          "family member",
          "relative name",
        ],
      },
      {
        key: "award",
        label: "获奖经历",
        keywords: [
          "获奖经历",
          "获奖记录",
          "奖励荣誉",
          "荣誉奖励",
          "竞赛情况",
          "竞赛名称",
          "竞赛时间",
          "获奖时间",
          "奖项名称",
          "奖项类型",
          "奖项级别",
          "奖项等级",
          "awards",
          "award date",
          "award name",
          "award title",
          "award type",
          "award level",
          "award rank",
        ],
      },
      {
        key: "patent",
        label: "发明专利",
        keywords: [
          "发明专利",
          "专利名称",
          "专利编号",
          "专利类型",
          "专利状态",
          "发布时间",
          "专利详情",
          "patents",
          "patent name",
          "patent title",
          "patent number",
          "patent type",
          "patent status",
        ],
      },
      {
        key: "publication",
        label: "论文发表",
        keywords: [
          "论文发表",
          "发表论文",
          "发表时间",
          "论文",
          "论文名称",
          "论文详情",
          "期刊名称",
          "会议名称",
          "发表渠道",
          "影响因子",
          "作者顺序",
          "publications",
          "publication",
          "paper",
          "publication date",
          "publication title",
          "paper title",
          "paper details",
          "publication details",
        ],
      },
    ];

    const fieldConcepts =
      (typeof require === "function" ? require("./field-concepts") : null) ||
      (typeof globalThis !== "undefined" ? globalThis.ResumeFieldConcepts : null) ||
      null;
    const mappingPolicy =
      (typeof require === "function" ? require("./mapping-policy") : null) ||
      (typeof globalThis !== "undefined" ? globalThis.ResumeMappingPolicy : null) ||
      null;

    const SECTION_SCHEMA_KEYS = Object.freeze({
      personal: "personal",
      jobPreference: "jobPreferences",
      skill: "skills",
      education: "educations",
      internship: "internships",
      work: "workExperiences",
      project: "projects",
      campus: "campusExperiences",
      certificate: "certificates",
      language: "languages",
      family: "familyMembers",
      award: "awards",
      patent: "patents",
      publication: "publications",
    });

    const STRUCTURED_FIELD_RULES = Object.freeze({
      personal: [
        { fieldKey: "fullName", patterns: ["姓名", "name", "full name", "fullname"] },
        { fieldKey: "firstNamePinyin", patterns: ["名拼音", "given name pinyin", "firstnamepinyin"] },
        { fieldKey: "lastNamePinyin", patterns: ["姓拼音", "family name pinyin", "lastnamepinyin", "surnamepinyin"] },
        { fieldKey: "middleName", patterns: ["中间名", "middle name", "middlename"] },
        { fieldKey: "preferredName", patterns: ["常用名", "昵称", "preferred name", "preferredname"] },
        { fieldKey: "englishName", patterns: ["英文名", "english name", "englishname"] },
        { fieldKey: "firstName", patterns: ["名字", "名", "given name", "firstname"] },
        { fieldKey: "lastName", patterns: ["姓氏", "姓", "family name", "lastname", "surname"] },
        { fieldKey: "gender", patterns: ["性别", "gender", "sex"] },
        { fieldKey: "birthDate", patterns: ["出生日期", "出生年月", "生日", "birth date", "birthdate", "birthday"] },
        { fieldKey: "age", patterns: ["年龄", "age"] },
        { fieldKey: "alternateEmail", patterns: ["备用邮箱", "其他邮箱", "alternate email", "secondary email"] },
        { fieldKey: "email", patterns: ["邮箱", "电子邮箱", "email", "email address"] },
        { fieldKey: "phoneCountryCode", patterns: ["手机区号", "国际区号", "国家区号", "country code", "phonecountrycode"] },
        { fieldKey: "alternatePhone", patterns: ["备用电话", "其他电话", "alternate phone", "secondary phone"] },
        { fieldKey: "phoneNumber", patterns: ["手机号", "手机号码", "联系电话", "mobile", "phone number", "phonenumber"] },
        { fieldKey: "wechatId", patterns: ["微信号", "微信账号", "wechat", "wechatid"] },
        { fieldKey: "currentDistrict", patterns: ["现居区县", "现居住区县", "current district", "currentdistrict"] },
        { fieldKey: "currentProvince", patterns: ["现居省份", "现居住省份", "current province", "currentprovince"] },
        { fieldKey: "currentCountry", patterns: ["现居国家", "现居住国家", "current country", "currentcountry"] },
        { fieldKey: "currentCity", patterns: ["现居城市", "现居住城市", "当前城市", "current city", "currentcity"] },
        { fieldKey: "nationality", patterns: ["国籍/地区", "国籍", "nationality"] },
        { fieldKey: "citizenship", patterns: ["公民身份", "citizenship"] },
        { fieldKey: "ethnicity", patterns: ["民族", "ethnicity", "ethnic group"] },
        { fieldKey: "maritalStatus", patterns: ["婚姻状况", "婚姻状态", "marital status", "maritalstatus"] },
        { fieldKey: "currentCompany", patterns: ["当前公司", "现公司", "current company", "currentcompany"] },
        { fieldKey: "currentTitle", patterns: ["当前职位", "现职位", "current title", "currenttitle"] },
        { fieldKey: "yearsOfManagement", patterns: ["管理经验年限", "管理年限", "years of management", "yearsofmanagement"] },
        { fieldKey: "yearsOfExperience", patterns: ["工作年限", "工作经验年限", "years of experience", "work years"] },
        { fieldKey: "summary", patterns: ["个人简介", "个人概述", "自我介绍", "personal summary", "profile summary"] },
        { fieldKey: "selfEvaluation", patterns: ["自我评价", "自我评述", "self evaluation", "self-evaluation", "selfevaluation", "self assessment"] },
      ],
      jobPreference: [
        { fieldKey: "targetIndustry", patterns: ["期望从事行业", "期望行业", "目标行业", "desired industry", "target industry"] },
        { fieldKey: "targetRole", patterns: ["期望从事职业", "期望职位", "期望岗位", "目标岗位", "desired position", "target role", "target position"] },
        { fieldKey: "targetLevel", patterns: ["目标职级", "期望职级", "target level", "desired level"] },
        { fieldKey: "targetDepartment", patterns: ["目标部门", "期望部门", "target department", "desired department"] },
        { fieldKey: "preferredLocations", patterns: ["可接受工作地点", "可接受地点", "意向地点", "preferred locations", "acceptable locations"] },
        { fieldKey: "expectedCity", patterns: ["期望工作城市", "期望城市", "工作地点", "preferred city", "preferred location", "expected city"] },
        { fieldKey: "expectedCountry", patterns: ["期望国家", "目标国家", "expected country", "preferred country"] },
        { fieldKey: "expectedSalary", patterns: ["期望月薪", "期望薪资", "薪资期望", "expected salary", "salary expectation"] },
        { fieldKey: "availableDate", patterns: ["可入职日期", "最早入职日期", "available date", "availability date"] },
        { fieldKey: "noticePeriod", patterns: ["到岗周期", "通知期", "notice period"] },
        { fieldKey: "preferredStartTime", patterns: ["到岗时间", "预计到岗", "入职时间", "availability", "available to start", "start availability"] },
        { fieldKey: "currentCompensation", patterns: ["现月薪", "当前薪资", "目前薪资", "current salary", "current compensation"] },
        { fieldKey: "employmentType", patterns: ["期望用工类型", "期望工作性质", "employment type", "desired employment type"] },
        { fieldKey: "willingToRelocate", patterns: ["是否接受异地", "是否接受搬迁", "接受调动", "willing to relocate", "relocation"] },
        { fieldKey: "willingToTravel", patterns: ["是否接受出差", "接受出差", "willing to travel", "business travel"] },
        { fieldKey: "remotePreference", patterns: ["办公方式偏好", "远程办公偏好", "remote preference", "work mode preference"] },
        { fieldKey: "preferredInterviewLanguage", patterns: ["面试语言偏好", "面试语言", "preferred interview language"] },
      ],
      skill: [
        { fieldKey: "programmingLanguages", patterns: ["编程语言", "开发语言", "programming languages"] },
        { fieldKey: "primarySkills", patterns: ["核心技能", "专业技能", "技术能力", "技术专长", "primary skills", "technical skills", "core skills"] },
        { fieldKey: "frameworks", patterns: ["框架", "开发框架", "frameworks"] },
        { fieldKey: "aiTools", patterns: ["ai/大模型工具", "ai工具", "大模型工具", "ai tools", "llm tools"] },
        { fieldKey: "cloudPlatforms", patterns: ["云平台", "云计算平台", "cloud platforms"] },
        { fieldKey: "databases", patterns: ["数据库", "databases"] },
        { fieldKey: "tooling", patterns: ["工程工具", "开发工具", "tooling", "engineering tools"] },
        { fieldKey: "domainKnowledge", patterns: ["行业经验", "领域经验", "domain knowledge", "industry experience"] },
        { fieldKey: "managementExperience", patterns: ["管理经验", "团队管理", "management experience"] },
        { fieldKey: "softSkills", patterns: ["软技能", "综合能力", "soft skills"] },
        { fieldKey: "notableAchievements", patterns: ["代表性成绩", "主要成绩", "核心成果", "notable achievements"] },
        { fieldKey: "interests", patterns: ["兴趣爱好", "个人爱好", "interests", "hobbies"] },
      ],
      education: [
        { fieldKey: "school", patterns: ["学校名称", "毕业院校", "学校", "school name", "school", "university", "institution"] },
        { fieldKey: "educationType", patterns: ["学历类型", "学历性质", "教育类型", "education type", "educationtype", "educationcategory", "educationnature"] },
        { fieldKey: "studyMode", patterns: ["培养方式", "学习形式", "学习方式", "learning modality", "learningmodality", "learningmode", "study mode", "studymode"] },
        { fieldKey: "startDate", patterns: ["开始时间", "入学时间", "开始日期", "start date", "startdate"] },
        { fieldKey: "endDate", patterns: ["结束时间", "毕业时间", "结束日期", "end date", "enddate", "graduation date"] },
        { fieldKey: "academicSystem", patterns: ["学制", "修业年限", "school system", "schoolsystem", "academic system", "academicsystem"] },
        { fieldKey: "graduationStatus", patterns: ["毕业状态", "学籍状态", "在读状态", "education status", "educationstatus", "edu status", "edustatus", "graduation status"] },
        { fieldKey: "weightedAverageScore", patterns: ["加权平均分", "加权平均成绩", "百分制成绩", "weighted average", "weightedaverage", "averagescore"] },
        { fieldKey: "ranking", patterns: ["专业排名", "班级排名", "major rank", "majorrank", "ranking", "rank"] },
        { fieldKey: "minor", patterns: ["第二专业", "辅修专业", "辅修", "second major", "minor"] },
        { fieldKey: "major", patterns: ["专业名称", "所学专业", "专业", "major", "field of study"] },
        { fieldKey: "degree", patterns: ["学历", "学历层次", "education level", "educationlevel"] },
        { fieldKey: "academicDegree", patterns: ["学位", "academic degree", "academicdegree", "degree"] },
        { fieldKey: "isFullTime", patterns: ["是否全日制", "isfulltime", "full time study", "fulltimestudy"] },
        { fieldKey: "schoolType", patterns: ["院校性质", "学校性质", "school type", "schooltype", "schoolproperty"] },
        { fieldKey: "majorDescription", patterns: ["专业描述", "major description", "majordescription"] },
        { fieldKey: "faculty", patterns: ["院系", "学院", "faculty", "department"] },
        { fieldKey: "gpa", patterns: ["gpa", "绩点"] },
        { fieldKey: "className", patterns: ["班级名称", "所在班级", "班级", "class name", "classname"] },
        { fieldKey: "studentId", patterns: ["学号", "student id", "studentid", "student number", "studentnumber"] },
        { fieldKey: "laboratory", patterns: ["实验室", "laboratory", "lab name", "labname"] },
        { fieldKey: "researchDirection", patterns: ["研究方向", "领域方向", "research direction", "researchdirection"] },
        { fieldKey: "advisor", patterns: ["导师姓名", "导师", "tutor", "mentor", "advisor", "supervisor"] },
        { fieldKey: "thesisTitle", patterns: ["毕业论文题目", "学位论文题目", "论文题目", "thesis title", "thesistitle"] },
        { fieldKey: "courses", patterns: ["核心课程", "主修课程", "主要课程", "专业课程", "courses", "coursework"] },
        { fieldKey: "makeupRetakeCourseCount", patterns: ["补考及重修", "补考门数", "重修门数", "retake course", "failed course"] },
        { fieldKey: "hasDualDegree", patterns: ["是否双学位", "双学位", "dual degree", "dualdegree"] },
        { fieldKey: "isUpgradedFromJuniorCollege", patterns: ["是否专升本", "专升本", "junior college upgrade", "topupdegree"] },
        { fieldKey: "city", patterns: ["学校城市", "就读城市", "所在城市", "school city"] },
        { fieldKey: "country", patterns: ["学校国家", "就读国家", "所在国家", "school country"] },
        { fieldKey: "description", patterns: ["教育经历描述", "教育补充说明", "补充说明", "education description"] },
      ],
      internship: [
        { fieldKey: "title", patterns: ["实习岗位", "实践活动名称", "实践活动/公司名称", "职位名称", "岗位名称", "职位", "job title", "position", "role"] },
        { fieldKey: "company", patterns: ["实习公司", "实习单位", "公司名称", "单位名称", "company", "employer"] },
        { fieldKey: "startDate", patterns: ["开始时间", "开始日期", "start date", "startdate"] },
        { fieldKey: "endDate", patterns: ["结束时间", "结束日期", "end date", "enddate"] },
        { fieldKey: "isCurrent", patterns: ["至今", "仍在实习", "是否当前", "current", "present"] },
        { fieldKey: "description", patterns: ["工作职责", "实习职责", "实习内容", "实践活动详细描述", "岗位职责", "主要职责", "描述", "responsibilities", "job description"] },
        { fieldKey: "achievements", patterns: ["工作成绩", "实习成果", "主要成果", "成果", "业绩", "achievements", "outcomes"] },
        { fieldKey: "department", patterns: ["所属部门", "实习部门", "部门", "department"] },
        { fieldKey: "city", patterns: ["实习城市", "工作城市", "所在城市", "city", "location"] },
        { fieldKey: "country", patterns: ["实习国家", "工作国家", "国家", "country"] },
        { fieldKey: "technologies", patterns: ["使用技术", "技术栈", "technologies", "tech stack"] },
      ],
      work: [
        { fieldKey: "company", patterns: ["公司名称", "单位名称", "任职单位", "company", "employer"] },
        { fieldKey: "title", patterns: ["职位名称", "岗位名称", "职位", "job title", "position", "role"] },
        { fieldKey: "startDate", patterns: ["开始时间", "开始日期", "start date", "startdate"] },
        { fieldKey: "endDate", patterns: ["结束时间", "结束日期", "end date", "enddate"] },
        { fieldKey: "isCurrent", patterns: ["至今", "是否为当前工作", "是否当前", "当前工作", "current", "present"] },
        { fieldKey: "description", patterns: ["工作职责", "岗位职责", "主要职责", "工作内容", "responsibilities", "job description"] },
        { fieldKey: "achievements", patterns: ["工作成绩", "主要成果", "工作业绩", "业绩", "achievements", "outcomes"] },
        { fieldKey: "department", patterns: ["所属部门", "任职部门", "部门", "department"] },
        { fieldKey: "employmentType", patterns: ["用工类型", "雇佣类型", "工作性质", "employment type", "employmenttype"] },
        { fieldKey: "industry", patterns: ["所在行业", "公司行业", "行业", "industry"] },
        { fieldKey: "city", patterns: ["工作城市", "所在城市", "city", "location"] },
        { fieldKey: "country", patterns: ["工作国家", "所在国家", "country"] },
        { fieldKey: "locationMode", patterns: ["办公方式", "工作方式", "location mode", "work mode"] },
        { fieldKey: "teamSize", patterns: ["团队规模", "团队人数", "team size", "teamsize"] },
        { fieldKey: "technologies", patterns: ["使用技术", "技术栈", "technologies", "tech stack"] },
      ],
      project: [
        { fieldKey: "name", patterns: ["项目名称", "project name", "project title"] },
        { fieldKey: "startDate", patterns: ["开始时间", "开始日期", "start date", "startdate"] },
        { fieldKey: "endDate", patterns: ["结束时间", "结束日期", "end date", "enddate"] },
        { fieldKey: "role", patterns: ["项目职责", "项目角色", "本人职责", "本人角色", "responsibilities", "responsibility", "project responsibilities", "project responsibility", "project role", "projectrole", "project duty", "projectduty"] },
        { fieldKey: "description", patterns: ["项目描述", "项目说明", "project description", "projectdescription"] },
        { fieldKey: "highlights", patterns: ["项目成果", "项目亮点", "project outcomes", "project achievements", "project highlights"] },
        { fieldKey: "organization", patterns: ["所属组织", "项目单位", "项目组织", "organization"] },
        { fieldKey: "repoUrl", patterns: ["代码仓库", "仓库链接", "repository url", "repo url", "github"] },
        { fieldKey: "demoUrl", patterns: ["演示链接", "demo url", "demo link"] },
        { fieldKey: "url", patterns: ["项目链接", "project url", "project link"] },
        { fieldKey: "technologies", patterns: ["技术栈", "使用技术", "technologies", "tech stack"] },
      ],
      campus: [
        { fieldKey: "category", patterns: ["经历类型", "活动类型", "校园经历类型", "category", "activity type"] },
        { fieldKey: "organization", patterns: ["组织名称", "社团名称", "学生组织", "organization", "club name"] },
        { fieldKey: "role", patterns: ["担任角色", "担任职务", "职务", "role", "position"] },
        { fieldKey: "startDate", patterns: ["开始时间", "开始日期", "start date", "startdate"] },
        { fieldKey: "endDate", patterns: ["结束时间", "结束日期", "end date", "enddate"] },
        { fieldKey: "isCurrent", patterns: ["至今", "仍在参与", "是否当前", "current", "present"] },
        { fieldKey: "description", patterns: ["经历描述", "活动描述", "主要职责", "描述", "description", "responsibilities"] },
        { fieldKey: "achievements", patterns: ["经历成果", "活动成果", "主要成果", "成果", "achievements", "outcomes"] },
      ],
      certificate: [
        { fieldKey: "name", patterns: ["证书名称", "认证名称", "certificate name", "certification name"] },
        { fieldKey: "issuer", patterns: ["颁发机构", "发证机构", "认证机构", "issuer", "issuing organization"] },
        { fieldKey: "issueDate", patterns: ["发证日期", "取得日期", "颁发日期", "issue date", "issuedate"] },
        { fieldKey: "expiryDate", patterns: ["到期日期", "有效期至", "expiry date", "expiration date"] },
        { fieldKey: "score", patterns: ["证书成绩", "考试成绩", "分数", "等级", "score", "grade"] },
        { fieldKey: "credentialId", patterns: ["证书编号", "认证编号", "credential id", "certificate number"] },
        { fieldKey: "credentialUrl", patterns: ["证书链接", "认证链接", "credential url", "certificate url"] },
      ],
      family: [
        { fieldKey: "name", patterns: ["亲属姓名", "成员姓名", "家属姓名", "姓名", "relative name", "family member name"] },
        { fieldKey: "relationship", patterns: ["与本人关系", "与申请人关系", "亲属关系", "relationship to self", "relationship"] },
        { fieldKey: "birthDate", patterns: ["出生日期", "出生年月", "生日", "date of birth", "birth date", "birthdate"] },
        { fieldKey: "gender", patterns: ["性别", "gender", "sex"] },
        {
          fieldKey: "employedAtTargetOrg",
          patterns: [
            "是否在应聘单位任职",
            "是否在本系统任职",
            "是否在本公司任职",
            "是否在本单位任职",
            "系统内任职",
            "移动系统内任职",
            "employed at target organization",
            "employed in the system",
          ],
        },
        { fieldKey: "employer", patterns: ["亲属工作单位", "工作单位", "所在单位", "relative employer", "work unit"] },
        { fieldKey: "title", patterns: ["亲属职位", "亲属职务", "职位", "职务", "relative title", "relative position"] },
        { fieldKey: "phone", patterns: ["联系电话", "亲属电话", "家属电话", "contact phone", "relative phone"] },
        { fieldKey: "politicalStatus", patterns: ["政治面貌", "political status", "political affiliation"] },
        { fieldKey: "currentAddress", patterns: ["现居住地址", "现住址", "居住地址", "current residential address", "current address"] },
      ],
      award: [
        { fieldKey: "date", patterns: ["获奖时间", "获奖日期", "竞赛时间", "award date", "award time", "awarddate", "awardtime", "date awarded"] },
        { fieldKey: "name", patterns: ["奖项名称", "获奖名称", "荣誉名称", "竞赛名称", "award name", "award title", "honor name"] },
        { fieldKey: "type", patterns: ["奖项类型", "award type"] },
        { fieldKey: "level", patterns: ["奖项级别", "award level"] },
        { fieldKey: "rank", patterns: ["奖项等级", "获奖名次", "所获名次", "award rank", "award grade"] },
        { fieldKey: "issuer", patterns: ["颁发机构", "授予单位", "issuing organization", "issuer"] },
        { fieldKey: "details", patterns: ["奖项详情", "获奖详情", "奖项描述", "竞赛描述", "award details", "award description"] },
      ],
      patent: [
        { fieldKey: "publicationDate", patterns: ["发布时间", "公开时间", "publication date", "publicationdate", "filing date", "filingdate"] },
        { fieldKey: "name", patterns: ["专利名称", "patent name", "patent title"] },
        { fieldKey: "number", patterns: ["专利编号", "专利号", "patent number", "application number"] },
        { fieldKey: "type", patterns: ["专利类型", "patent type"] },
        { fieldKey: "status", patterns: ["专利状态", "patent status"] },
        { fieldKey: "role", patterns: ["本人角色", "发明人排序", "inventor order", "inventor role"] },
        { fieldKey: "details", patterns: ["专利详情", "patent details", "patent description"] },
      ],
      publication: [
        { fieldKey: "publicationDate", patterns: ["发表时间", "发布时间", "publication date", "publication time", "publicationdate", "publicationtime", "published date"] },
        { fieldKey: "title", patterns: ["论文名称", "论文题目", "publication title", "paper title", "papername"] },
        { fieldKey: "venue", patterns: ["期刊名称", "会议名称", "期刊会议", "发表渠道", "journal name", "conference name", "publication channel", "publicationchannel", "venue"] },
        { fieldKey: "authors", patterns: ["作者", "作者列表", "authors", "author list"] },
        { fieldKey: "role", patterns: ["本人角色", "作者排序", "author order", "authororder", "author role"] },
        { fieldKey: "impactFactor", patterns: ["影响因子", "impact factor", "impactfactor"] },
        { fieldKey: "url", patterns: ["论文链接", "论文地址", "publication url", "publication link", "publicationlink", "paper url", "paper link", "paperlink", "doi"] },
        { fieldKey: "details", patterns: ["论文详情", "论文摘要", "publication details", "paper details", "abstract"] },
      ],
      language: [
        { fieldKey: "name", patterns: ["外语能力类型", "外语种类", "语言类型", "语言名称", "外语类型", "语种", "language type", "language name"] },
        { fieldKey: "proficiency", patterns: ["掌握程度", "熟练程度", "听说", "读写", "language proficiency", "proficiency", "speaking", "reading", "writing"] },
        { fieldKey: "examType", patterns: ["英语考试类型", "外语证书类型", "语言考试名称", "考试类型"] },
        { fieldKey: "examLevel", patterns: ["考试等级", "证书等级", "cet等级"] },
        { fieldKey: "scoreValue", patterns: ["考试得分", "语言考试分数", "外语成绩"] },
        { fieldKey: "scoreScale", patterns: ["成绩分制"] },
        { fieldKey: "cefrLevel", patterns: ["cefr", "欧洲语言等级", "cefr等级"] },
        { fieldKey: "testScore", patterns: ["语言成绩", "考试成绩", "证书成绩", "language score", "test score"] },
      ],
    });

    const DIRECT_GROUP_PATH_RULES = Object.freeze([
      { path: "personal.selfEvaluation", sections: ["personal", ""], patterns: ["自我评价", "自我评述", "self evaluation", "self-evaluation", "selfevaluation"] },
      { path: "contactAndLocation.emergencyContactName", sections: ["personal", "", "family"], patterns: ["紧急联系人姓名", "应急联系人姓名", "emergency contact name"] },
      { path: "contactAndLocation.emergencyContactRelationship", sections: ["personal", "", "family"], patterns: ["紧急联系人关系", "与紧急联系人关系", "emergency contact relationship"] },
      { path: "contactAndLocation.emergencyContactRelationship", sections: ["personal"], patterns: ["与本人关系"] },
      { path: "contactAndLocation.emergencyContactPhone", sections: ["personal", "", "family"], patterns: ["紧急联系人电话", "紧急联系人手机", "应急联系人电话", "emergency contact phone"] },
      { path: "contactAndLocation.currentAddressLine1", sections: ["personal", ""], patterns: ["现居地址1", "现居住址1", "当前地址1", "current address line 1"] },
      { path: "contactAndLocation.currentAddressLine2", sections: ["personal", ""], patterns: ["现居地址2", "现居住址2", "当前地址2", "current address line 2"] },
      { path: "contactAndLocation.postalCode", sections: ["personal", ""], patterns: ["邮政编码", "邮编", "postal code", "zipcode", "zip code"] },
      { path: "contactAndLocation.hometownCity", sections: ["personal", ""], patterns: ["籍贯城市", "籍贯市", "hometown city"] },
      { path: "contactAndLocation.hometownProvince", sections: ["personal", ""], patterns: ["籍贯省份", "籍贯省", "hometown province", "hometown state"] },
      { path: "contactAndLocation.hukouLocation", sections: ["personal", ""], patterns: ["户口所在地", "户籍所在地", "户口地址", "hukou", "registered residence"] },
      { path: "contactAndLocation.timezone", sections: ["personal", ""], patterns: ["当前时区", "所在时区", "timezone", "time zone"] },
      { path: "identityAndAuthorization.passportName", sections: ["personal", ""], patterns: ["护照姓名", "护照英文姓名", "passport name"] },
      { path: "identityAndAuthorization.passportNumber", sections: ["personal", ""], patterns: ["护照号码", "护照号", "passport number"] },
      { path: "identityAndAuthorization.passportExpiryDate", sections: ["personal", ""], patterns: ["护照到期日", "护照有效期至", "passport expiry", "passport expiration"] },
      { path: "identityAndAuthorization.personalIdType", sections: ["personal", ""], patterns: ["证件类型", "证件类别", "身份证件类型", "identity document type", "id type"] },
      { path: "identityAndAuthorization.workAuthorization", sections: ["personal", ""], patterns: ["工作资格", "工作许可", "合法工作资格", "work authorization", "work eligibility"] },
      { path: "identityAndAuthorization.visaStatus", sections: ["personal", ""], patterns: ["签证状态", "签证情况", "visa status"] },
      { path: "identityAndAuthorization.sponsorshipNeeded", sections: ["personal", ""], patterns: ["是否需要签证担保", "需要签证担保", "visa sponsorship", "sponsorship needed"] },
      { path: "identityAndAuthorization.driversLicense", sections: ["personal", ""], patterns: ["是否持有驾照", "驾驶证", "驾照", "driver's license", "drivers license"] },
      { path: "identityAndAuthorization.securityClearance", sections: ["personal", ""], patterns: ["安全许可", "涉密资质", "security clearance"] },
      { path: "onlinePresence.linkedinUrl", sections: ["personal", ""], patterns: ["linkedin链接", "linkedin主页", "linkedin profile"] },
      { path: "onlinePresence.githubUrl", sections: ["personal", ""], patterns: ["github链接", "github主页", "github profile"] },
      { path: "onlinePresence.portfolioUrl", sections: ["personal", ""], patterns: ["作品集链接", "作品集地址", "portfolio url", "portfolio link"] },
      { path: "onlinePresence.websiteUrl", sections: ["personal", ""], patterns: ["个人网站", "个人主页", "personal website", "website url"] },
      { path: "onlinePresence.blogUrl", sections: ["personal", ""], patterns: ["博客链接", "博客地址", "blog url", "blog link"] },
      { path: "onlinePresence.leetcodeUrl", sections: ["personal", ""], patterns: ["leetcode链接", "leetcode主页", "leetcode profile"] },
      { path: "onlinePresence.otherProfileLinks", sections: ["personal", ""], patterns: ["其他主页链接", "其他个人主页", "other profile links"] },
      { path: "applicationDeclarations.relativesDetails", sections: ["", "personal", "work"], patterns: ["应聘单位亲属情况", "公司亲属情况", "亲属姓名关系部门", "relative details"] },
      { path: "personal.ethnicity", sections: ["personal", ""], patterns: ["民族", "ethnicity", "ethnic group"] },
      { path: "personal.heightCm", sections: ["personal", ""], patterns: ["身高", "height"] },
      { path: "personal.weightKg", sections: ["personal", ""], patterns: ["体重", "weight"] },
      { path: "derived.highestEducation.school", sections: ["personal", ""], patterns: ["毕业院校（最高学历", "最高学历院校", "highest education school"] },
      { path: "derived.highestEducation.faculty", sections: ["personal", ""], patterns: ["学院（最高学历", "最高学历学院", "highest education faculty"] },
      { path: "derived.highestEducation.major", sections: ["personal", ""], patterns: ["最高学历专业", "highest education major"] },
      { path: "derived.highestEducation.endDate", sections: ["personal", ""], patterns: ["最高学历毕业时间", "毕业时间（最高学历"] },
      { path: "derived.highestEducation.degree", sections: ["personal", ""], patterns: ["最高学历", "学历（最高", "highest education"] },
      { path: "identityAndAuthorization.personalIdNumber", sections: ["personal", ""], patterns: ["身份证号码", "身份证号", "证件号码", "identity number", "id card number"] },
      { path: "identityAndAuthorization.politicalStatus", sections: ["personal", ""], patterns: ["政治面貌", "political status"] },
      { path: "contactAndLocation.familyLocation", sections: ["personal", ""], patterns: ["家庭所在地", "家庭地址", "family location", "family residence"] },
      { path: "jobPreferences.expectedCity", sections: ["jobPreference", "personal", ""], patterns: ["意向工作地点", "期望工作地点", "preferred work location"] },
      { path: "derived.highestEducation.weightedAverageScore", sections: ["personal", ""], patterns: ["加权平均分", "加权平均成绩", "weighted average"] },
      { path: "derived.highestEducation.gpa", sections: ["personal", ""], patterns: ["最高学历绩点", "请填写绩点"] },
      { path: "derived.highestEducation.ranking", sections: ["personal", ""], patterns: ["专业排名（%", "专业排名%", "专业排名百分比"] },
      { path: "derived.highestEducation.makeupRetakeCourseCount", sections: ["personal", ""], patterns: ["补考及重修", "补考门数", "重修门数"] },
      { path: "derived.highestEducation.hasDualDegree", sections: ["personal", ""], patterns: ["是否双学位", "双学位"] },
      { path: "derived.highestEducation.isUpgradedFromJuniorCollege", sections: ["personal", ""], patterns: ["是否专升本", "大/中专升本", "专升本"] },
      { path: "derived.englishCertificate.name", sections: ["personal", ""], patterns: ["英语证书名称", "英语等级证书名称", "english certificate"] },
      { path: "derived.englishCertificate.score", sections: ["personal", ""], patterns: ["英语证书分数", "英语成绩", "english score"] },
      { path: "derived.achievementCategories", sections: ["personal", ""], patterns: ["个人荣誉竞赛获奖学术成果", "荣誉竞赛学术成果", "achievement categories"] },
      { path: "applicationDeclarations.relativesAtEmployer", sections: ["", "personal", "work"], patterns: ["是否有亲属在我公司工作", "是否有亲属在应聘单位工作", "亲属在公司工作", "亲属在应聘单位工作", "relatives at company"] },
      { path: "applicationDeclarations.healthRestrictionHistory", sections: ["", "personal"], patterns: ["健康或职业禁忌情况", "传染病史", "重大疾病史", "职业禁忌症", "medical history"] },
      { path: "personal.fullName", sections: ["", "personal"], patterns: ["应聘者签名", "申请人签名", "applicant signature"] },
    ]);

    const GROUP_SCHEMA_KEYS = new Set(["personal", "jobPreferences", "skills"]);

    function normalizeSemanticText(text) {
      return String(text || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[()（）[\]【】{}<>]/g, "")
        .replace(/[.,，/\\\-_:：;+*"'`“”‘’]/g, "");
    }

    function inferSectionFromTexts(texts) {
      const list = Array.isArray(texts) ? texts.filter(Boolean) : [];
      if (list.length === 0) {
        return {
          key: "",
          label: "",
          evidence: "",
          score: 0,
        };
      }

      let best = {
        key: "",
        label: "",
        evidence: "",
        score: 0,
      };
      let secondScore = 0;

      for (const rule of SECTION_RULES) {
        let score = 0;
        const matched = [];

        for (const text of list) {
          const normalizedText = normalizeSemanticText(text);
          if (!normalizedText) continue;

          for (const keyword of rule.keywords) {
            const normalizedKeyword = normalizeSemanticText(keyword);
            if (!normalizedKeyword || !normalizedText.includes(normalizedKeyword)) {
              continue;
            }

            score += normalizedText === normalizedKeyword ? 8 : 4;
            matched.push(keyword);
          }
        }

        if (
          rule.key === "internship" &&
          matched.some((item) => /实习|internship|intern\b/i.test(String(item)))
        ) {
          score += 6;
        }

        if (rule.key === "campus" && matched.some((item) => /学生组织|社团|志愿服务|科研助理/.test(item))) {
          score += 5;
        }

        if (score > best.score) {
          secondScore = best.score;
          best = {
            key: rule.key,
            label: rule.label,
            evidence: Array.from(new Set(matched)).slice(0, 3).join(" / "),
            score,
          };
        } else if (score > secondScore) {
          secondScore = score;
        }
      }

      if (best.score < 4 || (secondScore > 0 && best.score - secondScore <= 4)) {
        return {
          key: "",
          label: "",
          evidence: "",
          score: 0,
        };
      }

      return best;
    }

    function getSchemaSectionKey(sectionKey) {
      return SECTION_SCHEMA_KEYS[String(sectionKey || "").trim()] || "";
    }

    function inferStructuredFieldKey(sectionKey, label, compositeRole = "") {
      if (STRUCTURED_FIELD_RULES[sectionKey]?.some(rule => rule.fieldKey === "startDate")) {
        if (compositeRole === "start") return "startDate";
        if (compositeRole === "end") return "endDate";
      }

      if (sectionKey === "education" && /是否.*最高|是否.*主学习|is\s*(?:hig[he]*st|highest|mainstudy)/i.test(String(label))) return "";

      const normalizedLabel = normalizeSemanticText(label);
      if (!normalizedLabel) return "";

      let best = { fieldKey: "", score: 0 };
      for (const rule of STRUCTURED_FIELD_RULES[sectionKey] || []) {
        for (const pattern of rule.patterns || []) {
          const normalizedPattern = normalizeSemanticText(pattern);
          if (!normalizedPattern || !normalizedLabel.includes(normalizedPattern)) continue;
          const score =
            (normalizedLabel === normalizedPattern ? 1000 : 0) +
            normalizedPattern.length;
          if (score > best.score) {
            best = { fieldKey: rule.fieldKey, score };
          }
        }
      }
      return best.fieldKey;
    }

    function inferUnambiguousStructuredFieldKey(sectionKey, label, compositeRole = "") {
      if (sectionKey === "project" && compositeRole === "start") return "startDate";
      if (sectionKey === "project" && compositeRole === "end") return "endDate";

      const normalizedLabel = normalizeSemanticText(label);
      if (!normalizedLabel) return "";
      const matches = getStructuredFieldKeyMatches(sectionKey, normalizedLabel);
      return matches.size === 1 ? Array.from(matches)[0] : "";
    }

    function getStructuredFieldKeyMatches(sectionKey, label) {
      const normalizedLabel = normalizeSemanticText(label);
      const matches = new Set();
      if (!normalizedLabel) return matches;
      for (const rule of STRUCTURED_FIELD_RULES[sectionKey] || []) {
        if (
          (rule.patterns || []).some((pattern) => {
            const normalizedPattern = normalizeSemanticText(pattern);
            return normalizedPattern && normalizedLabel.includes(normalizedPattern);
          })
        ) {
          matches.add(rule.fieldKey);
        }
      }
      return matches;
    }

    function inferControlConstrainedFieldKey(field, sectionKey) {
      const options = (Array.isArray(field?.options) ? field.options : [])
        .map((value) => normalizeSemanticText(value))
        .filter(Boolean);
      if (
        ["internship", "work", "campus"].includes(sectionKey) &&
        options.some((value) => /^(至今|当前|仍在|present|current|ongoing)$/.test(value))
      ) {
        return "isCurrent";
      }
      return "";
    }

    function inferStructuredFieldKeyFromField(field, sectionKeyOverride = "") {
      const sectionKey = String(sectionKeyOverride || field?.sectionKey || "").trim();
      if (getUnsupportedMappingReason(field)) return "";
      const concept = fieldConcepts?.inferConcept?.(field);
      if (
        concept?.status === "resolved" &&
        concept.fieldKey &&
        (concept.schemaKey === getSchemaSectionKey(sectionKey) || concept.schemaKey === sectionKey)
      ) {
        return concept.fieldKey;
      }
      const constrainedKey = inferControlConstrainedFieldKey(field, sectionKey);
      if (constrainedKey) return constrainedKey;

      // A precise row label outranks implementation identifiers and neighboring fields.
      const primaryLabel = field?.baseLabel || field?.label || "";
      if (primaryLabel) {
        const primaryKey = inferStructuredFieldKey(sectionKey, primaryLabel, field?.compositeRole || "");
        if (primaryKey) return primaryKey;
      }

      const genericContent = /^(内容|评价内容|content)$/.test(normalizeSemanticText(primaryLabel));
      if (genericContent) {
        const evidence = normalizeSemanticText(
          [
            field?.sectionEvidence,
            field?.sectionLabel,
            field?.context,
            ...(Array.isArray(field?.nearbyLabels) ? field.nearbyLabels.slice(0, 2) : []),
          ]
            .filter(Boolean)
            .join(" ")
        );
        if (
          (sectionKey === "personal" || !sectionKey) &&
          /(自我评价|自我评述|selfevaluation|selfassessment)/.test(evidence)
        ) {
          return "selfEvaluation";
        }
      }

      const directText = [
        field?.label,
        field?.baseLabel,
        field?.id,
        field?.name,
        field?.placeholder,
      ]
        .filter(Boolean)
        .join(" ");
      const directMatch = inferStructuredFieldKey(
        sectionKey,
        directText,
        field?.compositeRole || ""
      );
      if (directMatch) return directMatch;

      for (const nearbyLabel of Array.isArray(field?.nearbyLabels)
        ? field.nearbyLabels.slice(0, 1)
        : []) {
        const nearbyMatch = inferStructuredFieldKey(
          sectionKey,
          nearbyLabel,
          field?.compositeRole || ""
        );
        if (nearbyMatch) return nearbyMatch;
      }

      return inferUnambiguousStructuredFieldKey(
        sectionKey,
        field?.context || "",
        field?.compositeRole || ""
      );
    }

    function inferDirectGroupPath(sectionKey, label, compositeRole = "") {
      if (compositeRole === "regionProvince") {
        return "contactAndLocation.hometownProvince";
      }
      if (compositeRole === "regionCity") {
        return "contactAndLocation.hometownCity";
      }

      const normalizedLabel = normalizeSemanticText(label);
      if (!normalizedLabel) return "";
      let best = { path: "", score: 0 };
      for (const rule of DIRECT_GROUP_PATH_RULES) {
        if (Array.isArray(rule.sections) && !rule.sections.includes(sectionKey)) {
          continue;
        }
        for (const pattern of rule.patterns || []) {
          const normalizedPattern = normalizeSemanticText(pattern);
          if (!normalizedPattern || !normalizedLabel.includes(normalizedPattern)) continue;
          const score =
            (normalizedLabel === normalizedPattern ? 1000 : 0) +
            normalizedPattern.length;
          if (score > best.score) {
            best = { path: rule.path, score };
          }
        }
      }
      return best.path;
    }

    function inferConstrainedResumePath(field) {
      const normalize = (value) => normalizeSemanticText(value);
      const directCandidates = [
        field?.label,
        field?.baseLabel,
        field?.id,
        field?.name,
        field?.placeholder,
      ]
        .map(normalize)
        .filter(Boolean);
      const firstNearby = normalize(
        Array.isArray(field?.nearbyLabels) ? field.nearbyLabels[0] : ""
      );
      const optionSet = new Set(
        (Array.isArray(field?.options) ? field.options : [])
          .map(normalize)
          .filter(Boolean)
      );

      const hasExplicitGenderLabel = [...directCandidates, firstNearby].some(
        (candidate) =>
          /^(性别|gender|sex)$/.test(candidate) ||
          /(?:^|[_\-.])(gender|sex)(?:$|[_\-.])/.test(candidate)
      );
      const hasGenderOptionPair =
        (optionSet.has("男") || optionSet.has("male")) &&
        (optionSet.has("女") || optionSet.has("female"));

      if (hasExplicitGenderLabel || hasGenderOptionPair) {
        const schemaSectionKey = getSchemaSectionKey(field?.sectionKey);
        if (schemaSectionKey && schemaSectionKey !== "personal") return "";
        return "personal.gender";
      }
      return "";
    }

    function getUnsupportedMappingReason(field) {
      const directEvidence = [
        field?.label,
        field?.baseLabel,
        field?.id,
        field?.name,
        field?.placeholder,
        ...(Array.isArray(field?.nearbyLabels) ? field.nearbyLabels.slice(0, 1) : []),
      ]
        .map((value) => normalizeSemanticText(value))
        .filter(Boolean)
        .join(" ");
      const choiceLike = ["select", "radio_group", "checkbox_group", "custom_picker"].includes(
        String(field?.kind || "")
      );

      if (field?.sectionKey === "education" &&
          /是否.*最高|是否.*主学习|is(?:hig[he]*st|highest|mainstudy)/i.test(directEvidence)) {
        return "该教育条目的最高/主学习状态尚无经过确认的独立来源，已跳过";
      }

      if (
        choiceLike &&
        /(papergrad|毕业论文是否发表|学位论文是否发表|论文是否发表|是否发表论文)/.test(
          directEvidence
        )
      ) {
        return "标准简历没有与“论文是否发表”完全等价的布尔字段";
      }
      if (
        String(field?.kind || "") === "checkbox_group" &&
        /(没有|无|暂无|不适用).*(实习|工作|项目|教育|获奖|论文|专利).*经历?/.test(
          directEvidence
        )
      ) {
        return "这是页面区块状态开关，不是简历内容字段";
      }
      return "";
    }

    function isResumePathCompatibleWithField(field, resumePath) {
      const path = String(resumePath || "").trim();
      if (!path) return true;
      if (getUnsupportedMappingReason(field)) return false;

      const policy = mappingPolicy?.evaluateRequestedPath?.(field, path);
      if (policy && policy.ok === false) return false;

      const lockedSection = getSchemaSectionKey(field?.sectionKey);
      if (field?.sectionLocked && lockedSection && !GROUP_SCHEMA_KEYS.has(lockedSection)) {
        const match = path.match(/^([A-Za-z]+)\.(\d+)\./);
        if (!match || match[1] !== lockedSection) return false;
        if (Number.isInteger(field.sectionItemIndex) && field.sectionItemIndex >= 0 &&
            Number(match[2]) !== field.sectionItemIndex) return false;
      }

      const constrainedPath = inferConstrainedResumePath(field);
      if (constrainedPath && path !== constrainedPath) return false;

      const sectionKey = String(field?.sectionKey || "").trim();
      const directFieldText = [
        field?.label,
        field?.baseLabel,
        field?.id,
        field?.name,
        field?.placeholder,
      ]
        .filter(Boolean)
        .join(" ");
      const firstNearbyLabel = Array.isArray(field?.nearbyLabels)
        ? field.nearbyLabels[0] || ""
        : "";
      const directGroupPath =
        inferDirectGroupPath(sectionKey, directFieldText, field?.compositeRole || "") ||
        inferDirectGroupPath(sectionKey, firstNearbyLabel, field?.compositeRole || "");
      if (directGroupPath) return path === directGroupPath;

      const inputType = String(field?.inputType || "").toLowerCase();
      if (inputType === "email" && !/email/i.test(path)) return false;
      if (inputType === "tel" && !/(phone|mobile)/i.test(path)) return false;
      if (inputType === "url" && !/(url|link)$/i.test(path)) return false;
      if (
        ["date", "month", "datetime-local"].includes(inputType) &&
        !/(date|time)$/i.test(path)
      ) {
        return false;
      }

      const schemaSectionKey = getSchemaSectionKey(sectionKey);
      const directStructuredKey = inferStructuredFieldKey(
        sectionKey,
        directFieldText,
        field?.compositeRole || ""
      );
      const nearbyStructuredKey = inferStructuredFieldKey(
        sectionKey,
        firstNearbyLabel,
        field?.compositeRole || ""
      );
      if (
        schemaSectionKey &&
        !directStructuredKey &&
        !nearbyStructuredKey &&
        getStructuredFieldKeyMatches(sectionKey, field?.context || "").size > 1
      ) {
        return false;
      }
      const fieldKey = inferStructuredFieldKeyFromField(
        field,
        field?.projectedFromSectionKey || sectionKey
      );
      const options = (field?.options || []).map(normalizeSemanticText);
      const booleanOptions = options.length > 0 && options.every(option => /^(是|否|yes|no|true|false|y|n|0|1)$/.test(option));
      if (booleanOptions && schemaSectionKey && !GROUP_SCHEMA_KEYS.has(schemaSectionKey) &&
          !/^(is[A-Z]|has[A-Z]|employed[A-Z])/.test(fieldKey || "")) return false;
      if (!schemaSectionKey || !fieldKey) {
        const concept = fieldConcepts?.inferConcept?.(field);
        if (concept?.status === "resolved") {
          return fieldConcepts.pathMatchesConcept(path, concept);
        }
        if (fieldConcepts?.hasLanguageDomainEvidence?.(field) && /^skills\./.test(path)) {
          return false;
        }
        return true;
      }

      if (GROUP_SCHEMA_KEYS.has(schemaSectionKey)) {
        return path === `${schemaSectionKey}.${fieldKey}`;
      }
      return path.endsWith(`.${fieldKey}`);
    }

    function resolvePreferredResumePath(field, requestedResumePath, validPaths) {
      const concept = fieldConcepts?.inferConcept?.(field);
      if (concept?.status === "ambiguous") return "";
      if (concept?.status === "resolved" && concept.schemaKey && concept.fieldKey) {
        if (concept.group) {
          const preferredPath = `${concept.schemaKey}.${concept.fieldKey}`;
          if (
            validPaths &&
            typeof validPaths.has === "function" &&
            !validPaths.has(preferredPath)
          ) {
            return "";
          }
          return preferredPath;
        }
        let conceptIndex = Number(field?.sectionItemIndex);
        if (!Number.isInteger(conceptIndex) || conceptIndex < 0) {
          const requestedMatch = String(requestedResumePath || "").match(/^[A-Za-z]+\.(\d+)\./);
          if (
            requestedMatch &&
            fieldConcepts.pathMatchesConcept(requestedResumePath, concept)
          ) {
            conceptIndex = Number(requestedMatch[1]);
          }
        }
        if (!Number.isInteger(conceptIndex) || conceptIndex < 0) {
          const uniqueCandidates = validPaths && typeof validPaths[Symbol.iterator] === "function"
            ? Array.from(validPaths).filter((path) =>
                String(path).startsWith(`${concept.schemaKey}.`) &&
                String(path).endsWith(`.${concept.fieldKey}`)
              )
            : [];
          return uniqueCandidates.length === 1 ? uniqueCandidates[0] : "";
        }
        const preferredConceptPath = `${concept.schemaKey}.${conceptIndex}.${concept.fieldKey}`;
        if (
          validPaths &&
          typeof validPaths.has === "function" &&
          !validPaths.has(preferredConceptPath)
        ) {
          const uniqueCandidates = Array.from(validPaths).filter((path) =>
            String(path).startsWith(`${concept.schemaKey}.`) &&
            String(path).endsWith(`.${concept.fieldKey}`)
          );
          return uniqueCandidates.length === 1 ? uniqueCandidates[0] : "";
        }
        return preferredConceptPath;
      }

      const sectionKey = String(field?.sectionKey || "").trim();
      const schemaSectionKey = getSchemaSectionKey(sectionKey);
      const directFieldText = [
        field?.label,
        field?.baseLabel,
        field?.id,
        field?.name,
        field?.placeholder,
      ]
        .filter(Boolean)
        .join(" ");
      const firstNearbyLabel = Array.isArray(field?.nearbyLabels)
        ? field.nearbyLabels[0] || ""
        : "";
      const constrainedPath = inferConstrainedResumePath(field);
      if (
        constrainedPath &&
        (!validPaths || typeof validPaths.has !== "function" || validPaths.has(constrainedPath))
      ) {
        return constrainedPath;
      }

      const directGroupPath =
        inferDirectGroupPath(sectionKey, directFieldText, field?.compositeRole || "") ||
        inferDirectGroupPath(sectionKey, firstNearbyLabel, field?.compositeRole || "");
      if (
        directGroupPath &&
        (!validPaths || typeof validPaths.has !== "function" || validPaths.has(directGroupPath))
      ) {
        return directGroupPath;
      }
      const fieldKey = inferStructuredFieldKeyFromField(
        field,
        field?.projectedFromSectionKey || sectionKey
      );
      if (!schemaSectionKey || !fieldKey) return "";

      if (GROUP_SCHEMA_KEYS.has(schemaSectionKey)) {
        const preferredPath = `${schemaSectionKey}.${fieldKey}`;
        if (
          validPaths &&
          typeof validPaths.has === "function" &&
          !validPaths.has(preferredPath)
        ) {
          return "";
        }
        return preferredPath;
      }

      let itemIndex = Number(field?.sectionItemIndex);
      if (!Number.isInteger(itemIndex) || itemIndex < 0) {
        const requestedMatch = String(requestedResumePath || "").match(
          /^[A-Za-z]+\.(\d+)\./
        );
        itemIndex = requestedMatch ? Number(requestedMatch[1]) : -1;
      }
      if (!Number.isInteger(itemIndex) || itemIndex < 0) {
        const uniqueCandidates = validPaths && typeof validPaths[Symbol.iterator] === "function"
          ? Array.from(validPaths).filter((path) =>
              String(path).startsWith(`${schemaSectionKey}.`) &&
              String(path).endsWith(`.${fieldKey}`)
            )
          : [];
        if (uniqueCandidates.length === 1) return uniqueCandidates[0];
        return "";
      }

      const preferredPath = `${schemaSectionKey}.${itemIndex}.${fieldKey}`;
      if (
        validPaths &&
        typeof validPaths.has === "function" &&
        !validPaths.has(preferredPath)
      ) {
        return "";
      }
      return preferredPath;
    }

    function alignResumePathToFieldSection(resumePath, sectionKey, validPaths) {
      const path = String(resumePath || "").trim();
      if (!path || sectionKey !== "internship") return path;

      const match = path.match(/^workExperiences\.(\d+)\.(.+)$/);
      if (!match) return path;
      const internshipPath = `internships.${match[1]}.${match[2]}`;
      if (validPaths && typeof validPaths.has === "function" && !validPaths.has(internshipPath)) {
        return "";
      }
      return internshipPath;
    }

    function buildWorkOnlyExperienceProjection(fields, profile) {
      const pageSections = new Set(
        (Array.isArray(fields) ? fields : [])
          .map((field) => String(field?.sectionKey || "").trim())
          .filter(Boolean)
      );
      if (!pageSections.has("work") || pageSections.has("internship")) return [];

      const entries = [];
      for (const sectionKey of ["workExperiences", "internships"]) {
        const items = Array.isArray(profile?.[sectionKey]) ? profile[sectionKey] : [];
        items.forEach((item, itemIndex) => {
          if (!isMeaningfulResumeItem(item)) return;
          entries.push({
            sectionKey,
            itemIndex,
            sortDate: String(item?.endDate || item?.startDate || ""),
          });
        });
      }

      return entries.sort((left, right) =>
        right.sortDate.localeCompare(left.sortDate) ||
        left.sectionKey.localeCompare(right.sectionKey) ||
        left.itemIndex - right.itemIndex
      );
    }

    function isMeaningfulResumeItem(item) {
      if (!item || typeof item !== "object") return Boolean(String(item || "").trim());
      return Object.values(item).some((value) => {
        if (Array.isArray(value)) {
          return value.some((entry) => Boolean(String(entry || "").trim()));
        }
        return Boolean(String(value || "").trim());
      });
    }

    function projectWorkFieldToExperienceSource(field, projection) {
      if (String(field?.sectionKey || "") !== "work" || !Array.isArray(projection)) {
        return field;
      }
      let pageItemIndex = Number(field?.sectionItemIndex);
      if ((!Number.isInteger(pageItemIndex) || pageItemIndex < 0) && projection.length === 1) {
        pageItemIndex = 0;
      }
      const source = projection[pageItemIndex];
      if (!source) return field;
      return {
        ...field,
        sectionKey: source.sectionKey === "internships" ? "internship" : "work",
        sectionItemIndex: source.itemIndex,
        projectedFromSectionKey: "work",
      };
    }

    return {
      inferSectionFromTexts,
      normalizeSemanticText,
      getSchemaSectionKey,
      inferConcept: (field) => fieldConcepts?.inferConcept?.(field) || null,
      inferStructuredFieldKey,
      inferStructuredFieldKeyFromField,
      inferConstrainedResumePath,
      getUnsupportedMappingReason,
      isResumePathCompatibleWithField,
      resolvePreferredResumePath,
      alignResumePathToFieldSection,
      buildWorkOnlyExperienceProjection,
      projectWorkFieldToExperienceSource,
    };
  }
);
