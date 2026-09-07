# 本次长任务候选提交清单

本文件用于把当前未提交修改整理成可审阅、可提交到 GitHub 的变更集，不代替 Git diff。

## 基线和范围

- 分支：`master`
- 基准提交：`6726518`（同时为当前 `origin/master`）
- 目标版本：`1.2.7`
- 当前修改均尚未提交。
- 由于没有保存本次长任务开始前的 `git status` 快照，无法仅凭 Git 100% 证明每一行差异的作者。已逐项核对，当前差异内容与本次对话中的需求和修复高度一致；提交前仍应人工浏览 `git diff`。
- 不应提交用户简历、论文、奖项材料、API Key、下载目录文件或 `debug-logs`。这些文件目前不在本清单中。

## 代码改动

| 文件 | 候选提交内容 |
| --- | --- |
| `manifest.json` | 扩展版本升级到 1.2.7。 |
| `package.json` | 包版本同步到 1.2.7。 |
| `background.js` | 映射提示词允许 work-only 页面临时承载实习，同时禁止改变数据事实类型。 |
| `popup.js` | 映射缓存 V13；记录操作/运行版本；请求响应执行模式与 content script 版本校验。 |
| `resume-editor.js` | 已填字段统计排除 derived 字段，避免重复计数。 |
| `content.js` | 通用卡片编辑发现、重复区块准备、work-only 投影、增量锚点对齐、复合选择器扫描、日期精度、布尔“至今”、映射门禁、失败回滚、运行诊断等。 |
| `shared/content-bridge.js` | 内容脚本握手版本升级到 semantic-type-guards-v13。 |
| `shared/field-semantics.js` | 完整字段/区块语义、本地确定性映射、强类型兼容、歧义上下文拒绝、工作-only 来源投影。 |
| `shared/fill-runtime.js` | 日期控件类型、精度和独立年月日组件识别。 |
| `shared/log-export.js` | 日志加入运行元数据；避免 `debug-logs/debug-logs` 重复嵌套。 |
| `shared/resume-schema.js` | Schema v7、新校招字段、0 条列表、派生最高学历/英语证书/成果类别、旧数据迁移。 |
| `shared/site-adapters.js` | 通用重复区块标题；美的规则收紧；增加北森/Zhiye/iTalent 轻量平台适配器。 |

## 测试改动

修改的现有测试：

- `tests/background-prompt.test.js`
- `tests/content-fill-helpers.test.js`
- `tests/content-fill-modes.test.js`
- `tests/content-payload.test.js`
- `tests/content-security.test.js`
- `tests/date-picker-runtime.test.js`
- `tests/field-semantics.test.js`
- `tests/fill-runtime.test.js`
- `tests/generic-repeat-index.test.js`
- `tests/log-export.test.js`
- `tests/popup-injection.test.js`
- `tests/repeat-section-count.test.js`
- `tests/resume-schema.test.js`
- `tests/site-adapters.test.js`

新增测试：

- `tests/card-editor-discovery.test.js`
- `tests/composite-picker-runtime.test.js`
- `tests/date-target-shape.test.js`
- `tests/incremental-repeat-alignment.test.js`
- `tests/schema-semantic-coverage.test.js`

## 收尾文档

- `HANDOFF.md`：项目当前状态和下一步。
- `TASK_RETROSPECTIVE.md`：本次被纠正问题的原因分析。
- `PROJECT_LESSONS.md`：可复用的项目经验。
- `CHANGESET.md`：本提交清单。

## 建议提交前检查

```powershell
git status --short
git diff --check
git diff --stat
npm test

Get-ChildItem -Recurse -Filter *.js |
  Where-Object { $_.FullName -notmatch '\\node_modules\\' } |
  ForEach-Object { node --check $_.FullName }

node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
```

还应执行一次真实浏览器验收，并确认新日志显示：

- extension version：`1.2.7`
- content script version：`2026-09-03-semantic-type-guards-v13`
- mapping cache：`fieldMappingCacheV13`

## 建议提交方式

这些源代码与测试相互依赖，建议在真实网页验收后作为一个功能提交：

```powershell
$changeFiles = @(
  "background.js", "content.js", "manifest.json", "package.json", "popup.js", "resume-editor.js",
  "shared/content-bridge.js", "shared/field-semantics.js", "shared/fill-runtime.js",
  "shared/log-export.js", "shared/resume-schema.js", "shared/site-adapters.js",
  "tests/background-prompt.test.js", "tests/content-fill-helpers.test.js",
  "tests/content-fill-modes.test.js", "tests/content-payload.test.js",
  "tests/content-security.test.js", "tests/date-picker-runtime.test.js",
  "tests/field-semantics.test.js", "tests/fill-runtime.test.js",
  "tests/generic-repeat-index.test.js", "tests/log-export.test.js",
  "tests/popup-injection.test.js", "tests/repeat-section-count.test.js",
  "tests/resume-schema.test.js", "tests/site-adapters.test.js",
  "tests/card-editor-discovery.test.js", "tests/composite-picker-runtime.test.js",
  "tests/date-target-shape.test.js", "tests/incremental-repeat-alignment.test.js",
  "tests/schema-semantic-coverage.test.js",
  "HANDOFF.md", "TASK_RETROSPECTIVE.md", "PROJECT_LESSONS.md", "CHANGESET.md"
)
git add -- $changeFiles
git diff --cached --check
git diff --cached --stat
git commit -m "feat: harden generalized resume form filling"
git push origin master
```

如果仓库不允许直接推送 `master`，应先按仓库协作规则创建功能分支；当前仓库未发现对应规则文件，具体分支策略待确认。
