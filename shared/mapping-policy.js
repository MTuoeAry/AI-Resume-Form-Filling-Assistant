(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ResumeMappingPolicy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function loadConcepts() {
    if (typeof require === "function") {
      try {
        return require("./field-concepts");
      } catch (_) {
        /* Browser content scripts load the file separately. */
      }
    }
    return (typeof globalThis !== "undefined" && globalThis.ResumeFieldConcepts) || null;
  }

  const REJECTION_CODES = Object.freeze([
    "label_missing",
    "evidence_conflict",
    "concept_ambiguous",
    "source_missing",
    "record_ambiguous",
    "options_loading",
    "options_empty",
    "options_unavailable",
    "incompatible_domain",
    "value_incompatible",
    "target_stale",
    "write_unverified",
    "preserved",
    "canceled",
  ]);

  function evaluateRequestedPath(field, resumePath) {
    const concepts = loadConcepts();
    const path = String(resumePath || "").trim();
    if (!path) {
      return { ok: true, code: "", concept: concepts?.inferConcept?.(field) || null };
    }
    const concept = concepts?.inferConcept?.(field) || null;
    if (concepts?.hasLanguageDomainEvidence?.(field) && /^skills\./.test(path)) {
      return { ok: false, code: "incompatible_domain", concept };
    }
    if (concept?.id === "skill.programmingLanguages" && /^languages\./.test(path)) {
      return { ok: false, code: "incompatible_domain", concept };
    }
    if (concept?.status === "ambiguous") {
      if (
        concept.id === "language.level" &&
        /^languages\.\d+\.(proficiency|examLevel|cefrLevel)$/.test(path)
      ) {
        return { ok: true, code: "", concept };
      }
      return { ok: false, code: concept.rejectionCodes[0] || "concept_ambiguous", concept };
    }
    if (concept?.status === "resolved" && !concepts.pathMatchesConcept(path, concept)) {
      return { ok: false, code: "incompatible_domain", concept };
    }
    return { ok: true, code: "", concept };
  }

  function candidateResumePaths(field, catalogPaths) {
    const concepts = loadConcepts();
    const concept = concepts?.inferConcept?.(field);
    const paths = Array.isArray(catalogPaths) ? catalogPaths : [];
    if (concept?.status === "ambiguous" && concept.id === "language.level") {
      const keys = concepts.LANGUAGE_LEVEL_FIELD_KEYS || ["proficiency", "examLevel", "cefrLevel"];
      let itemIndex = Number(field?.sectionItemIndex);
      if (!Number.isInteger(itemIndex) || itemIndex < 0) {
        return paths.filter((path) =>
          keys.some((key) => String(path).startsWith("languages.") && String(path).endsWith(`.${key}`))
        );
      }
      return keys
        .map((key) => `languages.${itemIndex}.${key}`)
        .filter((path) => paths.includes(path));
    }
    if (!concept || concept.status !== "resolved") return [];
    if (concept.group) {
      const exact = `${concept.schemaKey}.${concept.fieldKey}`;
      return paths.filter((path) => path === exact);
    }
    const suffix = `.${concept.fieldKey}`;
    let itemIndex = Number(field?.sectionItemIndex);
    if (Number.isInteger(itemIndex) && itemIndex >= 0) {
      const exact = `${concept.schemaKey}.${itemIndex}.${concept.fieldKey}`;
      return paths.filter((path) => path === exact);
    }
    return paths.filter((path) => String(path).startsWith(`${concept.schemaKey}.`) && String(path).endsWith(suffix));
  }

  function applyMemoryToField(field, memories, query) {
    const next = field && typeof field === "object" ? field : {};
    const match = (Array.isArray(memories) ? memories : []).find((entry) =>
      memoryMatches(entry, query) &&
      Number(entry?.ruleVersion || 0) === Number(query?.ruleVersion || 0)
    );
    if (!match?.conceptId) return next;
    next.rememberedConceptId = String(match.conceptId);
    return next;
  }

  function reasonText(code) {
    const messages = {
      label_missing: "缺少可靠字段标签",
      evidence_conflict: "标签或区块证据冲突",
      concept_ambiguous: "字段含义不唯一，已跳过自动写入",
      source_missing: "标准简历没有对应值",
      record_ambiguous: "无法唯一确定来源记录",
      options_loading: "选项尚未加载，不能确认选中",
      options_empty: "确认没有可选项",
      options_unavailable: "无法读取选项",
      incompatible_domain: "来源字段与页面语义不兼容",
      value_incompatible: "值类型或精度不兼容",
      target_stale: "目标控件已失效",
      write_unverified: "写入后未能验证",
      preserved: "已保留页面原值",
      canceled: "已取消后续写入",
    };
    return messages[code] || "";
  }

  function memoryFingerprint({ origin = "", templateKey = "", label = "", optionDomain = "" } = {}) {
    return [origin, templateKey, label, optionDomain].map((value) => String(value || "").trim()).join("|");
  }

  function memoryMatches(entry, query) {
    if (!entry || !query) return false;
    return memoryFingerprint(entry) === memoryFingerprint(query);
  }

  return {
    REJECTION_CODES,
    evaluateRequestedPath,
    candidateResumePaths,
    applyMemoryToField,
    reasonText,
    memoryFingerprint,
    memoryMatches,
  };
});
