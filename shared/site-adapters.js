(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.ResumeSiteAdapters = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const COMMON_REPEAT_RULES = [
    {
      sectionKey: "educations",
      sectionTexts: ["教育经历", "教育背景", "Education"],
      triggerTexts: ["新增教育经历", "添加教育经历", "新增教育背景", "Add education", "Add another education"],
      rowLabels: ["学校名称", "学校", "School", "Institution"],
    },
    {
      sectionKey: "internships",
      sectionTexts: [
        "实习经历",
        "实习经验",
        "实践活动",
        "社会实践",
        "Internship experience",
        "Internships",
        "Practical experience",
      ],
      triggerTexts: ["新增实习经历", "添加实习经历", "Add internship", "Add another internship"],
      rowLabels: ["公司名称", "实习公司", "Company", "Employer"],
    },
    {
      sectionKey: "workExperiences",
      sectionTexts: ["工作经历", "工作经验", "Employment history", "Work experience"],
      triggerTexts: ["新增工作经历", "添加工作经历", "Add work experience", "Add employment", "Add another position"],
      rowLabels: ["公司名称", "单位名称", "Company", "Employer"],
    },
    {
      sectionKey: "projects",
      sectionTexts: ["项目经历", "项目经验", "Projects", "Project experience"],
      triggerTexts: ["新增项目经验", "新增项目经历", "添加项目经历", "Add project", "Add another project"],
      rowLabels: ["项目名称", "Project name", "Project title"],
    },
    {
      sectionKey: "awards",
      sectionTexts: [
        "获奖经历",
        "获奖记录",
        "奖项荣誉",
        "奖励荣誉",
        "竞赛情况",
        "荣誉奖励",
        "Awards",
        "Honors",
      ],
      triggerTexts: ["新增获奖记录", "新增获奖经历", "添加获奖记录", "添加获奖经历", "Add award", "Add another award"],
      rowLabels: ["奖项名称", "获奖名称", "荣誉名称", "Award name", "Award title", "Honor name"],
    },
    {
      sectionKey: "patents",
      sectionTexts: ["发明专利", "专利", "Patents"],
      triggerTexts: ["新增专利", "添加专利", "Add patent", "Add another patent"],
      rowLabels: ["专利名称", "Patent name", "Patent title"],
    },
    {
      sectionKey: "publications",
      sectionTexts: ["论文发表", "论文", "Publications"],
      triggerTexts: ["新增论文", "添加论文", "新增发表论文", "Add publication", "Add paper", "Add another publication"],
      rowLabels: ["论文名称", "Publication title", "Paper title"],
    },
    {
      sectionKey: "languages",
      sectionTexts: ["语言能力", "外语能力", "语言", "Languages"],
      triggerTexts: ["新增语言能力", "新增语言", "添加语言能力", "Add language", "Add another language"],
      rowLabels: ["语言名称", "外语类型", "Language"],
    },
    {
      sectionKey: "campusExperiences",
      sectionTexts: ["校园经历", "校园活动", "在校职务", "Campus experience"],
      triggerTexts: ["新增校园经历", "添加校园经历", "Add activity", "Add campus experience"],
      rowLabels: ["组织名称", "社团名称", "Organization"],
    },
    {
      sectionKey: "familyMembers",
      sectionTexts: ["亲属信息", "家庭成员", "家属信息", "Family members"],
      triggerTexts: ["新增亲属", "添加亲属", "新增家庭成员", "添加家庭成员", "Add family member", "Add relative"],
      rowLabels: ["亲属姓名", "成员姓名", "Relative name", "Family member name"],
    },
  ];

  const DEFAULT_OPTION_SELECTORS = [
    "[role='option']",
    "[role='treeitem']",
    "[class*='select'][class*='option']",
    "[class*='Select'][class*='option']",
    "[class*='picker'][class*='option']",
    "[class*='Picker'][class*='option']",
    "[class*='cascader'][class*='node']",
    "[class*='Cascader'][class*='node']",
  ];

  const COMMON_REPEAT_ITEM_SELECTORS = [
    "[data-resume-item]",
    "[data-item-index]",
    "[data-row-index]",
    "[class*='resume-item']",
    "[class*='experience-item']",
    "[class*='education-item']",
    "[class*='project-item']",
    "[class*='award-item']",
    "[class*='patent-item']",
    "[class*='publication-item']",
    "[class*='paper-item']",
    "[class*='form-list-item']",
    "[class*='form-item-group']",
    "[class*='form_item_group']",
    "[class*='box-form']",
    "fieldset",
    "[role='group']",
  ];

  const MIDEA_SECTION_TEXTS = {
    educations: ["教育经历"],
    internships: ["实习经历"],
    workExperiences: ["工作经历"],
    projects: ["项目经验", "项目经历"],
    awards: ["获奖记录", "获奖经历"],
    patents: ["专利"],
    publications: ["论文"],
    languages: ["语言能力"],
    campusExperiences: ["校园经历"],
    familyMembers: ["亲属信息", "家庭成员"],
  };

  const MIDEA_EXTRA_TRIGGER_TEXTS = {
    patents: ["新增发明专利"],
  };

  const MIDEA_ADAPTER = {
    id: "midea-school-resume",
    matches(locationLike) {
      const hostname = String(locationLike?.hostname || "").toLowerCase();
      const pathname = String(locationLike?.pathname || "");
      return hostname === "careers.midea.com" && pathname.startsWith("/schoolOut/resume");
    },
    repeatRules: COMMON_REPEAT_RULES.map((rule) => ({
      ...rule,
      triggerTexts: ["新增", ...rule.triggerTexts, ...(MIDEA_EXTRA_TRIGGER_TEXTS[rule.sectionKey] || [])],
      sectionTexts: MIDEA_SECTION_TEXTS[rule.sectionKey] || [],
    })),
    repeatTriggerSelector:
      "button,[role='button'],a,[class*='action_button'],[class*='action-button'],[class*='add']",
    repeatSectionSelector:
      ".ihr_recruit_resume-block,section,fieldset,[class*='resume-block'],[class*='section']",
    repeatSectionTitleSelector:
      ".ihr_recruit_resume_title,[class*='resume_title'],[class*='resume-title'],h1,h2,h3,h4,legend",
    requireRepeatSectionTitle: true,
    repeatItemSelector: ".md-row.box-form",
    customPickerInputSelector: ".ihr_base_picker-search_input",
    customPickerRootSelector:
      ".ihr_base_picker:not(input),[class*='base_picker']:not(input),[class*='base-picker']:not(input),[class*='cascader']:not(input),[class*='select']:not(input)",
    optionSelectors: [
      ".ihr_picker_menu-item",
      ".ihr_base_picker-option",
      ".ihr_base_picker-item",
      "[class*='base_picker'][class*='item']",
      "[class*='base-picker'][class*='item']",
      ...DEFAULT_OPTION_SELECTORS,
    ],
  };

  const BEISEN_ADAPTER = {
    id: "beisen-zhiye-form",
    matches(locationLike) {
      const hostname = String(locationLike?.hostname || "").toLowerCase();
      return (
        hostname === "zhiye.com" ||
        hostname.endsWith(".zhiye.com") ||
        hostname === "italent.cn" ||
        hostname.endsWith(".italent.cn")
      );
    },
    repeatRules: COMMON_REPEAT_RULES,
    repeatTriggerSelector:
      "button:not([type='submit']),[role='button'],a,div[class],span[class]",
    customPickerInputSelector: ".phoenix-select__input",
    customPickerRootSelector: ".phoenix-select",
    selectedValueSelector: ".phoenix-select__content",
    optionSelectors: [
      ".phoenix-selectList__listItem",
      ".phoenix-select-option",
      ".phoenix-select__option",
      ".phoenix-dropdown__item",
      ".phoenix-cascader__item",
      ...DEFAULT_OPTION_SELECTORS,
    ],
  };

  function getActiveAdapter(locationLike) {
    if (MIDEA_ADAPTER.matches(locationLike)) return MIDEA_ADAPTER;
    if (BEISEN_ADAPTER.matches(locationLike)) return BEISEN_ADAPTER;
    return null;
  }

  function getRepeatRules(locationLike) {
    return getActiveAdapter(locationLike)?.repeatRules || COMMON_REPEAT_RULES;
  }

  return {
    COMMON_REPEAT_RULES,
    COMMON_REPEAT_ITEM_SELECTORS,
    DEFAULT_OPTION_SELECTORS,
    getActiveAdapter,
    getRepeatRules,
  };
});
