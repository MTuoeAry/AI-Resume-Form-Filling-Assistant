const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { test, expect, chromium } = require("@playwright/test");

const EXTENSION_ROOT = path.resolve(__dirname, "../..");
const FIXTURE_DIR = path.join(__dirname, "fixtures");
const CONTENT_SCRIPT_VERSION = require("../../shared/content-bridge").CONTENT_SCRIPT_VERSION;

const CONTENT_SCRIPT_FILES = [
  "shared/resume-schema.js",
  "shared/diagnostics.js",
  "shared/field-text.js",
  "shared/field-concepts.js",
  "shared/mapping-policy.js",
  "shared/field-semantics.js",
  "shared/page-structure.js",
  "shared/repeat-alignment.js",
  "shared/repeat-flow.js",
  "shared/fill-runtime.js",
  "shared/site-adapters.js",
  "shared/content-bridge.js",
  "shared/ai-client.js",
  "content.js",
];

function findSystemChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    process.platform === "win32" &&
      path.join(process.env.PROGRAMFILES || "", "Google", "Chrome", "Application", "chrome.exe"),
    process.platform === "win32" &&
      path.join(process.env["PROGRAMFILES(X86)"] || "", "Google", "Chrome", "Application", "chrome.exe"),
    process.platform === "win32" &&
      path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
    process.platform === "darwin" &&
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    process.platform === "linux" && "/usr/bin/google-chrome",
    process.platform === "linux" && "/usr/bin/google-chrome-stable",
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function startFixtureServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const name = path.basename(url.pathname);
    const filePath = path.join(FIXTURE_DIR, name);
    if (!name.endsWith(".html") || !fs.existsSync(filePath)) {
      response.writeHead(404).end();
      return;
    }

    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(fs.readFileSync(filePath));
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        origin: `http://127.0.0.1:${address.port}`,
        url: `http://127.0.0.1:${address.port}/form.html`,
      });
    });
  });
}

async function waitForExtensionWorker(context) {
  const existing = context
    .serviceWorkers()
    .find((worker) => worker.url().startsWith("chrome-extension://"));
  if (existing) return existing;

  return context.waitForEvent("serviceworker", {
    predicate: (worker) => worker.url().startsWith("chrome-extension://"),
    timeout: 20_000,
  });
}

test.describe.configure({ mode: "serial" });

