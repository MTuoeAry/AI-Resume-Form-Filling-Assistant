const os = require("node:os");
const path = require("node:path");
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: path.resolve(__dirname),
  testMatch: "extension.spec.cjs",
  outputDir: path.join(os.tmpdir(), "resume-extension-playwright-results"),
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI ? [["line"], ["github"]] : "line",
});
