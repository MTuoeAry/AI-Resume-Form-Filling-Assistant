(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ResumeRepeatFlow = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const RECORD_STATUS = Object.freeze({
    pending: "pending",
    editing: "editing",
    validating: "validating",
    advancing: "advancing",
    completed: "completed",
    blocked: "blocked",
  });

  const BLOCK_REASONS = Object.freeze({
    missing_required: "missing_required",
    write_failed: "write_failed",
    page_invalid: "page_invalid",
    ambiguous_alignment: "ambiguous_alignment",
    action_unclear: "action_unclear",
    transition_uncertain: "transition_uncertain",
  });

  const SECTION_ORDER = Object.freeze([
    "education",
    "internship",
    "work",
    "project",
    "campus",
    "award",
    "patent",
    "publication",
    "language",
    "certificate",
    "family",
  ]);

  const WAIT_MS = 2500;
  // An accepted but slow add/save must never be replayed on a timeout.
  const RETRY_LIMIT = 0;
  const MAX_STEPS_PER_RECORD = 8;

  const SECTION_LABELS = Object.freeze({
    education: "教育经历",
    internship: "实习经历",
    work: "工作经历",
    project: "项目经历",
    campus: "校园经历",
    award: "获奖经历",
    patent: "专利",
    publication: "论文",
    language: "语言能力",
    certificate: "证书",
    family: "亲属信息",
  });

  function compactText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeActionText(value) {
    return compactText(value).toLowerCase().replace(/\s+/g, "");
  }

  function classifyAdvanceCandidate(candidate = {}) {
    const type = String(candidate.type || "").toLowerCase();
    const text = normalizeActionText(candidate.text || candidate.label || "");
    const name = normalizeActionText(candidate.name || candidate.id || "");
    const combined = `${text} ${name}`.trim();

    if (type === "submit") {
      return { kind: "forbidden", reason: "submit_type" };
    }
    if (
      /^(提交|投递|立即投递|提交申请|立即申请|报名|submit|apply|applynow)$/.test(text) ||
      /提交申请|立即投递|submitapplication|applynow/.test(combined)
    ) {
      return { kind: "forbidden", reason: "application_submit" };
    }
    if (!candidate.inSection) {
      return { kind: "out_of_scope", reason: "outside_section" };
    }
    if (candidate.disabled || candidate.ariaDisabled === "true" || candidate.ariaDisabled === true) {
      const kind = classifyEnabledKind(text, candidate);
      return { kind: kind === "ignored" ? "disabled" : kind, enabled: false, reason: "disabled" };
    }

    const kind = classifyEnabledKind(text, candidate);
    if (kind === "ignored") return { kind, reason: "unrecognized" };
    return { kind, enabled: true };
  }

  function classifyEnabledKind(text, candidate) {
    if (
      /^(新增|添加|增加|add)$/.test(text) ||
      /新增.*经历|添加.*经历|增加.*经历|addanother|addeducation|addinternship|addwork|addproject|addemployment/.test(text)
    ) {
      return "add";
    }
    if (
      /^(保存本条|保存当前|保存此条|saveitem|savethis|saveentry)$/.test(text) ||
      ((/^(保存|确定|完成|save|confirm|done)$/.test(text) || /保存本条|saveentry/.test(text)) &&
        (candidate.inEditor || candidate.inSection))
    ) {
      return "save";
    }
    return "ignored";
  }

  function pickAdvanceAction(observation, { needsNewSlot, editorFilled } = {}) {
    const actions = Array.isArray(observation?.actions) ? observation.actions : [];
    const forbidden = actions.find((action) => action.kind === "forbidden");
    if (forbidden && needsNewSlot && !actions.some((action) => action.kind === "add" || action.kind === "save")) {
      return { kind: "unclear", reason: "only_forbidden_actions", action: forbidden };
    }
    if (!needsNewSlot) return { kind: "none" };

    const add = actions.find((action) => action.kind === "add" && action.enabled !== false);
    const save = actions.find((action) => action.kind === "save" && action.enabled !== false);
    const addDisabled = actions.find((action) => action.kind === "add" && action.enabled === false);
    const hasEditor = (observation?.editors || []).length > 0;

    if (save && (!add || addDisabled)) return { ...save, kind: "save" };
    if (add && editorFilled) return { ...add, kind: "add" };
    if (add && !hasEditor) return { ...add, kind: "add" };
    if (save && add) return { ...save, kind: "save" };
    if (add && !editorFilled) {
      return { kind: "unclear", reason: "add_with_empty_editor" };
    }
    if (addDisabled && editorFilled) {
      return { kind: "blocked", reason: "add_still_disabled" };
    }
    return { kind: "unclear", reason: "no_section_advance_action" };
  }

  function uniqueMatch(entries, values) {
    const scored = (entries || [])
      .map((entry) => ({
        entry,
        score: scoreValues(values, entry),
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score);
    if (scored.length === 0) return null;
    const best = scored[0].score;
    const tied = scored.filter((item) => item.score === best);
    if (tied.length !== 1) return { ambiguous: true, score: best };
    return { entry: tied[0].entry, score: best };
  }

  function scoreValues(values, entry) {
    const list = Array.isArray(values) ? values.filter(Boolean) : [];
    if (list.length === 0) return 0;
    let score = 0;
    for (const anchor of entry.primary || []) {
      if (list.includes(anchor)) score += 4;
    }
    for (const anchor of entry.secondary || []) {
      if (list.includes(anchor)) score += 2;
    }
    return score;
  }

  function isBlankSurface(surface) {
    return Boolean(surface?.blank) || !Array.isArray(surface?.values) || surface.values.every((value) => !value);
  }

  function cardMatchesAnchors(card, entry) {
    return scoreValues(card?.values, entry) > 0;
  }

  function verifyTransition(before, after, intent = {}) {
    const beforeCards = Array.isArray(before?.cards) ? before.cards : [];
    const afterCards = Array.isArray(after?.cards) ? after.cards : [];
    const beforeEditors = Array.isArray(before?.editors) ? before.editors : [];
    const afterEditors = Array.isArray(after?.editors) ? after.editors : [];
    const afterMessages = Array.isArray(after?.validationMessages) ? after.validationMessages : [];
    const beforeMessages = Array.isArray(before?.validationMessages) ? before.validationMessages : [];

    if (afterMessages.length > beforeMessages.length) {
      return { ok: false, reason: "validation_failed" };
    }

    const matchingCard = afterCards.find((card) => cardMatchesAnchors(card, intent.entry || {}));
    const hadMatchingCard = beforeCards.some((card) => cardMatchesAnchors(card, intent.entry || {}));

    if (intent.kind === "save" || intent.kind === "add" || intent.kind === "save_and_add") {
      if (matchingCard && !hadMatchingCard) {
        return { ok: true, reason: "card_appeared" };
      }
      if (afterEditors.length > beforeEditors.length) {
        return { ok: true, reason: "new_editor" };
      }
      if (
        beforeEditors.length === 1 &&
        afterEditors.length === 1 &&
        !isBlankSurface(beforeEditors[0]) &&
        (isBlankSurface(afterEditors[0]) ||
          (intent.nextEntry && scoreValues(afterEditors[0].values, intent.nextEntry) > 0))
      ) {
        return { ok: true, reason: "editor_switched" };
      }
    }

    const unchanged =
      beforeCards.length === afterCards.length &&
      beforeEditors.length === afterEditors.length &&
      JSON.stringify(beforeEditors.map((item) => item.values)) ===
        JSON.stringify(afterEditors.map((item) => item.values));
    if (unchanged) {
      return { ok: false, uncertain: true, reason: "no_visible_change" };
    }
    if (matchingCard) {
      return { ok: true, reason: "record_visible" };
    }
    return { ok: false, uncertain: true, reason: "unrecognized_change" };
  }

  function formatBlockedMessage({ sectionKey, sourceIndex, reason, missingLabel, detail } = {}) {
    const label = SECTION_LABELS[sectionKey] || "经历";
    const ordinal = Number(sourceIndex) + 1;
    if (reason === BLOCK_REASONS.missing_required) {
      return `第 ${ordinal} 条${label}缺少“${missingLabel || "必填资料"}”，网站暂不允许新增下一条。补充后可以继续。`;
    }
    if (reason === BLOCK_REASONS.page_invalid) {
      const extra = missingLabel || detail;
      return extra
        ? `第 ${ordinal} 条${label}未通过页面校验（${extra}），已停在当前记录。`
        : `第 ${ordinal} 条${label}未通过页面校验，已停在当前记录。`;
    }
    if (reason === BLOCK_REASONS.ambiguous_alignment) {
      return `第 ${ordinal} 条${label}无法唯一对齐到来源记录，已停止推进以免串填。`;
    }
    if (reason === BLOCK_REASONS.action_unclear) {
      return `第 ${ordinal} 条${label}的保存或新增按钮含义不明确，未点击以免误操作。`;
    }
    if (reason === BLOCK_REASONS.transition_uncertain) {
      return `第 ${ordinal} 条${label}保存或新增后页面状态不明确，已停止以免重复新增。`;
    }
    if (reason === BLOCK_REASONS.write_failed) {
      return `第 ${ordinal} 条${label}写入失败，已停在当前记录。`;
    }
    return `第 ${ordinal} 条${label}受阻，已停止推进。`;
  }

  function resolveCurrentRecord(observation, sourceRecords, completed) {
    const pending = (sourceRecords || []).filter((entry) => !completed.has(entry.sourceIndex));
    const editors = Array.isArray(observation?.editors) ? observation.editors : [];
    const cards = Array.isArray(observation?.cards) ? observation.cards : [];

    for (const card of cards) {
      const match = uniqueMatch(sourceRecords, card.values);
      if (match?.ambiguous) {
        return { kind: "blocked", reason: BLOCK_REASONS.ambiguous_alignment, surface: card };
      }
    }

    const matchedCardIndexes = new Set();
    for (const card of cards) {
      const match = uniqueMatch(sourceRecords, card.values);
      if (match?.entry) matchedCardIndexes.add(match.entry.sourceIndex);
    }

    for (const editor of editors) {
      if (isBlankSurface(editor)) continue;
      const match = uniqueMatch(pending, editor.values);
      if (match?.ambiguous) {
        return { kind: "blocked", reason: BLOCK_REASONS.ambiguous_alignment, editor };
      }
      if (match?.entry) {
        return { kind: "fill", editor, entry: match.entry, alreadyValued: true };
      }
    }

    const blankEditors = editors.filter(isBlankSurface);
    const remaining = pending.filter((entry) => !matchedCardIndexes.has(entry.sourceIndex));
    if (blankEditors.length > 0 && remaining.length > 0) {
      return { kind: "fill", editor: blankEditors[0], entry: remaining[0], alreadyValued: false };
    }

    if (remaining.length === 0) {
      return { kind: "done" };
    }

    const editCard = cards.find((card) => {
      const match = uniqueMatch(remaining, card.values);
      return card.hasEditAction && match?.entry;
    });
    if (editCard) {
      const match = uniqueMatch(remaining, editCard.values);
      return { kind: "open_editor", card: editCard, entry: match.entry };
    }

    if (editors.length === 0 && remaining.length > 0) {
      return { kind: "advance_empty", entry: remaining[0] };
    }

    return { kind: "advance", entry: remaining[0], editor: editors[0] || null };
  }

  function createCoordinator(host = {}) {
    async function runSection({ sectionKey, sourceRecords, fillMode = "overwrite" } = {}) {
      const completed = new Set();
      const conflicts = [];
      const records = Array.isArray(sourceRecords) ? sourceRecords : [];
      const maxSteps = Math.max(4, records.length * MAX_STEPS_PER_RECORD);
      let blocked = null;

      for (let step = 0; step < maxSteps; step += 1) {
        if (host.isCanceled?.()) {
          return { status: "canceled", completed: Array.from(completed), blocked, conflicts };
        }
        const observation = host.observeSection?.(sectionKey) || {};
        for (const card of observation.cards || []) {
          const match = uniqueMatch(records, card.values);
          if (match?.entry && !match.ambiguous) completed.add(match.entry.sourceIndex);
        }

        const plan = resolveCurrentRecord(observation, records, completed);
        if (plan.kind === "done") {
          return { status: RECORD_STATUS.completed, completed: Array.from(completed), blocked, conflicts };
        }
        if (plan.kind === "blocked") {
          blocked = {
            sectionKey,
            sourceIndex: plan.entry?.sourceIndex ?? 0,
            reason: plan.reason,
            status: RECORD_STATUS.blocked,
          };
          return { status: RECORD_STATUS.blocked, completed: Array.from(completed), blocked, conflicts };
        }

        if (plan.kind === "open_editor") {
          await host.openEditor?.(plan);
          continue;
        }

        if (plan.kind === "fill") {
          host.markStatus?.(plan.entry.sourceIndex, RECORD_STATUS.editing);
          if (fillMode === "incremental" && plan.alreadyValued) {
            conflicts.push({
              sectionKey,
              sourceIndex: plan.entry.sourceIndex,
              detail: "页面已有内容，增量模式保留；保留成功不代表记录内容正确",
            });
          }

          const fillResult = (await host.fillCurrentRecord?.({
            sectionKey,
            sourceIndex: plan.entry.sourceIndex,
            editor: plan.editor,
            entry: plan.entry,
            overwrite: fillMode !== "incremental",
          })) || { filled: false };

          if (fillResult.blocked) {
            blocked = {
              sectionKey,
              sourceIndex: plan.entry.sourceIndex,
              reason: fillResult.reason || BLOCK_REASONS.write_failed,
              missingLabel: fillResult.missingLabel,
              status: RECORD_STATUS.blocked,
            };
            return { status: RECORD_STATUS.blocked, completed: Array.from(completed), blocked, conflicts };
          }

          host.markStatus?.(plan.entry.sourceIndex, RECORD_STATUS.validating);
          const validation = (await host.validateCurrent?.({
            sectionKey,
            editor: plan.editor,
            entry: plan.entry,
          })) || { ok: true };
          if (!validation.ok) {
            blocked = {
              sectionKey,
              sourceIndex: plan.entry.sourceIndex,
              reason: validation.reason || BLOCK_REASONS.page_invalid,
              missingLabel: validation.missingLabel,
              status: RECORD_STATUS.blocked,
            };
            return { status: RECORD_STATUS.blocked, completed: Array.from(completed), blocked, conflicts };
          }

          const afterFill = host.observeSection?.(sectionKey) || observation;
          const remainingAfterFill = records.filter((entry) => {
            if (completed.has(entry.sourceIndex) || entry.sourceIndex === plan.entry.sourceIndex) return false;
            const cardHit = (afterFill.cards || []).some((card) => uniqueMatch([entry], card.values)?.entry);
            const editorHit = (afterFill.editors || []).some(
              (item) => item.id !== plan.editor?.id && uniqueMatch([entry], item.values)?.entry
            );
            return !cardHit && !editorHit;
          });
          const otherBlank = (afterFill.editors || []).filter(
            (editor) => editor.id !== plan.editor?.id && isBlankSurface(editor)
          );
          if (remainingAfterFill.length === 0 || otherBlank.length > 0) {
            completed.add(plan.entry.sourceIndex);
            continue;
          }

          const action = pickAdvanceAction(afterFill, {
            needsNewSlot: remainingAfterFill.length > 0,
            editorFilled: true,
          });
          if (action.kind === "none") {
            completed.add(plan.entry.sourceIndex);
            continue;
          }
          if (action.kind === "unclear" || action.kind === "blocked") {
            blocked = {
              sectionKey,
              sourceIndex: plan.entry.sourceIndex,
              reason:
                action.kind === "blocked" ? BLOCK_REASONS.page_invalid : BLOCK_REASONS.action_unclear,
              status: RECORD_STATUS.blocked,
            };
            return { status: RECORD_STATUS.blocked, completed: Array.from(completed), blocked, conflicts };
          }

          host.markStatus?.(plan.entry.sourceIndex, RECORD_STATUS.advancing);
          const advanced = await advanceWithReconcile(host, sectionKey, action, plan, remainingAfterFill[0]);
          if (!advanced.ok) {
            blocked = {
              sectionKey,
              sourceIndex: plan.entry.sourceIndex,
              reason: advanced.reason || BLOCK_REASONS.transition_uncertain,
              detail: advanced.detail,
              status: RECORD_STATUS.blocked,
            };
            return { status: RECORD_STATUS.blocked, completed: Array.from(completed), blocked, conflicts };
          }
          completed.add(plan.entry.sourceIndex);
          continue;
        }

        if (plan.kind === "advance" || plan.kind === "advance_empty") {
          const action = pickAdvanceAction(observation, {
            needsNewSlot: true,
            editorFilled: plan.kind === "advance" && plan.editor && !isBlankSurface(plan.editor),
          });
          if (action.kind === "unclear" || action.kind === "blocked" || action.kind === "none") {
            blocked = {
              sectionKey,
              sourceIndex: plan.entry?.sourceIndex ?? 0,
              reason: BLOCK_REASONS.action_unclear,
              status: RECORD_STATUS.blocked,
            };
            return { status: RECORD_STATUS.blocked, completed: Array.from(completed), blocked, conflicts };
          }
          const advanced = await advanceWithReconcile(host, sectionKey, action, plan, plan.entry);
          if (!advanced.ok) {
            blocked = {
              sectionKey,
              sourceIndex: plan.entry?.sourceIndex ?? 0,
              reason: advanced.reason || BLOCK_REASONS.transition_uncertain,
              status: RECORD_STATUS.blocked,
            };
            return { status: RECORD_STATUS.blocked, completed: Array.from(completed), blocked, conflicts };
          }
        }
      }

      blocked = {
        sectionKey,
        sourceIndex: records.find((entry) => !completed.has(entry.sourceIndex))?.sourceIndex ?? 0,
        reason: BLOCK_REASONS.transition_uncertain,
        status: RECORD_STATUS.blocked,
      };
      return { status: RECORD_STATUS.blocked, completed: Array.from(completed), blocked, conflicts };
    }

    function rebindAction(observation, action) {
      if (!action?.kind || action.kind === "none") return action;
      const matches = (observation.actions || []).filter(
        (item) => item.kind === action.kind && item.enabled !== false
      );
      if (matches.length === 0) return null;
      if (action.id) {
        const sameId = matches.find((item) => item.id === action.id);
        if (sameId) return sameId;
      }
      if (action.text) {
        const sameText = matches.filter((item) => item.text === action.text);
        if (sameText.length === 1) return sameText[0];
      }
      return matches[0];
    }

    async function advanceWithReconcile(hostApi, sectionKey, action, plan, nextEntry) {
      const before = hostApi.observeSection?.(sectionKey) || {};
      const liveAction = rebindAction(before, action);
      if (!liveAction) {
        return { ok: false, reason: BLOCK_REASONS.action_unclear };
      }
      const result = (await hostApi.advance?.(liveAction, { before, entry: plan.entry })) || {};
      const after = hostApi.observeSection?.(sectionKey) || {};
      const verified = verifyTransition(before, after, {
        kind: action.kind,
        entry: plan.entry,
        nextEntry,
      });
      if (verified.ok) return { ok: true, reason: verified.reason };
      if (verified.reason === "validation_failed") {
        return {
          ok: false,
          reason: BLOCK_REASONS.page_invalid,
          detail: (after.validationMessages || [])[0],
        };
      }
      if (result.timedOut || verified.uncertain) {
        const matchingCard = (after.cards || []).find((card) => cardMatchesAnchors(card, plan.entry || {}));
        if (matchingCard) return { ok: true, reason: "reconciled_after_timeout" };
      }
      return { ok: false, reason: BLOCK_REASONS.transition_uncertain };
    }

    return { runSection };
  }

  return {
    RECORD_STATUS,
    BLOCK_REASONS,
    SECTION_ORDER,
    WAIT_MS,
    RETRY_LIMIT,
    SECTION_LABELS,
    classifyAdvanceCandidate,
    pickAdvanceAction,
    verifyTransition,
    resolveCurrentRecord,
    formatBlockedMessage,
    createCoordinator,
  };
});
