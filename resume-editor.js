const resumeNavEl = document.getElementById("resumeNav");
const resumeFormHost = document.getElementById("resumeFormHost");
const saveResumeBtn = document.getElementById("saveResumeBtn");
const reloadResumeBtn = document.getElementById("reloadResumeBtn");
const resumeImportTextEl = document.getElementById("resumeImportText");
const importResumeBtn = document.getElementById("importResumeBtn");
const uploadPdfBtn = document.getElementById("uploadPdfBtn");
const resumePdfFileEl = document.getElementById("resumePdfFile");
const pageStatusEl = document.getElementById("pageStatus");
const assetGridEl = document.getElementById("assetGrid");
const importResumeDocumentBtn = document.getElementById("importResumeDocumentBtn");
const exportResumeDocumentBtn = document.getElementById("exportResumeDocumentBtn");
const resumeDocumentFileEl = document.getElementById("resumeDocumentFile");
const resumeDocumentImportModeEl = document.getElementById("resumeDocumentImportMode");

const schema = window.ResumeSchema;
if (!schema) {
  throw new Error("Resume schema is not available");
}

const resumeStorage = window.ResumeStorage;
if (!resumeStorage) {
  throw new Error("Resume storage is not available");
}

const modelStorage = window.ResumeModelStorage;
if (!modelStorage) {
  throw new Error("Model storage is not available");
}

const aiClient = window.ResumeAiClient;
if (!aiClient) {
  throw new Error("AI client is not available");
}

const resumePrompts = window.ResumePrompts;
if (!resumePrompts) {
  throw new Error("Resume prompts are not available");
}

const assetStorage = window.ResumeAssetStorage;
if (!assetStorage) {
  throw new Error("Resume asset storage is not available");
}

const profileDocument = window.ResumeProfileDocument;
if (!profileDocument) {
  throw new Error("Resume profile document helper is not available");
}

const RESUME_PROFILE_KEY = resumeStorage.keys.profile;
const RESUME_SCHEMA_VERSION_KEY = resumeStorage.keys.schemaVersion;
const RESUME_IMPORT_RAW_TEXT_KEY = resumeStorage.keys.rawText;

const BUILTIN_MODEL = modelStorage.DEFAULT_MODEL;

let isImporting = false;
let isResumeDirty = false;
let resumeProfile = schema.createEmptyResumeProfile();
const collapsedResumeSections = new Set();

document.addEventListener("DOMContentLoaded", async () => {
  initResumeEditorEvents();
  await initModels();
  await loadResumeProfile();
  await renderAssetManager();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" && areaName !== "sync") return;
  if (
    !changes[RESUME_PROFILE_KEY] &&
    !changes[RESUME_IMPORT_RAW_TEXT_KEY] &&
    !changes.resumeStructured &&
    !changes.resumeRawText
  ) {
    return;
  }

  if (isResumeDirty || isImporting) {
    return;
  }

  loadResumeProfile().catch((error) => {
    console.error("[resume-editor] 同步简历配置失败:", error);
  });
});

function initResumeEditorEvents() {
  importResumeDocumentBtn?.addEventListener("click", () => {
    resumeDocumentFileEl.value = "";
    resumeDocumentFileEl.click();
  });

  exportResumeDocumentBtn?.addEventListener("click", () => {
    exportPortableResumeDocument();
  });

  resumeDocumentFileEl?.addEventListener("change", async () => {
    const file = resumeDocumentFileEl.files?.[0];
    if (!file) return;
    await importPortableResumeDocument(file, resumeDocumentImportModeEl.value);
  });

  resumeNavEl.addEventListener("click", (event) => {
    const navBtn = event.target.closest("[data-resume-nav]");
    if (!navBtn) return;
    openResumeSection(navBtn.dataset.resumeNav, { scrollIntoView: true });
  });

  resumeFormHost.addEventListener("click", (event) => {
    const toggleBtn = event.target.closest("[data-section-toggle]");
    if (toggleBtn) {
      toggleResumeSection(toggleBtn.dataset.sectionToggle);
      return;
    }

    const addBtn = event.target.closest("[data-section-add]");
    if (addBtn) {
      addResumeListItem(addBtn.dataset.sectionAdd);
      return;
    }

    const removeBtn = event.target.closest("[data-section-remove]");
    if (removeBtn) {
      removeResumeListItem(
        removeBtn.dataset.sectionRemove,
        Number(removeBtn.dataset.itemIndex)
      );
    }
  });

  assetGridEl?.addEventListener("change", async (event) => {
    const input = event.target.closest("input[type='file'][data-asset-kind]");
    const file = input?.files?.[0];
    if (!input || !file) return;

    try {
      await assetStorage.saveAsset(input.dataset.assetKind, file);
      updatePageStatus("success", `已保存附件：${file.name}`);
      await renderAssetManager();
    } catch (error) {
      updatePageStatus("error", `附件保存失败：${error.message}`);
    }
  });

  assetGridEl?.addEventListener("click", async (event) => {
    const removeButton = event.target.closest("[data-remove-asset]");
    if (!removeButton) return;
    await assetStorage.removeAsset(removeButton.dataset.removeAsset);
    updatePageStatus("info", "已删除本机附件。");
    await renderAssetManager();
  });
}

