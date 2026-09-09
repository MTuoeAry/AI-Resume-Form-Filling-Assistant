(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ResumeFieldConcepts = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SEMANTIC_RULE_VERSION = 1;

  const CONCEPT_DEFS = Object.freeze({
    "language.name": { domain: "language", schemaKey: "languages", fieldKey: "name", group: false },
    "language.proficiency": { domain: "language", schemaKey: "languages", fieldKey: "proficiency", group: false },
    "language.examType": { domain: "language", schemaKey: "languages", fieldKey: "examType", group: false },
    "language.examLevel": { domain: "language", schemaKey: "languages", fieldKey: "examLevel", group: false },
    "language.scoreValue": { domain: "language", schemaKey: "languages", fieldKey: "scoreValue", group: false },
    "language.scoreScale": { domain: "language", schemaKey: "languages", fieldKey: "scoreScale", group: false },
    "language.testScore": { domain: "language", schemaKey: "languages", fieldKey: "testScore", group: false },
    "language.cefrLevel": { domain: "language", schemaKey: "languages", fieldKey: "cefrLevel", group: false },
    "skill.programmingLanguages": { domain: "skill", schemaKey: "skills", fieldKey: "programmingLanguages", group: true },
    "award.name": { domain: "award", schemaKey: "awards", fieldKey: "name", group: false },
    "award.date": { domain: "award", schemaKey: "awards", fieldKey: "date", group: false },
  });

  const LANGUAGE_LEVEL_FIELD_KEYS = Object.freeze(["proficiency", "examLevel", "cefrLevel"]);

  const PROFICIENCY_OPTIONS = Object.freeze([
    "基础", "熟练", "精通", "母语", "流利", "工作熟练", "中等",
    "basic", "fluent", "native", "proficient", "intermediate", "working proficiency",
  ]);
  const EXAM_LEVEL_OPTIONS = Object.freeze([
    "四级", "六级", "专四", "专八", "cet4", "cet6", "cet-4", "cet-6", "tem4", "tem8",
    "大学英语四级", "大学英语六级",
  ]);
  const CEFR_OPTIONS = Object.freeze(["a1", "a2", "b1", "b2", "c1", "c2"]);

  function normalize(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[()（）[\]【】{}<>]/g, "")
      .replace(/[.,，/\\\-_:：;+*"'`“”‘’]/g, "");
  }

  function fieldLabelText(field) {
    return normalize(
      [field?.label, field?.baseLabel].filter(Boolean).join(" ")
    );
  }

  function optionTexts(field) {
    return (Array.isArray(field?.options) ? field.options : [])
      .map((value) => normalize(value))
      .filter(Boolean);
  }

  function includesAny(text, patterns) {
    return patterns.some((pattern) => text.includes(normalize(pattern)));
  }

  function optionsHit(options, catalog) {
    const normalizedCatalog = catalog.map(normalize);
    return options.filter((option) =>
      normalizedCatalog.some((item) => option === item || option.includes(item) || item.includes(option))
    ).length;
  }

  function classifyOptionDomain(field) {
    const options = optionTexts(field);
    if (options.length === 0) {
      const state = String(field?.optionState || "").trim();
      if (state === "loading") return { domain: "", mixed: false, state: "loading" };
      if (state === "empty") return { domain: "", mixed: false, state: "empty" };
      if (state === "unavailable") return { domain: "", mixed: false, state: "unavailable" };
      return { domain: "", mixed: false, state: "not_requested" };
    }
    const proficiency = optionsHit(options, PROFICIENCY_OPTIONS);
    const examLevel = optionsHit(options, EXAM_LEVEL_OPTIONS);
    const cefr = optionsHit(options, CEFR_OPTIONS);
    const hits = [
      proficiency > 0 ? "proficiency" : "",
      examLevel > 0 ? "examLevel" : "",
      cefr > 0 ? "cefr" : "",
    ].filter(Boolean);
    if (hits.length > 1) return { domain: "", mixed: true, state: "ready" };
    if (hits.length === 1) return { domain: hits[0], mixed: false, state: "ready" };
    return { domain: "", mixed: false, state: "ready" };
  }

  function isProgrammingLanguageLabel(text) {
    return includesAny(text, ["编程语言", "开发语言", "programminglanguages", "programming language"]);
  }

  function isSpokenLanguageLabel(text) {
    if (isProgrammingLanguageLabel(text)) return false;
    if (/语言$/.test(text) && !includesAny(text, ["成绩", "考试", "编程", "开发"])) return true;
    return includesAny(text, [
      "外语能力类型", "外语类型", "外语种类", "语种", "语言名称", "语言类型",
      "languagetype", "language name", "外语",
    ]);
  }

  function isGenericLanguageWordOnly(text) {
    return /^(语言|language)$/.test(text);
  }

  function getConceptById(id, evidenceCodes = []) {
    const def = CONCEPT_DEFS[String(id || "").trim()];
    if (!def) return null;
    return resolved(id, def.domain, def.schemaKey, def.fieldKey, def.group, evidenceCodes);
  }

  function inferConcept(field) {
    const remembered = getConceptById(field?.rememberedConceptId, ["user_memory"]);
    if (remembered) return remembered;

    const text = fieldLabelText(field);
    const nearby = normalize(Array.isArray(field?.nearbyLabels) ? field.nearbyLabels[0] : "");
    const combined = `${text} ${nearby}`.trim();
    const options = classifyOptionDomain(field);

    if (isProgrammingLanguageLabel(combined)) {
      return resolved("skill.programmingLanguages", "skill", "skills", "programmingLanguages", true, ["exact_alias"]);
    }

    if (includesAny(combined, ["编程", "开发语言"]) && includesAny(combined, ["语言"])) {
      return resolved("skill.programmingLanguages", "skill", "skills", "programmingLanguages", true, ["exact_alias"]);
    }

    if (includesAny(combined, ["英语考试类型", "外语证书类型", "语言考试名称", "考试类型"])) {
      return resolved("language.examType", "language", "languages", "examType", false, ["exact_alias"]);
    }

    if (includesAny(combined, ["考试得分", "语言考试分数", "外语成绩"])) {
      return resolved("language.scoreValue", "language", "languages", "scoreValue", false, ["exact_alias"]);
    }

    if (includesAny(combined, ["语言成绩", "证书成绩", "testscore"])) {
      return resolved("language.testScore", "language", "languages", "testScore", false, ["exact_alias"]);
    }

    if (isSpokenLanguageLabel(text) || isSpokenLanguageLabel(combined) || isGenericLanguageWordOnly(text)) {
      if (isProgrammingLanguageLabel(nearby) || isProgrammingLanguageLabel(combined)) {
        return resolved("skill.programmingLanguages", "skill", "skills", "programmingLanguages", true, ["nearby_alias"]);
      }
      return resolved("language.name", "language", "languages", "name", false, ["exact_alias"]);
    }

    if (includesAny(combined, ["cefr", "欧洲语言等级", "cefr等级"])) {
      return resolved("language.cefrLevel", "language", "languages", "cefrLevel", false, ["exact_alias"]);
    }

    if (/分制$/.test(text) && !includesAny(text, ["百分制"])) {
      return resolved("language.scoreScale", "language", "languages", "scoreScale", false, ["exact_alias"]);
    }

    if (includesAny(combined, ["考试等级"]) && !includesAny(combined, ["英语能力", "能力等级"])) {
      return resolved("language.examLevel", "language", "languages", "examLevel", false, ["exact_alias"]);
    }

    if (includesAny(combined, ["英语能力等级", "能力等级"])) {
      if (options.mixed) {
        return ambiguous("language.level", "language", ["concept_ambiguous"]);
      }
      if (options.domain === "proficiency") {
        return resolved("language.proficiency", "language", "languages", "proficiency", false, ["option_domain"]);
      }
      if (options.domain === "examLevel") {
        return resolved("language.examLevel", "language", "languages", "examLevel", false, ["option_domain"]);
      }
      if (options.domain === "cefr") {
        return resolved("language.cefrLevel", "language", "languages", "cefrLevel", false, ["option_domain"]);
      }
      if (options.state === "loading") {
        return ambiguous("language.level", "language", ["options_loading"]);
      }
      if (options.state === "empty") {
        return ambiguous("language.level", "language", ["options_empty"]);
      }
      if (options.state === "unavailable") {
        return ambiguous("language.level", "language", ["options_unavailable"]);
      }
      return ambiguous("language.level", "language", ["concept_ambiguous"]);
    }

    if (includesAny(combined, ["掌握程度", "熟练程度", "languageproficiency"])) {
      return resolved("language.proficiency", "language", "languages", "proficiency", false, ["exact_alias"]);
    }

    if (includesAny(combined, ["奖项名称", "获奖名称"])) {
      return resolved("award.name", "award", "awards", "name", false, ["exact_alias"]);
    }
    if (includesAny(combined, ["获奖时间", "颁奖日期", "awarddate"])) {
      return resolved("award.date", "award", "awards", "date", false, ["exact_alias"]);
    }

    return null;
  }

  function resolved(id, domain, schemaKey, fieldKey, group, evidenceCodes) {
    return {
      id,
      domain,
      schemaKey,
      fieldKey,
      group: Boolean(group),
      status: "resolved",
      evidenceCodes: evidenceCodes || [],
      rejectionCodes: [],
    };
  }

  function ambiguous(id, domain, rejectionCodes) {
    return {
      id,
      domain,
      schemaKey: "",
      fieldKey: "",
      group: false,
      status: "ambiguous",
      evidenceCodes: [],
      rejectionCodes: rejectionCodes || ["concept_ambiguous"],
    };
  }

  function hasLanguageDomainEvidence(field) {
    const text = `${fieldLabelText(field)} ${normalize(Array.isArray(field?.nearbyLabels) ? field.nearbyLabels[0] : "")}`;
    if (isProgrammingLanguageLabel(text)) return false;
    return includesAny(text, ["外语", "语种", "语言能力", "languagetype", "languageproficiency", "英语能力"]);
  }

  function pathMatchesConcept(path, concept) {
    const value = String(path || "").trim();
    if (!value || !concept || concept.status !== "resolved") return false;
    if (concept.group) return value === `${concept.schemaKey}.${concept.fieldKey}`;
    return new RegExp(`^${concept.schemaKey}\\.\\d+\\.${concept.fieldKey}$`).test(value);
  }

  function candidatePathPrefix(concept) {
    if (!concept || concept.status !== "resolved") return "";
    if (concept.group) return `${concept.schemaKey}.${concept.fieldKey}`;
    return `${concept.schemaKey}.`;
  }

  return {
    SEMANTIC_RULE_VERSION,
    LANGUAGE_LEVEL_FIELD_KEYS,
    inferConcept,
    getConceptById,
    classifyOptionDomain,
    hasLanguageDomainEvidence,
    isProgrammingLanguageLabel,
    pathMatchesConcept,
    candidatePathPrefix,
    normalizeConceptText: normalize,
  };
});
