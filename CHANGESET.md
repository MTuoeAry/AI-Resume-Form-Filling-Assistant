# 上游多简历模板合并清单

本文件记录 2026-09-07 从上游选择性合入多简历模板能力的实际范围，不代替 Git diff。

## 合并基线

- 当前仓库基线：`84f53ce`（泛化字段映射与填充改造）。
- 上游来源：`https://github.com/1lck/AI-Resume-Form-Filling-Assistant.git`。
- 上游提交：`76c052d`，包含 4 个相对共同基点的新提交。
- 合并前安全分支：`backup/pre-upstream-merge-20260907`，指向 `84f53ce`。
- 合并策略：保留现有 Schema v7、映射缓存 V13 和 `.airesume.json`，吸收多模板管理及全部模板备份；没有使用上游文件覆盖当前实现。

## 本次合入内容

| 文件 | 变更 |
| --- | --- |
| `popup.html` / `popup.css` / `popup.js` | 增加填充模板选择器，以及模板的新建、复制、重命名、删除、全部导入导出。 |
| `resume-editor.html` / `resume-editor.css` / `resume-editor.js` | 在独立配置页增加活动模板管理，并让 `.airesume.json` 导入写入当前模板。 |
| `shared/resume-storage.js` | 增加多模板 CRUD、活动模板、全部模板备份、旧数据迁移、格式校验和数量限制。 |
| `tests/resume-storage.test.js` | 覆盖多模板 CRUD、备份往返、旧数据迁移、回退快照和损坏存储恢复。 |
| `README.md` | 记录 Schema v7、多模板、单份文档与全部模板备份的边界。 |
| `HANDOFF.md` / `PROJECT_LESSONS.md` | 更新项目状态，并记录存储迁移的回退兼容原则。 |

## 与上游不同的决策

- 不保留上游重复的“当前简历普通 JSON”界面；单份简历继续使用版本化 `.airesume.json`。
- 全部模板使用 `resume-templates` 备份包装，文件名以 `.airesume-templates.json` 结尾。
- 全部模板备份包含各模板的原始简历文本，但不包含附件、模型配置或 API Key。
- 导入文件限制为 10 MB、最多 50 个模板，并拒绝错误类型和未来版本。
- 迁移后不删除当前版旧单简历键，而是持续镜像活动模板，便于降级读取；更早期废弃键仍会清理。
- 保留 `fieldMappingCacheV13`，未接受上游较旧的 V3 缓存键。

## 验证状态

- `node --check popup.js`：通过。
- `node --check resume-editor.js`：通过。
- `node --check shared/resume-storage.js`：通过。
- `npm test`：158/158 通过。
- 浏览器 UI 实测：待确认。
- 真实招聘网站回归：待确认。

## 提交后建议

```powershell
git status --short
git log -3 --oneline --decorate
git show --stat --oneline HEAD
git push origin master
```

推送、打标签和发布扩展包需要由用户决定；本次合并不自动执行这些外部操作。
