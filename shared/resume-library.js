(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ResumeLibrary = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function textValue(value) {
    if (value == null) return "";
    if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join("\n");
    if (typeof value === "object") return "";
    return String(value);
  }

  function recordFields(section, record) {
    return section.fields.map(field => ({
      key: field.key, label: field.label, value: textValue(record?.[field.key]),
    })).filter(field => field.value.trim());
  }

  function formatRecord(section, record) {
    return recordFields(section, record).map(field => `${field.label}：${field.value}`).join("\n");
  }

  function recordTitle(section, record, index) {
    return textValue(record?.name || record?.school || record?.company || record?.organization || record?.title) ||
      `${section.itemLabel || section.label} ${index + 1}`;
  }

  function createView(host, { schema, onFill, onCopy }) {
    const doc = host.ownerDocument;
    let busy = false;
    let targetReady = false;
    function element(tag, className, text) {
      const el = doc.createElement(tag);
      if (className) el.className = className;
      if (text !== undefined) el.textContent = text;
      return el;
    }
    function button(label, handler) {
      const el = element("button", "btn btn-outline btn-sm", label);
      el.type = "button";
      el.addEventListener("click", handler);
      return el;
    }
    function copyButton(label, value) {
      let resetTimer;
      const el = button(label, async () => {
        let ok = false;
        try { ok = await onCopy(value) !== false; } catch (_) { /* Keep text selectable. */ }
        clearTimeout(resetTimer);
        el.textContent = ok ? "已复制" : "请选中文字复制";
        resetTimer = setTimeout(() => { el.textContent = label; }, 1800);
      });
      return el;
    }
    function updateState(state = {}) {
      if ("busy" in state) busy = state.busy;
      if ("targetReady" in state) targetReady = state.targetReady;
      host.querySelectorAll('[data-library-fill]').forEach(el => {
        el.disabled = busy || !targetReady;
        el.title = targetReady ? "将本条资料填入已选区域" : "请先选择网页区域";
      });
    }
    function render(profile) {
      const opened = new Set(Array.from(host.querySelectorAll('details[open]')).map(el => el.dataset.libraryKey));
      host.replaceChildren();
      for (const section of schema.sections) {
        const records = section.type === "list" ? (profile[section.key] || []) : [profile[section.key] || {}];
        const populated = records.map((record, index) => ({ record, index, fields: recordFields(section, record) }))
          .filter(item => item.fields.length);
        if (!populated.length) continue;
        const group = element("details", "library-section");
        group.dataset.libraryKey = section.key;
        group.open = opened.has(section.key);
        group.append(element("summary", "", `${section.label} · ${populated.length}${section.type === "list" ? " 条" : " 组"}`));
        for (const { record, index, fields } of populated) {
          const card = element("article", "library-record");
          card.dataset.section = section.key;
          card.dataset.index = index;
          if (section.type === "list") {
            card.append(element("h3", "library-record-title", recordTitle(section, record, index)));
            const dates = [record.startDate, record.endDate].filter(Boolean).join(" — ")
              || record.birthDate
              || record.date
              || record.issueDate
              || record.publicationDate
              || "";
            if (dates) card.append(element("p", "library-record-dates", dates));
          }
          const actions = element("div", "library-actions");
          if (section.type === "list" && section.key !== "customFields") {
            const fill = button("填入选中区域", () => onFill(section.key, index));
            fill.dataset.libraryFill = "true";
            actions.append(fill);
          }
          actions.append(copyButton(section.type === "list" ? "复制整条" : "复制本组", formatRecord(section, record)));
          card.append(actions);
          const details = element("details", "library-fields");
          details.dataset.libraryKey = `${section.key}:${index}`;
          details.open = opened.has(details.dataset.libraryKey);
          details.append(element("summary", "", `查看完整内容 · ${fields.length} 项`));
          for (const field of fields) {
            const row = element("div", "library-field");
            const head = element("div", "library-field-head");
            head.append(element("span", "", field.label));
            const copy = copyButton("复制", field.value);
            copy.setAttribute("aria-label", `复制${field.label}`);
            head.append(copy);
            row.append(head, element("div", "library-value", field.value));
            details.append(row);
          }
          card.append(details);
          group.append(card);
        }
        host.append(group);
      }
      if (!host.childElementCount) host.append(element("p", "tip", "暂无资料，请先在“标准简历”中填写或导入。"));
      updateState();
    }
    return { render, updateState };
  }

  return { textValue, recordFields, formatRecord, recordTitle, createView };
});
