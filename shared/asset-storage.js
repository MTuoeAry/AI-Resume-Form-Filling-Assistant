(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ResumeAssetStorage = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const DB_NAME = "ai-resume-assets";
  const DB_VERSION = 1;
  const STORE_NAME = "assets";
  const MAX_TOTAL_BYTES = 16 * 1024 * 1024;
  const ASSET_KINDS = [
    { id: "photo", label: "个人照片", accept: "image/*" },
    { id: "resume", label: "简历附件", accept: ".pdf,.doc,.docx" },
    { id: "portfolio", label: "相关作品 / 附件", accept: ".pdf,.doc,.docx,.zip,image/*" },
  ];

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "kind" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("附件存储打开失败"));
    });
  }

  async function runTransaction(mode, callback) {
    const db = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        let result;
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error || new Error("附件存储失败"));
        transaction.onabort = () => reject(transaction.error || new Error("附件存储已取消"));
        result = callback(store);
      });
    } finally {
      db.close();
    }
  }

  async function saveAsset(kind, file) {
    const normalizedKind = String(kind || "").trim();
    if (!ASSET_KINDS.some((item) => item.id === normalizedKind)) {
      throw new Error("未知附件类型");
    }
    if (!(file instanceof Blob) || !file.size) throw new Error("附件为空");
    if (file.size > MAX_TOTAL_BYTES) throw new Error("单个附件不能超过 16 MB");

    const record = {
      kind: normalizedKind,
      name: String(file.name || `${normalizedKind}.bin`).slice(0, 180),
      type: String(file.type || "application/octet-stream").slice(0, 120),
      size: file.size,
      updatedAt: Date.now(),
      blob: file,
    };
    await runTransaction("readwrite", (store) => store.put(record));
    return { ...record, blob: undefined };
  }

  async function getAllAssets() {
    const db = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error || new Error("附件读取失败"));
      });
    } finally {
      db.close();
    }
  }

  async function removeAsset(kind) {
    await runTransaction("readwrite", (store) => store.delete(String(kind || "")));
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }

  async function getSerializableAssets() {
    const records = await getAllAssets();
    const totalBytes = records.reduce((sum, record) => sum + Number(record.size || 0), 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error("附件总大小超过 16 MB，请删除不需要的附件后重试");
    }
    return Promise.all(
      records.map(async (record) => ({
        kind: record.kind,
        name: record.name,
        type: record.type,
        size: record.size,
        dataBase64: arrayBufferToBase64(await record.blob.arrayBuffer()),
      }))
    );
  }

  return {
    ASSET_KINDS,
    MAX_TOTAL_BYTES,
    saveAsset,
    getAllAssets,
    getSerializableAssets,
    removeAsset,
  };
});