async function renderAssetManager() {
  if (!assetGridEl) return;
  const records = await assetStorage.getAllAssets();
  const byKind = new Map(records.map((record) => [record.kind, record]));
  assetGridEl.replaceChildren();

  for (const definition of assetStorage.ASSET_KINDS) {
    const record = byKind.get(definition.id);
    const card = document.createElement("div");
    card.className = "asset-card";

    const copy = document.createElement("div");
    copy.className = "asset-card-copy";
    const title = document.createElement("div");
    title.className = "asset-card-title";
    title.textContent = definition.label;
    const meta = document.createElement("div");
    meta.className = "asset-card-meta";
    meta.textContent = record
      ? `${record.name} · ${formatAssetBytes(record.size)}`
      : "尚未配置";
    copy.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "asset-card-actions";
    const chooseLabel = document.createElement("label");
    chooseLabel.className = "btn btn-outline asset-choose-btn";
    chooseLabel.textContent = record ? "更换" : "选择文件";
    const input = document.createElement("input");
    input.type = "file";
    input.hidden = true;
    input.accept = definition.accept;
    input.dataset.assetKind = definition.id;
    chooseLabel.appendChild(input);
    actions.appendChild(chooseLabel);

    if (record) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn-text asset-remove-btn";
      remove.dataset.removeAsset = definition.id;
      remove.textContent = "删除";
      actions.appendChild(remove);
    }

    card.append(copy, actions);
    assetGridEl.appendChild(card);
  }
}

function formatAssetBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function exportPortableResumeDocument() {
  try {
    const currentProfile = syncResumeProfileFromForm();
    const text = profileDocument.serializeDocument({
      profile: currentProfile,
      schemaVersion: schema.version,
      extensionVersion: chrome.runtime.getManifest?.().version || "",
    });
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = profileDocument.buildFileName();
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    updatePageStatus("success", "便携简历文档已导出；附件、模型配置和 API Key 未包含在内。");
  } catch (error) {
    updatePageStatus("error", `简历文档导出失败：${error.message}`);
  }
}

async function importPortableResumeDocument(file, mode = "merge") {
  if (Number(file.size || 0) > 5 * 1024 * 1024) {
    updatePageStatus("error", "简历文档不能超过 5 MB。");
    return;
  }

  const replaceMode = mode === "replace";
  if (
    replaceMode &&
    !window.confirm("完全替换会清空当前文档中未出现在导入文件里的字段，确定继续吗？")
  ) {
    updatePageStatus("info", "已取消完全替换导入。");
    return;
  }

  importResumeDocumentBtn.disabled = true;
  exportResumeDocumentBtn.disabled = true;
  updatePageStatus("info", `正在${replaceMode ? "替换" : "合并"}导入便携简历文档...`);

  try {
    const parsed = profileDocument.parseDocument(await file.text(), {
      currentSchemaVersion: schema.version,
      normalizeProfile: schema.normalizeResumeProfile,
    });
    const currentProfile = syncResumeProfileFromForm();
    const nextProfile = replaceMode
      ? parsed.profile
      : schema.normalizeResumeProfile(
          profileDocument.mergeNonEmpty(currentProfile, parsed.profile)
        );

    resumeProfile = nextProfile;
    await resumeStorage.saveResumeData({
      profile: nextProfile,
      schemaVersion: schema.version,
      rawText: resumeImportTextEl.value.trim(),
    });

    resetCollapsedResumeSections();
    renderResumeEditor(nextProfile);
    isResumeDirty = false;
    saveResumeBtn.disabled = true;
    updatePageStatus(
      "success",
      `${replaceMode ? "替换" : "合并"}导入完成并已保存${parsed.sourceSchemaVersion && parsed.sourceSchemaVersion < schema.version ? `；已从 Schema v${parsed.sourceSchemaVersion} 迁移到 v${schema.version}` : ""}。`
    );
  } catch (error) {
    updatePageStatus("error", `简历文档导入失败：${error.message}`);
  } finally {
    importResumeDocumentBtn.disabled = false;
    exportResumeDocumentBtn.disabled = false;
  }
}

