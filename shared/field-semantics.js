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
        key: "award",
        label: "获奖经历",
        keywords: [
          "获奖经历",
          "获奖记录",
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

    const SECTION_SCHEMA_KEYS = Object.freeze({
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
    });

    const STRUCTURED_FIELD_RULES = Object.freeze({
      project: [
        { fieldKey: "name", patterns: ["项目名称", "project name", "project title"] },
        { fieldKey: "startDate", patterns: ["开始时间", "开始日期", "start date", "startdate"] },
        { fieldKey: "endDate", patterns: ["结束时间", "结束日期", "end date", "enddate"] },
        { fieldKey: "role", patterns: ["项目职责", "项目角色", "本人职责", "本人角色", "project responsibilities", "project responsibility", "project role", "projectrole", "project duty", "projectduty"] },
        { fieldKey: "description", patterns: ["项目描述", "项目说明", "project description", "projectdescription"] },
        { fieldKey: "highlights", patterns: ["项目成果", "项目亮点", "project outcomes", "project achievements", "project highlights"] },
      ],
      award: [
        { fieldKey: "date", patterns: ["获奖时间", "获奖日期", "award date", "award time", "awarddate", "awardtime", "date awarded"] },
        { fieldKey: "name", patterns: ["奖项名称", "获奖名称", "荣誉名称", "award name", "award title", "honor name"] },
        { fieldKey: "type", patterns: ["奖项类型", "award type"] },
        { fieldKey: "level", patterns: ["奖项级别", "award level"] },
        { fieldKey: "rank", patterns: ["奖项等级", "获奖名次", "award rank", "award grade"] },
        { fieldKey: "issuer", patterns: ["颁发机构", "授予单位", "issuing organization", "issuer"] },
        { fieldKey: "details", patterns: ["奖项详情", "获奖详情", "award details", "award description"] },
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
    });

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
          best = {
            key: rule.key,
            label: rule.label,
            evidence: Array.from(new Set(matched)).slice(0, 3).join(" / "),
            score,
          };
        }
      }

      if (best.score < 4) {
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
      if (sectionKey === "project" && compositeRole === "start") return "startDate";
      if (sectionKey === "project" && compositeRole === "end") return "endDate";

      const normalizedLabel = normalizeSemanticText(label);
      if (!normalizedLabel) return "";

      for (const rule of STRUCTURED_FIELD_RULES[sectionKey] || []) {
        if (
          rule.patterns.some((pattern) =>
            normalizedLabel.includes(normalizeSemanticText(pattern))
          )
        ) {
          return rule.fieldKey;
        }
      }
      return "";
    }

    function resolvePreferredResumePath(field, requestedResumePath, validPaths) {
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
      const surroundingFieldText = [
        field?.context,
        ...(Array.isArray(field?.nearbyLabels) ? field.nearbyLabels : []),
      ]
        .filter(Boolean)
        .join(" ");
      const fieldKey = inferStructuredFieldKey(
        sectionKey,
        directFieldText,
        field?.compositeRole || ""
      ) || inferStructuredFieldKey(
        sectionKey,
        surroundingFieldText,
        field?.compositeRole || ""
      );
      if (!schemaSectionKey || !fieldKey) return "";

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

    return {
      inferSectionFromTexts,
      normalizeSemanticText,
      getSchemaSectionKey,
      inferStructuredFieldKey,
      resolvePreferredResumePath,
      alignResumePathToFieldSection,
    };
  }
);
