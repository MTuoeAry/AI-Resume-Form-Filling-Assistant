(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ResumeRepeatAlignment = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const INCREMENTAL_REPEAT_ANCHOR_KEYS = Object.freeze({
    education: { primary: ["school"], secondary: ["major", "startDate", "endDate"] },
    internship: { primary: ["company"], secondary: ["title", "startDate", "endDate"] },
    work: { primary: ["company"], secondary: ["title", "startDate", "endDate"] },
    project: { primary: ["name"], secondary: ["role", "startDate", "endDate"] },
    campus: { primary: ["organization"], secondary: ["role", "startDate", "endDate"] },
    certificate: { primary: ["name"], secondary: ["credentialId"] },
    language: { primary: ["name"], secondary: [] },
    award: { primary: ["name"], secondary: ["date"] },
    patent: { primary: ["name"], secondary: ["number"] },
    publication: { primary: ["title"], secondary: ["venue", "date"] },
    family: { primary: ["name"], secondary: ["relationship", "phone"] },
  });

  const REPEAT_SECTIONS = new Set([
    "education", "internship", "work", "project", "campus",
    "certificate", "language", "award", "patent", "publication", "family",
  ]);

  const SECTION_IDENTIFIER_TOKENS = Object.freeze({
    educations: ["education", "school"],
    internships: ["internship", "intern"],
    workExperiences: ["workexperience", "employment"],
    projects: ["project"],
    awards: ["award", "honor"],
    patents: ["patent"],
    publications: ["publication", "paper"],
    languages: ["language"],
    campusExperiences: ["campusexperience", "campusactivity"],
    familyMembers: ["familymember", "relative"],
  });

  function normalizeRepeatAnchor(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[()（）[\]【】{}<>《》.,，。/\\\-_:：;+*"'`“”‘’]/g, "");
  }

  function normalizeLabelToken(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[＊*]/g, "")
      .trim();
  }

  function getRuntimeComparableValue(runtime, pageStructure) {
    if (!runtime) return "";
    if (pageStructure?.isPromptValue?.(runtime.el) &&
        ["text", "textarea"].includes(runtime.kind)) return "";
    if (runtime.kind === "contenteditable") {
      return normalizeRepeatAnchor(runtime.el?.textContent || "");
    }
    if (runtime.kind === "select") {
      const optionText = runtime.el?.options?.[runtime.el.selectedIndex]?.textContent || "";
      return normalizeRepeatAnchor(optionText || runtime.el?.value || "");
    }
    if (runtime.kind === "custom_picker") {
      if (runtime.structuralPicker && pageStructure?.readPicker) {
        return normalizeRepeatAnchor(pageStructure.readPicker(runtime.structuralPicker));
      }
      return normalizeRepeatAnchor(
        runtime.el?.value ||
          runtime.pickerRoot?.getAttribute?.("data-value") ||
          runtime.pickerRoot?.getAttribute?.("aria-valuetext") ||
          ""
      );
    }
    if (["radio_group", "checkbox_group", "file"].includes(runtime.kind)) return "";
    return normalizeRepeatAnchor(runtime.el?.value || "");
  }

  function getProfileRepeatEntries(profile, semanticSectionKey, fieldSemantics) {
    const schemaSectionKey = fieldSemantics?.getSchemaSectionKey?.(semanticSectionKey);
    const spec = INCREMENTAL_REPEAT_ANCHOR_KEYS[semanticSectionKey] || { primary: [], secondary: [] };
    const items = Array.isArray(profile?.[schemaSectionKey])
      ? profile[schemaSectionKey]
      : [];
    return items
      .map((item, sourceIndex) => {
        const primary = spec.primary
          .map((key) => normalizeRepeatAnchor(item?.[key]))
          .filter((value) => value.length >= 2);
        const secondary = spec.secondary
          .map((key) => normalizeRepeatAnchor(item?.[key]))
          .filter((value) => value.length >= 2);
        return {
          sourceIndex,
          primary,
          secondary,
          anchors: [...primary, ...secondary],
        };
      })
      .filter((entry) => entry.anchors.length > 0);
  }

  function scoreRepeatAlignment(groupValues, entry) {
    const values = Array.isArray(groupValues) ? groupValues.filter(Boolean) : [];
    if (values.length === 0) return 0;
    let score = 0;
    for (const anchor of entry.primary || []) {
      if (values.includes(anchor)) score += 4;
    }
    for (const anchor of entry.secondary || []) {
      if (values.includes(anchor)) score += 2;
    }
    return score;
  }

  function getVisiblePageAnchorText(doc) {
    const root = doc?.body || doc?.documentElement;
    return normalizeRepeatAnchor(
      root?.innerText ||
        root?.textContent ||
        ""
    );
  }

  function inferRepeatItemIndexFromIdentifier(el, schemaSectionKey) {
    const tokens = SECTION_IDENTIFIER_TOKENS[schemaSectionKey] || [];
    if (!el || tokens.length === 0) return -1;

    const identifiers = [
      el.id,
      el.getAttribute?.("name"),
      el.getAttribute?.("data-field"),
      el.getAttribute?.("data-path"),
    ].filter(Boolean);

    for (const identifier of identifiers) {
      const normalized = String(identifier).toLowerCase();
      for (const token of tokens) {
        const match = normalized.match(
          new RegExp(`${token}(?:s|list|items?|entries?)?(?:[_\\-.]|\\[)*(\\d+)(?:\\]|[_\\-.]|$)`)
        );
        if (match) return Number(match[1]);
      }
    }

    return -1;
  }

  function assignFallbackRepeatItemIndexes(fields, options = {}) {
    const fieldSemantics = options.fieldSemantics;
    const occurrences = new Map();

    for (const field of Array.isArray(fields) ? fields : []) {
      if (!REPEAT_SECTIONS.has(String(field?.sectionKey || ""))) continue;
      if (Number.isInteger(field?.sectionItemIndex) && field.sectionItemIndex >= 0) {
        continue;
      }

      const semanticFieldKey = fieldSemantics?.inferStructuredFieldKeyFromField?.(
        field,
        field.sectionKey
      );
      const fallbackLabelKey = normalizeLabelToken(
        field?.baseLabel || field?.label || field?.id || field?.name || ""
      );
      const occurrenceFieldKey = semanticFieldKey || fallbackLabelKey;
      if (!occurrenceFieldKey) continue;
      const role = String(field?.compositeRole || "");
      const occurrenceKey = `${field.sectionKey}:${occurrenceFieldKey}:${role}`;
      const nextIndex = occurrences.get(occurrenceKey) || 0;
      field.sectionItemIndex = nextIndex;
      occurrences.set(occurrenceKey, nextIndex + 1);
    }

    splitCollapsedRepeatIndexes(fields, fieldSemantics);
  }

  function splitCollapsedRepeatIndexes(fields, fieldSemantics) {
    const buckets = new Map();
    for (const field of Array.isArray(fields) ? fields : []) {
      if (!REPEAT_SECTIONS.has(String(field?.sectionKey || ""))) continue;
      if (!Number.isInteger(field?.sectionItemIndex) || field.sectionItemIndex < 0) continue;
      const semanticFieldKey = fieldSemantics?.inferStructuredFieldKeyFromField?.(
        field,
        field.sectionKey
      );
      const fallbackLabelKey = normalizeLabelToken(
        field?.baseLabel || field?.label || field?.id || field?.name || ""
      );
      const occurrenceFieldKey = semanticFieldKey || fallbackLabelKey;
      if (!occurrenceFieldKey) continue;
      const role = String(field?.compositeRole || "");
      const bucketKey = `${field.sectionKey}:${occurrenceFieldKey}:${role}:${field.sectionItemIndex}`;
      if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
      buckets.get(bucketKey).push(field);
    }
    for (const group of buckets.values()) {
      if (group.length <= 1) continue;
      group.forEach((field, index) => {
        field.sectionItemIndex = index;
      });
    }
  }

  function alignIncrementalRepeatSourceIndexes(scan, resumeProfile, options = {}) {
    const fillMode = options.fillMode === "overwrite" ? "overwrite" : "incremental";
    const fields = Array.isArray(scan?.fields) ? scan.fields : [];
    const runtimes = Array.isArray(scan?.runtime) ? scan.runtime : [];
    if (fields.length === 0 || runtimes.length === 0) return 0;

    const runtimeById = new Map(runtimes.map((runtime) => [runtime.fieldId, runtime]));
    const sectionGroups = new Map();
    fields.forEach((field, documentIndex) => {
      const sectionKey = String(field?.sectionKey || "");
      if (!INCREMENTAL_REPEAT_ANCHOR_KEYS[sectionKey]) return;
      const pageIndex = Number.isInteger(field.sectionItemIndex)
        ? field.sectionItemIndex
        : -1;
      const groupKey = `${sectionKey}:${pageIndex}`;
      if (!sectionGroups.has(groupKey)) {
        sectionGroups.set(groupKey, {
          sectionKey,
          pageIndex,
          documentIndex,
          fields: [],
          values: [],
        });
      }
      const group = sectionGroups.get(groupKey);
      group.fields.push(field);
      const value = getRuntimeComparableValue(
        runtimeById.get(field.fieldId),
        options.pageStructure
      );
      if (value) group.values.push(value);
    });

    const visiblePageText = getVisiblePageAnchorText(options.document);
    let changed = 0;

    const groupsBySection = new Map();
    for (const group of sectionGroups.values()) {
      if (!groupsBySection.has(group.sectionKey)) groupsBySection.set(group.sectionKey, []);
      groupsBySection.get(group.sectionKey).push(group);
    }

    for (const [sectionKey, groups] of groupsBySection.entries()) {
      const entries = getProfileRepeatEntries(
        resumeProfile,
        sectionKey,
        options.fieldSemantics
      );
      if (entries.length === 0) continue;
      const usedIndexes = new Set();

      const valuedGroups = groups.filter((group) => group.values.length > 0);
      const uniqueAssignments = [];
      for (const group of valuedGroups) {
        const scored = entries
          .map((entry) => ({
            entry,
            score: scoreRepeatAlignment(group.values, entry),
          }))
          .filter((item) => item.score > 0)
          .sort((left, right) => right.score - left.score);
        if (scored.length === 0) continue;
        const bestScore = scored[0].score;
        const tied = scored.filter((item) => item.score === bestScore);
        if (tied.length !== 1) continue;
        uniqueAssignments.push({ group, sourceIndex: tied[0].entry.sourceIndex, score: bestScore });
      }
      uniqueAssignments.sort((left, right) => right.score - left.score);
      for (const assignment of uniqueAssignments) {
        if (usedIndexes.has(assignment.sourceIndex)) continue;
        usedIndexes.add(assignment.sourceIndex);
        for (const field of assignment.group.fields) {
          if (field.sectionItemIndex !== assignment.sourceIndex) changed += 1;
          field.sectionItemIndex = assignment.sourceIndex;
        }
      }

      for (const entry of entries) {
        if (usedIndexes.has(entry.sourceIndex)) continue;
        if (
          entry.anchors.some(
            (anchor) => anchor.length >= 4 && visiblePageText.includes(anchor)
          )
        ) {
          usedIndexes.add(entry.sourceIndex);
        }
      }

      if (fillMode !== "incremental" && fillMode !== "overwrite") continue;

      const remainingIndexes = entries
        .map((entry) => entry.sourceIndex)
        .filter((sourceIndex) => !usedIndexes.has(sourceIndex));
      const blankGroups = groups
        .filter((group) => group.values.length === 0)
        .sort((left, right) => left.documentIndex - right.documentIndex);

      blankGroups.forEach((group, blankIndex) => {
        const sourceIndex = remainingIndexes[blankIndex];
        if (!Number.isInteger(sourceIndex)) return;
        for (const field of group.fields) {
          if (field.sectionItemIndex !== sourceIndex) changed += 1;
          field.sectionItemIndex = sourceIndex;
        }
      });
    }

    if (changed > 0 && typeof options.onAligned === "function") {
      options.onAligned(changed);
    }
    return changed;
  }

  return {
    INCREMENTAL_REPEAT_ANCHOR_KEYS,
    normalizeRepeatAnchor,
    inferRepeatItemIndexFromIdentifier,
    assignFallbackRepeatItemIndexes,
    splitCollapsedRepeatIndexes,
    alignIncrementalRepeatSourceIndexes,
    getProfileRepeatEntries,
  };
});