async function initModels() {
  await modelStorage.loadModelState();
}

async function getAllModels() {
  const state = await modelStorage.loadModelState();
  return [modelStorage.buildBuiltinModel(state.builtinOverride), ...state.models];
}

async function getActiveModel() {
  const state = await modelStorage.loadModelState();
  const models = await getAllModels();
  const activeId = state.activeModelId || BUILTIN_MODEL.id;
  return models.find((model) => model.id === activeId) || BUILTIN_MODEL;
}

function isModelConfigured(model) {
  return Boolean(model?.baseUrl && model?.apiKey && model?.model);
}

function resetCollapsedResumeSections() {
  collapsedResumeSections.clear();
  schema.sections.forEach((section) => collapsedResumeSections.add(section.key));
}

async function loadResumeProfile() {
  const data = await resumeStorage.loadResumeData();
  const sourceProfile = data.profile;

  resumeProfile = schema.normalizeResumeProfile(sourceProfile);
  resumeImportTextEl.value = data.rawText;
  resetCollapsedResumeSections();
  renderResumeEditor(resumeProfile);
  isResumeDirty = false;
  saveResumeBtn.disabled = true;
  updatePageStatus(
    "info",
    `已加载标准简历。当前共填写 ${countFilledSummaryItems(resumeProfile)} 个有效字段。`
  );
}

function renderResumeEditor(profile) {
  const sectionStats = buildResumeSectionStats(profile);

  renderResumeNav(sectionStats);
  resumeFormHost.innerHTML = "";

  for (const section of schema.sections) {
    const itemCount =
      section.type === "list" && Array.isArray(profile[section.key])
        ? profile[section.key].length
        : 0;
    const isCollapsed = collapsedResumeSections.has(section.key);
    const stats = sectionStats.get(section.key) || {
      totalFields: 0,
      filledFields: 0,
      itemCount,
      filledItems: 0,
    };
    const sectionEl = document.createElement("section");
    sectionEl.className = `resume-section${isCollapsed ? " is-collapsed" : ""}`;
    sectionEl.dataset.sectionKey = section.key;
    sectionEl.id = `resume-section-${section.key}`;

    const headEl = document.createElement("div");
    headEl.className = "resume-section-head";
    headEl.innerHTML = `
      <div class="resume-section-head-main">
        <button
          type="button"
          class="resume-section-toggle"
          data-section-toggle="${escapeHtml(section.key)}"
          aria-expanded="${isCollapsed ? "false" : "true"}"
        >
          <span class="resume-section-toggle-icon">▸</span>
          <span class="resume-section-heading">
            <span class="resume-section-title">${escapeHtml(section.label)}</span>
            <span class="resume-section-summary">${escapeHtml(
              createResumeSectionSummary(section, stats)
            )}</span>
          </span>
        </button>
        ${
          section.type === "list"
            ? `
              <div class="resume-section-actions">
                <button
                  type="button"
                  class="btn btn-outline btn-sm resume-section-action"
                  data-section-add="${escapeHtml(section.key)}"
                  ${itemCount >= section.slots ? "disabled" : ""}
                >
                  新增一条
                </button>
              </div>
            `
            : ""
        }
      </div>
      ${
        section.note
          ? `<div class="resume-section-note">${escapeHtml(section.note)}</div>`
          : ""
      }
    `;

    const bodyEl = document.createElement("div");
    bodyEl.className = "resume-section-body";

    if (section.type === "group") {
      bodyEl.appendChild(renderFieldGrid(section.fields, profile, section.key));
    } else {
      const items = Array.isArray(profile[section.key]) ? profile[section.key] : [];
      for (let slotIndex = 0; slotIndex < items.length; slotIndex += 1) {
        const slotEl = document.createElement("div");
        slotEl.className = "resume-slot";

        const slotHead = document.createElement("div");
        slotHead.className = "resume-slot-head";
        slotHead.innerHTML = `
          <div class="resume-slot-head-main">
            <div>
              <div class="resume-slot-title">${escapeHtml(
                `${section.itemLabel} ${slotIndex + 1}`
              )}</div>
              <div class="resume-slot-subtitle">${escapeHtml(
                `映射路径：${section.key}.${slotIndex}.*`
              )}</div>
            </div>
            ${
              items.length > schema.getListSectionMinItems(section)
                ? `
                  <button
                    type="button"
                    class="btn-text resume-slot-remove"
                    data-section-remove="${escapeHtml(section.key)}"
                    data-item-index="${slotIndex}"
                  >
                    删除
                  </button>
                `
                : ""
            }
          </div>
        `;

        slotEl.appendChild(slotHead);
        slotEl.appendChild(
          renderFieldGrid(section.fields, profile, `${section.key}.${slotIndex}`)
        );
        bodyEl.appendChild(slotEl);
      }
    }

    sectionEl.appendChild(headEl);
    sectionEl.appendChild(bodyEl);
    resumeFormHost.appendChild(sectionEl);
  }
}