test.describe("真实 Chrome unpacked extension", () => {
  let context;
  let extensionId;
  let serviceWorker;
  let fixtureServer;
  let fixtureUrl;
  let fixtureOrigin;
  let modelApiRequestCount = 0;
  let userDataDir;

  test.beforeAll(async () => {
    const chromeExecutable = findSystemChrome();
    if (!chromeExecutable) {
      throw new Error(
        "未找到系统 Google Chrome；请安装 Chrome 或通过 CHROME_PATH 指定可执行文件"
      );
    }

    const fixture = await startFixtureServer();
    fixtureServer = fixture.server;
    fixtureUrl = fixture.url;
    fixtureOrigin = fixture.origin;
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-extension-e2e-"));

    context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: chromeExecutable,
      headless: process.env.PLAYWRIGHT_HEADLESS === "1",
      ignoreDefaultArgs: ["--disable-extensions"],
      args: [
        "--enable-unsafe-extension-debugging",
        "--no-first-run",
        "--disable-default-apps",
        ...(process.env.CI ? ["--no-sandbox"] : []),
      ],
    });
    context.on("request", (request) => {
      if (/deepseek|openai|chat\/completions/i.test(request.url())) {
        modelApiRequestCount += 1;
      }
    });

    const browserSession = await context.browser().newBrowserCDPSession();
    const loadedExtension = await browserSession.send(
      "Extensions.loadUnpacked",
      { path: EXTENSION_ROOT }
    );
    extensionId = loadedExtension.id;
    await browserSession.detach();

    const wakePage = await context.newPage();
    await wakePage.goto(`chrome-extension://${extensionId}/popup.html`);
    await wakePage.evaluate(() =>
      chrome.runtime.sendMessage({ action: "e2eWakeServiceWorker" })
    );
    serviceWorker = await waitForExtensionWorker(context);
    expect(new URL(serviceWorker.url()).host).toBe(extensionId);
    await wakePage.close();
  });

  test.afterAll(async () => {
    await context?.close();
    await new Promise((resolve) => fixtureServer?.close(resolve) || resolve());
    if (userDataDir) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });

  test("启动 MV3 service worker 并真实写读 chrome.storage.local", async () => {
    expect(serviceWorker.url()).toBe(
      `chrome-extension://${extensionId}/background.js`
    );

    const runtimeState = await serviceWorker.evaluate(async () => {
      const key = "e2eStorageProbe";
      const value = {
        candidate: "虚构候选人",
        networkModelCalls: 0,
      };
      await chrome.storage.local.set({ [key]: value });
      const stored = await chrome.storage.local.get(key);
      const manifest = chrome.runtime.getManifest();
      return {
        stored: stored[key],
        manifestVersion: manifest.manifest_version,
        sidePanelPath: manifest.side_panel?.default_path,
      };
    });

    expect(runtimeState).toEqual({
      stored: {
        candidate: "虚构候选人",
        networkModelCalls: 0,
      },
      manifestVersion: 3,
      sidePanelPath: "popup.html",
    });
  });

  test("从 popup 源码动态注入 shared 脚本与 content.js", async () => {
    const popupSource = fs.readFileSync(
      path.join(EXTENSION_ROOT, "popup.js"),
      "utf8"
    );
    for (const scriptFile of CONTENT_SCRIPT_FILES) {
      expect(popupSource).toContain(`"${scriptFile}"`);
    }

    const targetPage = await context.newPage();
    await targetPage.goto(fixtureUrl);

    const targetTabId = await serviceWorker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({});
      return tabs.find((tab) => tab.url === url)?.id;
    }, fixtureUrl);
    expect(targetTabId).toBeTruthy();

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popupPage.locator("#startFillBtn")).toBeVisible();
    await popupPage.waitForFunction(
      () => typeof window.injectContentScript === "function"
    );

    const injected = await popupPage.evaluate(
      (tabId) => window.injectContentScript(tabId),
      targetTabId
    );
    expect(injected).toBe(true);

    const probe = await serviceWorker.evaluate(async (tabId) => {
      const pong = await chrome.tabs.sendMessage(tabId, { action: "ping" });
      const [{ result: modules }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => ({
          contentLoaded: window.__AI_RESUME_AUTOFILL_LOADED__ === true,
          resumeSchema: Boolean(window.ResumeSchema),
          diagnostics: Boolean(window.ResumeDiagnostics),
          fieldText: Boolean(window.ResumeFieldText),
          fieldSemantics: Boolean(window.ResumeFieldSemantics),
          pageStructure: Boolean(window.ResumePageStructure),
          repeatAlignment: Boolean(window.ResumeRepeatAlignment),
          repeatFlow: Boolean(window.ResumeRepeatFlow),
          fillRuntime: Boolean(window.ResumeFillRuntime),
          siteAdapters: Boolean(window.ResumeSiteAdapters),
          contentBridge: Boolean(window.ResumeContentBridge),
          aiClient: Boolean(window.ResumeAiClient),
        }),
      });
      return { pong, modules };
    }, targetTabId);

    expect(probe.pong).toEqual({
      success: true,
      version: CONTENT_SCRIPT_VERSION,
      capabilities: { fullDiagnostics: true },
    });
    expect(Object.values(probe.modules).every(Boolean)).toBe(true);

    await popupPage.close();
    await targetPage.close();
  });

  test("发送 startFill 后填写最终 DOM，保持当前握手版本且不提交", async () => {
    const page = await context.newPage();
    await page.goto(fixtureUrl);

    const tabId = await serviceWorker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({});
      return tabs.find((tab) => tab.url === url)?.id;
    }, fixtureUrl);
    expect(tabId).toBeTruthy();

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForFunction(
      () => typeof window.injectContentScript === "function"
    );
    expect(
      await popupPage.evaluate(
        (targetTabId) => window.injectContentScript(targetTabId),
        tabId
      )
    ).toBe(true);

    const response = await serviceWorker.evaluate(
      ({ targetTabId }) =>
        chrome.tabs.sendMessage(targetTabId, {
          action: "startFill",
          modelId: "",
          resumeProfile: {
            personal: {
              fullName: "林测试",
              email: "lin.test@example.invalid",
            },
          },
          resumeAssets: [],
          fillMode: "overwrite",
          scope: "page",
          actionKey: "overwritePage",
          requestId: "e2e-start-fill",
        }),
      { targetTabId: tabId }
    );

    expect(response.success).toBe(true);
    expect(response.filledCount).toBe(2);
    expect(response.execution).toMatchObject({
      requestId: "e2e-start-fill",
      actionKey: "overwritePage",
      fillMode: "overwrite",
      scope: "page",
      contentScriptVersion: CONTENT_SCRIPT_VERSION,
    });
    await expect(page.locator("#full-name")).toHaveValue("林测试");
    await expect(page.locator("#email")).toHaveValue(
      "lin.test@example.invalid"
    );
    expect(await page.evaluate(() => window.__submitCount)).toBe(0);
    expect(modelApiRequestCount).toBe(0);

    await popupPage.close();
    await page.close();
  });

  test("逐条教育经历：填完第一条后才新增，且不点击提交申请", async () => {
    const gatedUrl = `${fixtureOrigin}/gated-education.html`;
    const page = await context.newPage();
    await page.goto(gatedUrl);

    const tabId = await serviceWorker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({});
      return tabs.find((tab) => tab.url === url)?.id;
    }, gatedUrl);
    expect(tabId).toBeTruthy();

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForFunction(
      () => typeof window.injectContentScript === "function"
    );
    expect(
      await popupPage.evaluate(
        (targetTabId) => window.injectContentScript(targetTabId),
        tabId
      )
    ).toBe(true);

    const response = await serviceWorker.evaluate(
      ({ targetTabId }) =>
        chrome.tabs.sendMessage(targetTabId, {
          action: "startFill",
          modelId: "",
          resumeProfile: {
            educations: [
              { school: "First University", startDate: "2020-09" },
              { school: "Second University", startDate: "2024-09" },
            ],
          },
          resumeAssets: [],
          fillMode: "overwrite",
          scope: "page",
          actionKey: "overwritePage",
          requestId: "e2e-gated-education",
        }),
      { targetTabId: tabId }
    );

    expect(response.success).toBe(true);
    expect(response.execution.contentScriptVersion).toBe(CONTENT_SCRIPT_VERSION);
    expect(await page.evaluate(() => window.__submitClicks)).toBe(0);
    expect(await page.evaluate(() => window.__addClicks)).toBe(1);
    await expect(page.locator(".saved-card strong").first()).toHaveText(
      "First University"
    );
    await expect(page.locator("#school")).toHaveValue("Second University");

    await popupPage.close();
    await page.close();
  });

  test("holdout 英文学历：Done 保存后再新增，不点击 Submit application", async () => {
    const holdoutUrl = `${fixtureOrigin}/holdout-education.html`;
    const page = await context.newPage();
    await page.goto(holdoutUrl);

    const tabId = await serviceWorker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({});
      return tabs.find((tab) => tab.url === url)?.id;
    }, holdoutUrl);
    expect(tabId).toBeTruthy();

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForFunction(
      () => typeof window.injectContentScript === "function"
    );
    expect(
      await popupPage.evaluate(
        (targetTabId) => window.injectContentScript(targetTabId),
        tabId
      )
    ).toBe(true);

    const response = await serviceWorker.evaluate(
      ({ targetTabId }) =>
        chrome.tabs.sendMessage(targetTabId, {
          action: "startFill",
          modelId: "",
          resumeProfile: {
            educations: [
              { school: "First University", startDate: "2020-09" },
              { school: "Second University", startDate: "2024-09" },
            ],
          },
          resumeAssets: [],
          fillMode: "overwrite",
          scope: "page",
          actionKey: "overwritePage",
          requestId: "e2e-holdout-education",
        }),
      { targetTabId: tabId }
    );

    expect(response.success).toBe(true);
    expect(await page.evaluate(() => window.__submitClicks)).toBe(0);
    expect(await page.evaluate(() => window.__saveClicks)).toBeGreaterThanOrEqual(1);
    await expect(page.locator(".saved-card strong").first()).toHaveText(
      "First University"
    );
    await expect(page.locator("#school")).toHaveValue("Second University");

    await popupPage.close();
    await page.close();
  });

  test("独立加载 popup.html，保留 side panel 自动化边界", async () => {
    test.info().annotations.push({
      type: "side-panel-boundary",
      description:
        "Playwright 不能枚举 Chrome side-panel WebContents；独立加载同一 popup.html 源码验证入口。",
    });

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popupPage.locator("#startFillBtn")).toBeAttached();
    await expect(popupPage.locator("#tabs")).toBeVisible();
    expect(await popupPage.evaluate(() => chrome.runtime.id)).toBe(extensionId);
    await popupPage.close();
  });
});
