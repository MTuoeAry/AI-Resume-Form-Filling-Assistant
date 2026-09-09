(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.ResumeLogExport = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    const DB_NAME = "resume-log-export-db";
    const STORE_NAME = "handles";
    const PROJECT_ROOT_KEY = "project-root";
    const LOGS_DIR_NAME = "debug-logs";
    const MAX_LOG_FILES = 50;

    function compactText(value) {
      return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function sanitizeSegment(value, fallback = "unknown") {
      const text = compactText(value)
        .toLowerCase()
        .replace(/https?:\/\//g, "")
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      return text || fallback;
    }

    function formatFileTimestamp(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return "1970-01-01_00-00-00";
      }

      const pad = (num) => String(num).padStart(2, "0");
      return [
        date.getUTCFullYear(),
        "-",
        pad(date.getUTCMonth() + 1),
        "-",
        pad(date.getUTCDate()),
        "_",
        pad(date.getUTCHours()),
        "-",
        pad(date.getUTCMinutes()),
        "-",
        pad(date.getUTCSeconds()),
      ].join("");
    }

    function getHostFromUrl(url) {
      try {
        return new URL(String(url || "")).host || "unknown-host";
      } catch (_) {
        return "unknown-host";
      }
    }

    function sanitizeUrlForExport(value) {
      try {
        const url = new URL(String(value || ""));
        url.search = "";
        url.hash = "";
        return url.toString();
      } catch (_) {
        return "";
      }
    }

    function buildLogFileName(session) {
      const timestamp = formatFileTimestamp(session?.startedAt || Date.now());
      const host = sanitizeSegment(getHostFromUrl(session?.url || session?.tab?.url), "unknown-host");
      const title = sanitizeSegment(session?.title || session?.tab?.title, "resume-fill");
      const status = sanitizeSegment(session?.status, "unknown");
      return `${timestamp}_${host}_${title}-${status}.json`;
    }

    function sanitizeDiagnosticEvent(event) {
      if (!event || typeof event !== "object") return null;

      if (event.type === "field") {
        return {
          type: "field",
          fieldId: compactText(event.fieldId),
          ...(compactText(event.kind) ? { kind: compactText(event.kind) } : {}),
          ...(compactText(event.label) ? { label: compactText(event.label) } : {}),
          section: {
            key: compactText(event.section?.key),
            ...(compactText(event.section?.label)
              ? { label: compactText(event.section.label) }
              : {}),
            ...(compactText(event.section?.evidence)
              ? { evidence: compactText(event.section.evidence) }
              : {}),
            locked: Boolean(event.section?.locked),
            itemIndex: Number.isInteger(event.section?.itemIndex)
              ? event.section.itemIndex
              : null,
          },
        };
      }

      if (event.type === "decision") {
        return {
          type: "decision",
          fieldId: compactText(event.fieldId),
          label: compactText(event.label),
          sectionKey: compactText(event.sectionKey),
          sectionItemIndex: Number.isInteger(event.sectionItemIndex)
            ? event.sectionItemIndex
            : null,
          source: compactText(event.source),
          status: compactText(event.status),
          resumePath: compactText(event.resumePath),
          reason: compactText(event.reason),
          conflict: compactText(event.conflict),
          detail: compactText(event.detail),
        };
      }

      if (event.type === "record_flow") {
        return {
          type: "record_flow",
          sectionKey: compactText(event.sectionKey),
          sourceIndex: Number.isInteger(event.sourceIndex) ? event.sourceIndex : null,
          status: compactText(event.status),
          reason: compactText(event.reason),
          detail: compactText(event.detail),
        };
      }

      return null;
    }

    function createLogExportPayload(session) {
      const safeLogs = Array.isArray(session?.logs)
        ? session.logs.map((entry) => ({
            level: compactText(entry?.level) || "info",
            message: compactText(entry?.message),
            timestamp: entry?.timestamp || null,
            ...(sanitizeDiagnosticEvent(entry?.event)
              ? { event: sanitizeDiagnosticEvent(entry.event) }
              : {}),
          }))
        : [];

      return {
        sessionId: compactText(session?.id) || null,
        status: compactText(session?.status) || "unknown",
        startedAt: session?.startedAt || null,
        endedAt: session?.endedAt || null,
        exportedAt: new Date().toISOString(),
        errorMessage: session?.errorMessage || "",
        tab: {
          id: session?.tab?.id ?? null,
          url: sanitizeUrlForExport(session?.tab?.url),
          title: session?.tab?.title || "",
        },
        operation: {
          actionKey: compactText(session?.operation?.actionKey),
          fillMode: compactText(session?.operation?.fillMode),
          scope: compactText(session?.operation?.scope),
        },
        runtime: {
          extensionVersion: compactText(session?.runtime?.extensionVersion),
          expectedContentScriptVersion: compactText(
            session?.runtime?.expectedContentScriptVersion
          ),
        },
        stats: {
          fieldCount: Number(session?.stats?.fieldCount || 0),
          mappedCount: Number(session?.stats?.mappedCount || 0),
          filledCount: Number(session?.stats?.filledCount || 0),
        },
        logs: safeLogs,
      };
    }

    function supportsDirectoryPicker() {
      return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
    }

    function openDb() {
      return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
          reject(new Error("当前环境不支持 IndexedDB，无法保存目录授权"));
          return;
        }

        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(request.error || new Error("打开目录授权数据库失败"));
      });
    }

    async function withStore(mode, handler) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);

        let result;
        try {
          result = handler(store);
        } catch (error) {
          reject(error);
          return;
        }

        tx.oncomplete = () => {
          db.close();
          resolve(result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error || new Error("访问目录授权数据库失败"));
        };
      });
    }

    async function saveProjectRootHandle(handle) {
      await withStore("readwrite", (store) => {
        store.put(handle, PROJECT_ROOT_KEY);
      });
    }

    async function loadProjectRootHandle() {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(PROJECT_ROOT_KEY);
        request.onsuccess = () => {
          db.close();
          resolve(request.result || null);
        };
        request.onerror = () => {
          db.close();
          reject(request.error || new Error("读取目录授权失败"));
        };
      });
    }

    async function clearProjectRootHandle() {
      await withStore("readwrite", (store) => {
        store.delete(PROJECT_ROOT_KEY);
      });
    }

    async function getPermissionState(handle, { request = false, mode = "readwrite" } = {}) {
      if (!handle || typeof handle.queryPermission !== "function") {
        return "prompt";
      }

      let state = await handle.queryPermission({ mode });
      if (state !== "granted" && request && typeof handle.requestPermission === "function") {
        state = await handle.requestPermission({ mode });
      }
      return state;
    }

    async function ensureLogsDirectoryHandle(rootHandle) {
      if (!rootHandle || typeof rootHandle.getDirectoryHandle !== "function") {
        throw new Error("未配置项目目录");
      }

      if (String(rootHandle.name || "").toLowerCase() === LOGS_DIR_NAME) {
        return rootHandle;
      }

      return rootHandle.getDirectoryHandle(LOGS_DIR_NAME, { create: true });
    }

    async function writeSessionLogFile(rootHandle, session) {
      const dirHandle = await ensureLogsDirectoryHandle(rootHandle);
      const fileName = buildLogFileName(session);
      const payload = createLogExportPayload(session);
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();

      try {
        await writable.write(JSON.stringify(payload, null, 2));
      } finally {
        await writable.close();
      }

      await pruneLogFiles(dirHandle);

      return {
        fileName,
        relativePath: `${LOGS_DIR_NAME}/${fileName}`,
      };
    }

    async function pruneLogFiles(dirHandle, maxFiles = MAX_LOG_FILES) {
      if (!dirHandle?.entries) return;

      const files = [];
      for await (const [name, entry] of dirHandle.entries()) {
        if (entry?.kind === "file" && name.endsWith(".json")) {
          files.push(name);
        }
      }

      files.sort();
      const staleFiles = files.slice(0, Math.max(0, files.length - maxFiles));
      for (const name of staleFiles) {
        await dirHandle.removeEntry(name);
      }
    }

    return {
      LOGS_DIR_NAME,
      buildLogFileName,
      createLogExportPayload,
      sanitizeUrlForExport,
      supportsDirectoryPicker,
      saveProjectRootHandle,
      loadProjectRootHandle,
      clearProjectRootHandle,
      getPermissionState,
      ensureLogsDirectoryHandle,
      writeSessionLogFile,
    };
  }
);