function renderResumeNav(sectionStats) {
  resumeNavEl.innerHTML = "";

  for (const section of schema.sections) {
    const stats = sectionStats.get(section.key) || {
      totalFields: 0,
      filledFields: 0,
      itemCount: 0,
      filledItems: 0,
    };
    const hasValue =
      section.type === "list" ? stats.filledItems > 0 : stats.filledFields > 0;
    const isCollapsed = collapsedResumeSections.has(section.key);
    const buttonEl = document.createElement("button");
    buttonEl.type = "button";
    buttonEl.className = `resume-nav-btn${hasValue ? " has-value" : ""}${
      isCollapsed ? "" : " is-expanded"
    }`;
    buttonEl.dataset.resumeNav = section.key;
    buttonEl.innerHTML = `
      <span class="resume-nav-label">${escapeHtml(section.label)}</span>
      <span class="resume-nav-meta">${escapeHtml(
        createResumeNavSummary(section, stats)
      )}</span>
    `;
    resumeNavEl.appendChild(buttonEl);
  }
}

function renderFieldGrid(fields, profile, prefix) {
  const gridEl = document.createElement("div");
  gridEl.className = "resume-fields-grid";

  for (const field of fields) {
    const path = `${prefix}.${field.key}`;
    const fieldEl = document.createElement("div");
    fieldEl.className = "resume-field";

    const labelEl = document.createElement("label");
    labelEl.className = "resume-field-label";
    labelEl.textContent = field.label;

    const control = createFieldControl(field, schema.getValueByPath(profile, path), path);
    fieldEl.appendChild(labelEl);
    fieldEl.appendChild(control);
    gridEl.appendChild(fieldEl);
  }

  return gridEl;
}

function createFieldControl(field, value, path) {
  let control;

  if (field.input === "textarea") {
    control = document.createElement("textarea");
    control.className = "resume-textarea";
  } else if (field.input === "select") {
    control = document.createElement("select");
    control.className = "resume-select";
    for (const optionValue of field.options || []) {
      const optionEl = document.createElement("option");
      optionEl.value = optionValue;
      optionEl.textContent = optionValue || "请选择";
      control.appendChild(optionEl);
    }
  } else {
    control = document.createElement("input");
    control.className = "resume-input";
    control.type = field.input === "date" ? "text" : field.input || "text";
  }

  control.dataset.resumePath = path;
  control.value = value == null ? "" : String(value);
  if (field.placeholder || field.input === "date") {
    control.placeholder = field.placeholder || "YYYY-MM 或 YYYY-MM-DD";
  }

  control.addEventListener("input", markResumeDirty);
  control.addEventListener("change", markResumeDirty);
  return control;
}

function markResumeDirty() {
  isResumeDirty = true;
  saveResumeBtn.disabled = false;
  updatePageStatus("warning", "有未保存的修改，记得点击“保存标准简历”。");
}

function hasMeaningfulResumeValue(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulResumeValue(item));
  if (typeof value === "object") {
    return Object.values(value).some((item) => hasMeaningfulResumeValue(item));
  }
  return false;
}

function countFilledSummaryItems(profile) {
  return schema
    .getCatalogWithValues(profile)
    .filter((field) => field.hasValue && !field.derived).length;
}

