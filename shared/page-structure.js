(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ResumePageStructure = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // These describe page concepts, never hostnames or one site's element IDs.
  const SECTIONS = [
    ["education", "教育经历", /教育经历|教育背景|学习经历|\beducation(?:al)?\b|\bacademic background\b/i],
    ["internship", "实习经历", /实习经历|实习经验|\binternships?\b/i],
    ["work", "工作经历", /工作经历|工作经验|任职经历|\bwork(?: experience| history| info| information)?\b|\bemployment\b/i],
    ["project", "项目经历", /项目经历|项目经验|\bprojects?\b/i],
    ["campus", "校园经历", /校园经历|校内职务|学生工作|社会实践|\bcampus(?: experience| activities)?\b/i],
    ["award", "获奖经历", /获奖经历|获奖记录|在校奖励|荣誉奖励|奖项荣誉|\bawards?\b|\bhonou?rs?\b/i],
    ["publication", "论文", /论文发表|发表论文|专业论著|^论文$|\bpublications?\b|\btreatises?\b/i],
    ["patent", "专利", /专利|\bpatents?\b/i],
    ["language", "语言能力", /语言能力|语言证书|外语能力|\blanguages?\b/i],
    ["certificate", "证书", /资格证书|证书信息|\bcertificat(?:e|es|ions?)\b/i],
    ["family", "亲属信息", /亲属信息|家庭成员|家属信息|\bfamily members?\b/i],
    ["personal", "个人信息", /基本信息|基础信息|个人信息|联系方式|自我评价|\bpersonal(?: information| details| info)?\b|\bcontact(?:s| information| details| info)?\b|\bself[- ]?evaluations?\b/i],
    ["jobPreference", "求职意向", /求职意向|求职偏好|\bjob preferences?\b|\bcareer objectives?\b/i],
    ["skill", "技能", /技能特长|专业技能|计算机技能|\bskills?\b/i],
  ];
  const ROW = 'dl,tr,[data-field],[class~="field"],[class*="form-group"],[class*="form-item"],[class*="form_item"],[class*="FormItem"],[class*="field-row"],[class*="fieldRow"]';
  const NATIVE = 'input:not([type="hidden"]),textarea,select,[contenteditable="true"],[role="combobox"]';
  const clean = value => String(value || "").replace(/\s+/g, " ").trim();
  const humanize = value => clean(String(value || "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_\-.\[\]\d]+/g, " "));

  function visible(el) {
    if (!el?.getClientRects?.().length) return false;
    for (let node = el; node; node = node.parentElement) {
      const style = node.ownerDocument.defaultView.getComputedStyle(node);
      if (node.hidden || style.display === "none" || style.visibility === "hidden") return false;
    }
    return true;
  }

  function sectionFromText(value) {
    const text = humanize(value);
    const matches = SECTIONS.map(([key, label, pattern]) => {
      const match = pattern.exec(text);
      return match ? { key, label, evidence: clean(value), offset: match.index } : null;
    }).filter(Boolean).sort((a, b) => a.offset - b.offset);
    return matches[0] || null;
  }

  function sectionFromIdentifier(...values) {
    for (const value of values.filter(Boolean)) {
      const compact = String(value).replace(/[^a-zA-Z\u4e00-\u9fff]/g, "").toLowerCase();
      if (!compact) continue;
      const match = sectionFromText(value);
      if (!match) continue;
      const token = match.key.toLowerCase();
      const dominates =
        compact === token ||
        compact === `${token}s` ||
        compact === `${token}info` ||
        compact === `${token}information` ||
        compact === `${token}section` ||
        compact === `${token}block` ||
        compact === `${token}area` ||
        compact === `${token}history` ||
        compact === `${token}experience` ||
        compact === `${token}experiences`;
      if (dominates) return match;
    }
    return null;
  }

  function ownHeadings(root) {
    return Array.from(root.children || []).flatMap(child => {
      if (child.matches('h1,h2,h3,h4,h5,h6,legend,[role="heading"]')) return [child];
      if (child.matches('header,[class*="header"],[class*="Header"],[class*="heading"],[class*="Heading"]')) {
        return Array.from(child.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]'));
      }
      return [];
    });
  }

  function findSection(el) {
    for (let root = el?.parentElement; root && !root.matches('body,html'); root = root.parentElement) {
      if (root.matches(ROW)) continue;
      const headings = ownHeadings(root).map(h => sectionFromText(h.textContent)).filter(Boolean);
      // Multiple peer headings describe a form container, not one section.
      if (new Set(headings.map(h => h.key)).size > 1) continue;
      const heading = headings[0];
      const aria = sectionFromText(root.getAttribute('aria-label'));
      const labelledBy = clean(root.getAttribute('aria-labelledby')).split(' ')
        .map(id => root.ownerDocument.getElementById(id)?.textContent || '').join(' ');
      const labelled = sectionFromText(labelledBy);
      const identifier = sectionFromIdentifier(root.id, root.getAttribute('data-section'));
      const section = heading || aria || labelled || identifier;
      if (section) return { ...section, root, source: heading || aria || labelled ? 'heading' : 'identifier' };
    }
    return null;
  }

  function fieldLabel(el) {
    const row = el?.closest?.(ROW);
    const choice = /^(radio|checkbox)$/.test(el?.getAttribute?.('type') || '');
    const associated = !choice && (el?.labels?.[0] || el?.closest?.('label'));
    const aria = el?.getAttribute?.('aria-label');
    if (aria && !choice) return clean(aria);
    const node = associated || row?.querySelector('dt,th,label,[class*="label"],[class*="Label"]');
    if (!node) return "";
    // A <dt> may contain the whole radio group. Its leading text is the question.
    let text = "";
    for (const child of node.childNodes) {
      if (child.nodeType === 1 && child.matches('input,select,textarea,button,br')) break;
      text += child.textContent || "";
    }
    return clean(text).replace(/[＊*]+/g, '').trim();
  }

  function itemRoot(el, sectionRoot) {
    let candidate = null;
    for (let node = el?.parentElement; node && node !== sectionRoot; node = node.parentElement) {
      if (node.matches(ROW)) continue;
      const peers = Array.from(node.parentElement?.children || []).filter(other =>
        other.tagName === node.tagName && other.className === node.className && visible(other) &&
        other.querySelectorAll(NATIVE).length >= 2);
      if (peers.length > 1 || node.matches('article,fieldset,[data-item-index],[data-record-id],[class~="card"],[class~="record"],[class~="entry"]')) {
        candidate = node;
      }
    }
    return candidate || sectionRoot;
  }

  function describeField(el) {
    const section = findSection(el);
    if (!section) return null;
    return { ...section, itemRoot: itemRoot(el, section.root), label: fieldLabel(el) };
  }

  function optionText(input) {
    let text = "";
    for (let node = input?.nextSibling; node; node = node.nextSibling) {
      if (node.nodeType === 1 && node.matches('input,select,textarea,br')) break;
      if (node.nodeType === 1 && node.querySelector('input,select,textarea')) break;
      text += node.textContent || "";
      if (clean(text)) break;
    }
    return clean(text);
  }

  function isPromptValue(el) {
    const value = clean(el?.value);
    if (!value) return true;
    if (value !== clean(el.getAttribute?.('value'))) return false;
    const label = fieldLabel(el);
    const suffix = value.replace(/^(?:请输入|输入|请选择|选择|please enter|enter|please select|select)\s*/i, '');
    return suffix !== value && Boolean(label) && clean(suffix) === label;
  }

  function pickerDescriptor(root) {
    if (!root?.matches?.('div,span,button') || root.closest('nav,[role="navigation"]')) return null;
    if (root.querySelector('input:not([type="hidden"]),textarea,select')) return null;
    const children = Array.from(root.children || []);
    const display = children.find(child => child.matches('span,input[readonly],[class*="value"],[class*="Value"]') &&
      !child.querySelector('ul,ol,[role="listbox"]'));
    if (!display) return null;
    const lists = Array.from(root.querySelectorAll('ul,ol,[role="listbox"]')).filter(list =>
      list.parentElement === root || list.parentElement?.parentElement === root);
    const cells = list => Array.from(list.children).filter(child => child.matches('li,[role="option"]'));
    const years = lists.find(list => cells(list).length >= 3 && cells(list).every(c => /^(19|20|21)\d{2}年?$/.test(clean(c.textContent))));
    const months = lists.find(list => cells(list).length === 12 && cells(list).every((c, i) => Number(clean(c.textContent).replace(/月$/, '')) === i + 1));
    if (years && months) return { kind: 'calendar', root, display, years, months };
    if (lists.length !== 1 || cells(lists[0]).length < 2) return null;
    const options = cells(lists[0]);
    if (options.some(o => o.querySelector('a[href]:not([href^="javascript:"]),input,button,ul,ol'))) return null;
    const hasCodes = options.every(o => o.hasAttribute('data-code') || o.hasAttribute('data-value') || o.getAttribute('role') === 'option');
    const hint = /select|dropdown|picker|(?:^|\s)slt(?:\s|$)/i.test(root.className);
    const collapsed = !visible(lists[0]);
    if (!hasCodes && !(hint && collapsed)) return null;
    return { kind: 'select', root, display, options };
  }

  function discoverPickers(scope) {
    const roots = new Set();
    for (const list of scope.querySelectorAll('ul,ol,[role="listbox"]')) {
      for (const root of [list.parentElement, list.parentElement?.parentElement]) {
        if (root && visible(root) && pickerDescriptor(root)) roots.add(root);
      }
    }
    return Array.from(roots).filter(root => !Array.from(roots).some(other => other !== root && root.contains(other)));
  }

  function readPicker(descriptor) {
    const text = clean(descriptor?.display?.textContent);
    return /^(请选择|请选择.*|select|select .*|choose|choose .*|please select.*)$/i.test(text) ? '' : text;
  }

  // Only click real page options. Never manufacture a div's displayed value.
  async function fillPicker(descriptor, desired, { click, wait, pick, matches }) {
    const { root, display } = descriptor;
    const before = readPicker(descriptor);
    if (descriptor.kind === 'select') {
      const options = descriptor.options.map(el => ({ el, label: clean(el.textContent) }));
      const best = pick(options, desired);
      if (!best) return false;
      click(root);
      await wait(80);
      if (!visible(best.el)) return false;
      click(best.el);
      await wait(120);
      if (matches(readPicker(descriptor), best.label)) return true;
      const previous = options.find(o => o.label === before);
      if (previous && readPicker(descriptor) !== before) { click(root); await wait(80); click(previous.el); await wait(80); }
      return false;
    }
    const parsed = String(desired).match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?$/);
    if (!parsed || +parsed[2] < 1 || +parsed[2] > 12) return false;
    click(root);
    await wait(80);
    let years = Array.from(descriptor.years.children);
    // Navigate a bounded number of year pages using explicit previous/next controls.
    for (let round = 0; round < 24 && !years.some(y => parseInt(y.textContent, 10) === +parsed[1]); round++) {
      const values = years.map(y => parseInt(y.textContent, 10)).filter(Number.isFinite);
      const backwards = +parsed[1] < Math.min(...values);
      const panel = descriptor.years.parentElement;
      const buttons = Array.from(panel.querySelectorAll('a,button,[role="button"]')).filter(visible);
      const nav = buttons.find(b => backwards ? /^(<|‹|«|上页|上一页|previous)$/i.test(clean(b.textContent)) : /^(>|›|»|下页|下一页|next)$/i.test(clean(b.textContent)));
      if (!nav) return false;
      const oldYears = values.join(',');
      click(nav); await wait(80);
      years = Array.from(descriptor.years.children);
      if (years.map(y => parseInt(y.textContent, 10)).join(',') === oldYears) return false;
    }
    const year = years.find(y => parseInt(y.textContent, 10) === +parsed[1]);
    if (!year || !visible(year)) return false;
    click(year); await wait(80);
    const month = Array.from(descriptor.months.children).find(m => parseInt(m.textContent, 10) === +parsed[2]);
    if (!month || !visible(month)) return false;
    click(month); await wait(120);
    // Some widgets expose a day panel only after selecting month. Never guess day 1.
    const dayLists = Array.from(root.querySelectorAll('ul,ol')).filter(l => l !== descriptor.years && l !== descriptor.months && visible(l));
    if (dayLists.length) {
      if (!parsed[3]) return false;
      const days = Array.from(dayLists[0].children).filter(d => visible(d) && !/disabled|other|adjacent|prev|next/i.test(d.className));
      const day = days.find(d => /^\d{1,2}日?$/.test(clean(d.textContent)) && parseInt(d.textContent, 10) === +parsed[3]);
      if (!day) return false;
      click(day); await wait(120);
    }
    const actual = readPicker({ ...descriptor, display });
    const date = actual.match(/^(\d{4})[-/.年](\d{1,2})(?:[-/.月](\d{1,2}))?日?$/);
    return Boolean(date && +date[1] === +parsed[1] && +date[2] === +parsed[2] && (!date[3] || (parsed[3] && +date[3] === +parsed[3])));
  }

  function findLowestCommonAncestor(elements) {
    const nodes = Array.isArray(elements) ? elements.filter(Boolean) : [];
    if (nodes.length === 0) return null;

    let candidate = nodes[0];
    while (
      candidate &&
      !nodes.every((node) => candidate === node || candidate.contains?.(node))
    ) {
      candidate = candidate.parentElement;
    }
    return candidate || null;
  }

  return {
    describeField,
    findSection,
    fieldLabel,
    optionText,
    isPromptValue,
    pickerDescriptor,
    discoverPickers,
    readPicker,
    fillPicker,
    findLowestCommonAncestor,
  };
});
