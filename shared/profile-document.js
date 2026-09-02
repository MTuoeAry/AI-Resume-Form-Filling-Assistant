(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ResumeProfileDocument = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const DOCUMENT_FORMAT = "ai-resume-profile";
  const DOCUMENT_VERSION = 1;
  const FILE_SUFFIX = ".airesume.json";

  function clone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function isMeaningfulValue(value) {
    if (value == null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number" || typeof value === "boolean") return true;
    if (Array.isArray(value)) return value.some(isMeaningfulValue);
    if (typeof value === "object") return Object.values(value).some(isMeaningfulValue);
    return false;
  }

  function mergeNonEmpty(baseValue, importedValue) {
    if (!isMeaningfulValue(importedValue)) return clone(baseValue);

    if (Array.isArray(importedValue)) {
      const baseItems = Array.isArray(baseValue) ? baseValue : [];
      const merged = baseItems.map(clone);
      for (let index = 0; index < importedValue.length; index += 1) {
        const importedItem = importedValue[index];
        if (!isMeaningfulValue(importedItem)) continue;
        merged[index] = mergeNonEmpty(baseItems[index], importedItem);
      }
      return merged;
    }

    if (importedValue && typeof importedValue === "object") {
      const baseObject =
        baseValue && typeof baseValue === "object" && !Array.isArray(baseValue)
          ? baseValue
          : {};
      const merged = { ...clone(baseObject) };
      for (const [key, value] of Object.entries(importedValue)) {
        if (!isMeaningfulValue(value)) continue;
        merged[key] = mergeNonEmpty(baseObject[key], value);
      }
      return merged;
    }

    return clone(importedValue);
  }

  function createDocument({ profile, schemaVersion, extensionVersion = "" }) {
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
      throw new Error("标准简历不是有效对象");
    }
    return {
      format: DOCUMENT_FORMAT,
      documentVersion: DOCUMENT_VERSION,
      schemaVersion: Number(schemaVersion) || 0,
      exportedAt: new Date().toISOString(),
      generator: {
        name: "AI Resume Form Filling Assistant",
        version: String(extensionVersion || ""),
      },
      profile: clone(profile),
    };
  }

  function serializeDocument(options) {
    return `${JSON.stringify(createDocument(options), null, 2)}\n`;
  }

  function parseDocument(text, { currentSchemaVersion, normalizeProfile } = {}) {
    let parsed;
    try {
      parsed = JSON.parse(String(text || ""));
    } catch (_) {
      throw new Error("文档不是有效 JSON");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("文档根节点必须是对象");
    }

    const wrapped = Object.prototype.hasOwnProperty.call(parsed, "format");
    if (wrapped && parsed.format !== DOCUMENT_FORMAT) {
      throw new Error(`不支持的文档格式：${String(parsed.format || "未知")}`);
    }
    if (wrapped && Number(parsed.documentVersion || 0) > DOCUMENT_VERSION) {
      throw new Error("文档格式版本高于当前插件，请先升级插件");
    }

    const profile = wrapped ? parsed.profile : parsed;
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
      throw new Error("文档缺少有效的 profile 对象");
    }

    const sourceSchemaVersion = wrapped ? Number(parsed.schemaVersion || 0) : 0;
    const supportedSchemaVersion = Number(currentSchemaVersion || 0);
    if (supportedSchemaVersion && sourceSchemaVersion > supportedSchemaVersion) {
      throw new Error(
        `文档 Schema v${sourceSchemaVersion} 高于当前支持的 v${supportedSchemaVersion}，请先升级插件`
      );
    }

    return {
      profile:
        typeof normalizeProfile === "function"
          ? normalizeProfile(clone(profile))
          : clone(profile),
      sourceSchemaVersion,
      wrapped,
    };
  }

  function buildFileName(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `ai-resume-profile-${year}${month}${day}${FILE_SUFFIX}`;
  }

  return {
    DOCUMENT_FORMAT,
    DOCUMENT_VERSION,
    FILE_SUFFIX,
    isMeaningfulValue,
    mergeNonEmpty,
    createDocument,
    serializeDocument,
    parseDocument,
    buildFileName,
  };
});