function buildResumeSectionStats(profile) {
  const statsBySection = new Map();
  const catalog = schema.getCatalogWithValues(profile);

  for (const section of schema.sections) {
    const items = Array.isArray(profile[section.key]) ? profile[section.key] : [];
    statsBySection.set(section.key, {
      totalFields: 0,
      filledFields: 0,
      itemCount: items.length,
      filledItems: items.filter((item) => hasMeaningfulResumeValue(item)).length,
    });
  }

  for (const field of catalog) {
    const stats = statsBySection.get(field.sectionKey);
    if (!stats) continue;
    stats.totalFields += 1;
    if (field.hasValue) {
      stats.filledFields += 1;
    }
  }

  return statsBySection;
}

function createResumeSectionSummary(section, stats) {
  if (section.type === "list") {
    return `已添加 ${stats.itemCount} / ${section.slots} 条，已填写 ${stats.filledItems} 条`;
  }

  return `已填写 ${stats.filledFields} / ${stats.totalFields} 项`;
}

function createResumeNavSummary(section, stats) {
  if (section.type === "list") {
    return `${stats.filledItems}/${stats.itemCount} 条`;
  }

  return `${stats.filledFields}/${stats.totalFields} 项`;
}

function collectResumeProfileFromForm({ normalize = true } = {}) {
  const nextProfile = schema.createEmptyResumeProfile();
  const controls = resumeFormHost.querySelectorAll("[data-resume-path]");

  controls.forEach((control) => {
    schema.setValueByPath(
      nextProfile,
      control.dataset.resumePath,
      String(control.value || "").trim()
    );
  });

  return normalize ? schema.normalizeResumeProfile(nextProfile) : nextProfile;
}

function syncResumeProfileFromForm(options) {
  resumeProfile = collectResumeProfileFromForm(options);
  return resumeProfile;
}

function applyResumeSectionState(sectionKey) {
  const sectionEl = resumeFormHost.querySelector(`[data-section-key="${sectionKey}"]`);
  const navBtn = resumeNavEl.querySelector(`[data-resume-nav="${sectionKey}"]`);
  const isCollapsed = collapsedResumeSections.has(sectionKey);

  if (sectionEl) {
    sectionEl.classList.toggle("is-collapsed", isCollapsed);
    const toggleBtn = sectionEl.querySelector("[data-section-toggle]");
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    }
  }

  if (navBtn) {
    navBtn.classList.toggle("is-expanded", !isCollapsed);
  }
}

function toggleResumeSection(sectionKey) {
  if (!sectionKey) return;

  if (collapsedResumeSections.has(sectionKey)) {
    collapsedResumeSections.delete(sectionKey);
  } else {
    collapsedResumeSections.add(sectionKey);
  }

  applyResumeSectionState(sectionKey);
}

function openResumeSection(sectionKey, { scrollIntoView = false } = {}) {
  if (!sectionKey) return;

  collapsedResumeSections.delete(sectionKey);
  applyResumeSectionState(sectionKey);

  if (scrollIntoView) {
    const sectionEl = document.getElementById(`resume-section-${sectionKey}`);
    sectionEl?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function focusResumeField(path) {
  const control = resumeFormHost.querySelector(`[data-resume-path="${path}"]`);
  if (!control) return;

  control.focus();
  if (typeof control.select === "function") {
    control.select();
  }
}

function addResumeListItem(sectionKey) {
  const section = schema.getSectionDefinition(sectionKey);
  if (!section || section.type !== "list") return;

  const nextProfile = syncResumeProfileFromForm({ normalize: false });
  const items = Array.isArray(nextProfile[sectionKey]) ? [...nextProfile[sectionKey]] : [];
  if (items.length >= section.slots) return;

  items.push(schema.createEmptyListItem(sectionKey));
  resumeProfile = {
    ...nextProfile,
    [sectionKey]: items,
  };

  collapsedResumeSections.delete(sectionKey);
  renderResumeEditor(resumeProfile);
  markResumeDirty();

  const nextPath = `${sectionKey}.${items.length - 1}.${section.fields[0]?.key || ""}`;
  openResumeSection(sectionKey, { scrollIntoView: true });
  if (section.fields[0]?.key) {
    focusResumeField(nextPath);
  }
}

function removeResumeListItem(sectionKey, itemIndex) {
  const section = schema.getSectionDefinition(sectionKey);
  if (!section || section.type !== "list") return;

  const minItems = schema.getListSectionMinItems(section);
  const nextProfile = syncResumeProfileFromForm({ normalize: false });
  const items = Array.isArray(nextProfile[sectionKey]) ? [...nextProfile[sectionKey]] : [];

  if (items.length <= minItems) return;
  if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= items.length) return;

  items.splice(itemIndex, 1);
  resumeProfile = schema.normalizeResumeProfile({
    ...nextProfile,
    [sectionKey]: items,
  });

  collapsedResumeSections.delete(sectionKey);
  renderResumeEditor(resumeProfile);
  markResumeDirty();
  openResumeSection(sectionKey);
}

async function persistResumeProfile({ silent = false } = {}) {
  const nextProfile = collectResumeProfileFromForm();

  resumeProfile = nextProfile;
  await resumeStorage.saveResumeData({
    profile: nextProfile,
    schemaVersion: schema.version,
    rawText: resumeImportTextEl.value.trim(),
  });

  isResumeDirty = false;
  saveResumeBtn.disabled = true;
  updatePageStatus("success", "标准简历已保存，侧边栏自动填充会立即使用这份数据。");

  if (!silent) {
    document.title = "简历配置 - AI 简历填表助手";
  }
}

saveResumeBtn.addEventListener("click", async () => {
  await persistResumeProfile();
});

reloadResumeBtn.addEventListener("click", async () => {
  await loadResumeProfile();
  updatePageStatus("info", "已从扩展存储重新加载标准简历。");
});

importResumeBtn.addEventListener("click", async () => {
  await importResumeToSchema(resumeImportTextEl.value.trim());
});

uploadPdfBtn.addEventListener("click", () => {
  resumePdfFileEl.value = "";
  resumePdfFileEl.click();
});

resumePdfFileEl.addEventListener("change", async () => {
  const file = resumePdfFileEl.files?.[0];
  if (!file) return;

  if (file.type && file.type !== "application/pdf") {
    updatePageStatus("error", "请选择 PDF 文件。");
    return;
  }

  uploadPdfBtn.disabled = true;
  importResumeBtn.disabled = true;
  updatePageStatus("info", `正在提取 PDF 文本：${file.name}`);

  try {
    const text = await extractTextFromPdf(file);
    if (!text) {
      throw new Error("未提取到文本：如果是扫描版 PDF，请先转为可复制文字或使用 OCR");
    }

    resumeImportTextEl.value = text;
    await resumeStorage.saveRawText(text);

    updatePageStatus("success", "PDF 文本提取完成，开始导入到标准简历...");
    await importResumeToSchema(text);
  } catch (error) {
    updatePageStatus("error", `PDF 导入失败：${error.message}`);
  } finally {
    uploadPdfBtn.disabled = false;
    importResumeBtn.disabled = false;
  }
});

async function importResumeToSchema(rawText) {
  if (isImporting) return;

  const text = String(rawText || "").trim();
  if (!text) {
    updatePageStatus("warning", "请先粘贴原始简历文本，或上传 PDF。");
    return;
  }

  const activeModel = await getActiveModel();
  if (!isModelConfigured(activeModel)) {
    updatePageStatus("error", "请先在侧边栏的模型设置中配置可用模型。");
    return;
  }

  isImporting = true;
  importResumeBtn.disabled = true;
  uploadPdfBtn.disabled = true;
  importResumeBtn.textContent = "导入中...";
  updatePageStatus("info", "正在调用 AI 导入到标准简历...");

  try {
    const prompt = resumePrompts.buildResumeImportPrompt(
      schema,
      limitTextForPrompt(text)
    );
    const aiText = await aiClient.callAI(activeModel.id, prompt, "resume_import");
    const parsed = parseJsonFromAiText(aiText);
    const normalized = schema.normalizeResumeProfile(parsed);

    resumeProfile = normalized;
    await resumeStorage.saveResumeData({
      profile: normalized,
      schemaVersion: schema.version,
      rawText: text,
    });

    resetCollapsedResumeSections();
    renderResumeEditor(normalized);
    isResumeDirty = false;
    saveResumeBtn.disabled = true;

    updatePageStatus("success", "导入完成：已预填到标准简历，请检查后保存。");
  } catch (error) {
    updatePageStatus("error", `导入失败：${error.message}`);
  } finally {
    isImporting = false;
    importResumeBtn.disabled = false;
    uploadPdfBtn.disabled = false;
    importResumeBtn.textContent = "AI 导入到标准简历";
  }
}

function limitTextForPrompt(text) {
  const maxChars = 60000;
  if (text.length <= maxChars) return text;

  updatePageStatus(
    "warning",
    `文本过长（${text.length} 字），已截断前 ${maxChars} 字用于导入。`
  );
  return text.slice(0, maxChars);
}

async function extractTextFromPdf(file) {
  const pdfjs = getPdfJsLib();
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
      "libs/pdfjs/pdf.worker.min.js"
    );
  } catch (_) {
    // ignore
  }

  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;

  const total = pdf.numPages || 0;
  const parts = [];

  for (let pageNo = 1; pageNo <= total; pageNo += 1) {
    updatePageStatus("info", `正在解析 PDF (${pageNo}/${total})...`);
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();

    for (const item of content.items || []) {
      parts.push(item.str || "");
      parts.push(item.hasEOL ? "\n" : " ");
    }

    parts.push("\n\n");
  }

  return parts
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getPdfJsLib() {
  const lib = globalThis.pdfjsLib;
  if (!lib) {
    throw new Error("PDF 解析库未加载，请刷新页面后重试");
  }
  return lib;
}

function parseJsonFromAiText(text) {
  const trimmed = normalizeAiJsonInput(text);
  if (!trimmed) throw new Error("AI 返回为空");

  const direct = tryParseJsonVariants(trimmed);
  if (direct.ok) return direct.value;

  const noFences = trimmed
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const noFenceParsed = tryParseJsonVariants(noFences);
  if (noFenceParsed.ok) return noFenceParsed.value;

  for (const candidate of extractJsonCandidates(noFences)) {
    const parsed = tryParseJsonVariants(candidate);
    if (parsed.ok) return parsed.value;
  }

  throw new Error("无法解析 AI 返回的 JSON");
}

function normalizeAiJsonInput(text) {
  return String(text || "").replace(/^\uFEFF/, "").trim();
}

function tryParseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (_) {
    return { ok: false };
  }
}

function tryParseJsonVariants(text) {
  const candidates = [String(text || "").trim(), sanitizeLikelyJson(text)];
  const seen = new Set();

  for (const candidate of candidates) {
    const normalized = String(candidate || "").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);

    const parsed = tryParseJson(normalized);
    if (parsed.ok) return parsed;
  }

  return { ok: false };
}

function sanitizeLikelyJson(text) {
  return String(text || "")
    .trim()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1");
}

function extractJsonCandidates(text) {
  const candidates = [extractLikelyJson(text), extractBalancedJson(text)];
  return Array.from(
    new Set(candidates.map((item) => String(item || "").trim()).filter(Boolean))
  );
}

function extractLikelyJson(text) {
  const firstObj = text.indexOf("{");
  const lastObj = text.lastIndexOf("}");
  const firstArr = text.indexOf("[");
  const lastArr = text.lastIndexOf("]");

  const objCandidate =
    firstObj !== -1 && lastObj !== -1 && lastObj > firstObj
      ? text.slice(firstObj, lastObj + 1)
      : null;
  const arrCandidate =
    firstArr !== -1 && lastArr !== -1 && lastArr > firstArr
      ? text.slice(firstArr, lastArr + 1)
      : null;

  if (objCandidate && arrCandidate) {
    return firstObj < firstArr ? objCandidate : arrCandidate;
  }
  return objCandidate || arrCandidate || text;
}

function extractBalancedJson(text) {
  const source = String(text || "");
  let start = -1;
  let inString = false;
  let isEscaped = false;
  const stack = [];

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (start === -1) {
      if (char === "{" || char === "[") {
        start = index;
        stack.push(char);
      }
      continue;
    }

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }
      if (char === "\\") {
        isEscaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      const last = stack[stack.length - 1];
      const matchesPair =
        (last === "{" && char === "}") || (last === "[" && char === "]");

      if (!matchesPair) return "";

      stack.pop();
      if (stack.length === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return "";
}

function updatePageStatus(type, text) {
  if (!pageStatusEl) return;
  pageStatusEl.textContent = text;
  pageStatusEl.style.borderColor =
    type === "error"
      ? "rgba(239,68,68,0.28)"
      : type === "success"
        ? "rgba(16,185,129,0.28)"
        : type === "warning"
          ? "rgba(245,158,11,0.28)"
          : "var(--border)";
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
