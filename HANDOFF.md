# 项目交接：当前基线与接手入口

核对日期：2026-09-09（Asia/Shanghai）。本文件描述当前工作区，不代表已发布版本。优先级统一维护在 [ROADMAP.md](ROADMAP.md)，不要把历史记录中的版本和测试数量当作当前状态。

## 1. 产品目标

让用户维护标准简历，在尽可能多的招聘网站上可靠复用。扩展先识别页面区块、具体经历、字段角色和控件，再选择相应简历事实，执行填写并验证结果；信息不足时保留空白、说明原因，由用户复核并提交。

中国移动页面的 `educationInfo` 是教育区块的有用证据，但还需区分开始/结束时间、学历/学位，以及第几条教育经历。其他网站可能只有标题、ARIA 名称或重复卡片；`workInfo` 下的标题也可能实际是“实习经历”。要改进共同识别能力，不能依赖每个网址的固定字段表。

目标架构是“通用结构识别 → 条目对齐 → 受约束的语义映射 → 控件执行 → 结果验证”。平台适配器补充特有结构，AI 补充无法确定的映射。此方向已部分实现，弱结构识别、动态条目和复杂控件仍需跨站验证。

## 2. 当前工作区基线

字段映射可靠性的需求与验收仍以 [MAPPING_RELIABILITY_IMPLEMENTATION.md](MAPPING_RELIABILITY_IMPLEMENTATION.md) 为准。代码已有概念词典、映射校验、语言考试字段、来源对齐，以及决策展示和概念记忆保存/删除。完整的字段级人工改选、证据冲突处理和跨布局验收仍需按规范逐项核实，不能把模块存在或 Node 测试通过等同于 A–E 全部完成。此前执行记录与未测边界见该文档第 14 节。

| 项目 | 核对结果 / 事实来源 |
| --- | --- |
| 历史合并基线 | `c0421ee`，上游多模板与备份合并；当前修订以 `git log -1` 为准 |
| 扩展版本 | `1.3.0`，`manifest.json`、`package.json` |
| 简历 Schema | v11，`shared/resume-schema.js`；语言能力新增 `examType` / `examLevel` / `scoreValue` / `scoreScale` / `cefrLevel`，保留 `testScore` 原文 |
| 映射缓存 | `fieldMappingCacheV15`，`content.js`、`popup.js`；缓存键包含语义规则版本 |
| 字段概念记忆 | `fieldConceptMemoryV1`，仅在用户点击“记住此类字段”后保存 origin + 表单指纹 + 标签 + 选项域 |
| 内容脚本握手 | `2026-09-09-date-part-dropdown-v22`，`shared/content-bridge.js` |
| 加载方式 | MV3 扩展，源码目录直接加载，无构建步骤；Node >= 20 用于开发测试 |
| 本轮重新验证 | `npm test`：272/272 通过；unpacked Chrome E2E：6/6 通过；真实招聘页面仍未测 |
| 当前阶段 | 整页填充 + 选填/复制仍保留；映射可靠性离线门禁已接入；真实招聘页面仍待验收 |

握手 v22 和缓存 V15 用途不同，不要求数字一致。重新加载扩展后还须刷新目标网页，核对日志中的实际运行版本。新增 `clipboardWrite` 权限仅用于用户点击复制时写剪贴板；扩展未添加剪贴板读取权限。

### 当前文档与日期控件增量

- README 已按本仓库的使用流程重新编写，新增 [CONTRIBUTING.md](CONTRIBUTING.md) 作为开发环境、验证和提交入口。
- v22 增加分离的年/月下拉控件识别与日期分量填写；回归见 `tests/date-part-dropdowns.test.js`。这不等同于所有日期控件已适配。
- 当前统计以本轮重新运行结果为准；以下历史章节保留当时版本与验证范围，不覆盖当前基线。

### 2026-09-09：增量填入卡在 advancing 的修复

- 用户截图为 Moka 页面整页增量填入，教育记录停在 advancing，多个下拉同时打开。真实页面只读检查也超时；未取得现场性能剖析，不能宣称已确定唯一根因或真实站点已验收。
- 已移除推进等待中对整页 MutationObserver 每次变化执行语义扫描的路径。改为每 120 ms 读取目标分区的轻量状态，最多等待 2500 ms，并清理计时器；包括 value 属性变化、节点替换、取消。
- 新增/保存只点击一次，超时后重新核对记录；无法确认就停止该区块的推进，不让普通字段填充接管不确定的记录。
- 普通自定义选择器先按容器和 aria-controls/owns 限定选项；没有显式归属时，只接受本次交互新出现的单个菜单。菜单选项文字不作为已选值；普通和结构化选择器结束时发送 Escape/失焦。页面不响应这些事件时仍需手动处理，未强改网站 DOM。
- 整页运行新增“停止填充”按钮。取消在字段/记录之间及推进等待中生效；已写内容保留。停止消息 5 秒无响应会提示恢复办法，不会假装网页已经停止；复制入口仍可用。
- 新增 9 项回归：超时不重复新增、动态无关变化、值重置/节点替换、等待清理、取消、多菜单归属、选项与已选值区分、失败恢复和成功收尾。验证日志：tmp/freeze-unit-tests.log、tmp/freeze-e2e-tests.log（本地忽略文件）。

### 最新增量：用户指定记录选填 / 独立复制

- `shared/resume-library.js` 渲染侧边栏“选填与复制”：选择模板、展开任意记录、单字段/整条复制、完整文本手动选择；非列表资料也可复制。
- `popup.js` 通过 `selectRecordTarget` 绑定网页目标，再发送 `fillSelectedRecord`。请求只含本次选择的记录，默认保留已有值，覆盖需勾选；复制不依赖选区或模型。
- `content.js` 绑定选区中的具体控件节点，核对节点、父元素、字段语义及页面地址；多条经历混选被拒绝，节点替换后要求重选。保存、添加、提交不进入这条执行路径。
- 选填独立于整页缓存和重复条目协调器；来源被投影为单条记录并限制候选路径，AI 失败时仍保留本地规则。滚动不会把旧坐标当作新的填写位置。时间下拉可将 `2024-09` 对到「2024年09月」；单个时间控件失败或重建时继续填写其余仍有效的字段，不会整段中止。缺日的日历仍跳过，不会补 1 号。
- 新增 11 项 Node 回归（`record-selection.test.js`、`resume-library.test.js`）。真实 Chrome unpacked 扩展中验证了第三个项目填入第一个编辑区、相邻内容不变、二次保留、节点重建拒绝及整条/单字段剪贴板内容。
- 浏览器验证使用独立 `popup.html` 和虚构网页，通过同一 UI 事件与真实扩展消息通信；原生 Side Panel 容器仍是人工验收边界，没有声称真实招聘网站已通过。
- 手动复现入口及使用步骤见 README 的“指定经历选填与随时复制”。

接手先运行 `git status --short` 和 `git diff --stat`。本次文档整理前已存在代码、测试、锁文件等修改，以及 `dbf0e3aad4a61c39dd6d22c06c7f415a.jpg` 的删除；不要当作整理文档产生的变更，也不要擅自恢复或清理。

## 3. 已实现能力与限制

| 环节 | 已有实现 | 尚不能据此声称 |
| --- | --- | --- |
| 结构扫描 | 祖先标题、可访问性名称和语义化标识；部分 div 选择器、年月面板、相邻文本单选标签 | 任意 DOM 都能找到区块，所有自定义控件都能发现 |
| 条目归属 | 重复容器共享条目索引；主锚点精确匹配加日期加分；并列最高分跳过；整页覆盖不改空白卡片顺序；重复区块按记录逐条填写，当前记录被页面接受后再新增 | 同名无日期、单编辑器复用多张卡片、删除后重排已在真实站点可靠 |
| 映射约束 | 概念词典 + `mapping-policy` 门禁；语言域拒绝 `skills.*`；AI 只能选候选路径；缓存含规则版本并重新校验 | 所有未知弱结构页面都已消除误判；真实招聘站尚未验证 |
| 数据模型 | v11 拆分语言考试事实并幂等迁移 `testScore`；v10 自我评价；v9 亲属信息；v8 起区分学历与学位 | 能根据学历断言取得学位；能从 CET-6 推断 CEFR |
| 控件执行 | 按控件类型分流；日控件缺少日则跳过；年月控件不把年份补成 1 月；contenteditable 写入后校验并回滚；增量模式双层保留已有值 | 异步搜索、portal 弹层、保存后重开编辑器均已在真实站点验证 |
| 文本生命周期 | v15 写入 live `.value`，保持原始 `value` 属性/defaultValue，避免旧网页再次聚焦时清空新值；有新增回归 | 已在真实网站完成聚焦、保存、重开编辑器验证 |
| 模型与结果 | 不配模型或请求失败时仍执行本地映射；区分已填、保留、无映射、无来源、失败和部分完成 | 扫描到的字段全部写入成功就代表页面覆盖率 100% |
| 标准简历 | 多模板管理、活动模板镜像兼容旧存储、单份 `.airesume.json` 与全部 `.airesume-templates.json` 备份 | JSON 备份包含附件、模型配置或 API Key |

“最高学历”等汇总字段已有派生逻辑，这和某条教育记录的布尔开关不同。工作经历页面的实习临时投影不改变标准简历里的经历类型。

## 4. 代码导航

| 文件 / 目录 | 责任与优先查找位置 |
| --- | --- |
| `content.js` | 主流程入口；`scanFields`、`normalizeMappings`、`fillOne`、`runRepeatExperienceFlow` |
| `shared/repeat-flow.js` | 重复经历逐条协调器：观察、对齐、填写、校验、保存/新增、后置条件等待 |
| `shared/repeat-alignment.js` | 重复条目身份；`alignIncrementalRepeatSourceIndexes`、标识索引与空白卡片回退 |
| `shared/page-structure.js` | `findSection`、`itemRoot`、`findLowestCommonAncestor`、字段标签、提示值、结构化选择器 |
| `shared/field-concepts.js`、`shared/mapping-policy.js` | 概念词典、选项域消歧、候选路径、纠错记忆指纹；由 `field-semantics` 委托 |
| `shared/field-semantics.js`、`shared/field-text.js` | 字段语义、兼容性门禁、标签证据；改动需反例回归 |
| `shared/resume-schema.js`、`shared/resume-prompts.js` | 事实模型、兼容归一化、派生与导入提示词 |
| `shared/fill-runtime.js`、`shared/site-adapters.js` | 值转换/验证、日期解析与平台结构补充；不把业务映射散落到域名分支 |
| `popup.js`、`background.js`、`shared/content-bridge.js` | 侧边栏动作、模型消息代理、版本/能力握手 |
| `shared/resume-storage.js`、`shared/profile-document.js`、`shared/asset-storage.js` | 模板、便携文档、附件本机存储；保留迁移和降级通道 |
| `tests/structural-integration.test.js`、`tests/helpers/dom-extension.js` | 完整内容脚本 DOM 回归；测试副本通过 `window.testApi` 暴露扫描、映射、对齐和写入函数 |
| `tests/fixtures/baseline/` | 跨布局开发样本、回归样本和 holdout；记录见 `ACCEPTANCE.md` |
| `tests/browser/` | 普通浏览器本地冒烟表单和受限静态服务 |
| `tests/e2e/` | unpacked Chrome 扩展链路：service worker、注入、storage、`startFill`、v16 握手、逐条教育与 holdout |

早期 `modules/` 问卷模板不是标准简历填写主链路，不要为了本次优化先重写它们。

## 5. 验证步骤与证据边界

在仓库根目录执行：

```powershell
npm ci
npm test
npm run test:e2e
node tests/browser/serve.cjs
```

前两项用于安装锁定依赖和运行测试；最后一项启动服务后，打开 `http://127.0.0.1:8765/tests/browser/structural-smoke.html` 与 `http://127.0.0.1:8765/tests/browser/repeat-flow-smoke.html` 并运行验收，结束后停止服务。测试使用虚构简历。

| 证据层级 | 已记录结果 | 限制 |
| --- | --- | --- |
| 当前 Node 回归 | 本次 272/272 通过 | 混合单元与 DOM 测试，不等于 272 个网站 |
| 当前 jsdom 集成 | 完整生产内容脚本、DOM 遍历和事件逻辑，含逐条经历协调器 | 替代布局几何、真实等待时长及 Chrome 消息/存储 |
| 冻结基准集 | L1/L2/L3 开发布局、H1 回归、H2/H3 holdout 全部通过 | 虚构表单，不是招聘门户 |
| 历史 v16 Chrome 冒烟 | `structural-smoke.html`：首次填 12，增量保留 12，握手 v16 | 此条是旧阶段记录，不能代替 v17 新模式验收 |
| 当前 unpacked 扩展 E2E | Playwright + 系统 Chrome：6/6，含 storage、注入、`startFill`、当前握手、中文 gated-add 教育、英文 holdout 保存后新增、不提交 | Side Panel 容器本身不可枚举，使用同一 `popup.html` 源码 |
| 真实招聘页面 | 中国移动校招简历 **未测** | 2026-09-07 访问 `https://job.10086.cn/personal/resume_campus.html`，重定向到登录（短信与图形验证码）。未注入扩展、未填写、未保存。公开编辑页标签见下文，不能替代登录后的填写验收 |
| `tmp/structural-tests.log` | v14 阶段 170/170 的历史输出 | 被 `.gitignore` 忽略，不代表当前结果 |

验收不能只读 `filledCount`：还需人工盘点应填字段、确认漏扫描项，并在聚焦、失焦、切换条目后复查值。保存/重新打开卡片应在隔离测试环境验证；招聘申请提交保持人工操作。

### 中国移动校招简历（访问记录，不是填写通过）

目标页：`https://job.10086.cn/personal/resume_campus.html`。未登录时无法进入可填表面。公开触屏编辑页能看到字段标签，只用于后续对照，**不能**记为站点实测通过，也尚未做成脱敏 DOM 样本。

| 区块 | 公开编辑页 | 可见字段（标签） | 与当前填写能力的关系 |
| --- | --- | --- | --- |
| 专业论著 | `touch/personal/campus/edit_treatise.html` | 是否有专业论著、论著名称、内容摘要、成就/等级、日期、作者排序、学术会议交流情况、合（独）著/译 | 标题「专业论著」已在 `page-structure` 中识别为论文区块；「论著名称」「内容摘要」「成就/等级」等未必落到现有 `publications.*` 路径 |
| 项目经历 | `touch/personal/campus/edit_project.html` | 是否有项目经历、项目名称、所在公司、职务、时间、项目职责、项目描述 | 与 `projects` 较接近；「所在公司」是否按项目字段写入仍取决于登录后的真实 DOM |
| 校内职务 | `touch/personal/campus/edit_schoolPost.html` | 在职时间、组织团体名称、担任职务、干部级别、职责和成就 | 「校内职务」已识别为校园经历；「组织团体名称」「干部级别」可能对不准确 |

登录后应在真实扩展上测逐条保存/新增，优先增量模式，避免覆盖用户已有简历。未登录前不要根据上述标签补域名规则或宣称兼容。

## 6. 接手顺序与文档分工

按 [ROADMAP.md](ROADMAP.md) 执行：先建立跨布局失败样本和基线，再处理结构证据冲突、条目身份、控件状态一致性。每次交付“复现样本 + 修复 + 反例回归 + 更新后的验收记录”。

- [README.md](README.md)：使用与开发入口。
- [ROADMAP.md](ROADMAP.md)：目标、优先级、任务验收和跨网站评测口径。
- [STRUCTURAL_ENGINE.md](STRUCTURAL_ENGINE.md)：结构引擎改动与分阶段验证记录。
- [CHANGESET.md](CHANGESET.md)：已提交的上游多模板合并历史，不是当前待提交清单。
- [PROJECT_LESSONS.md](PROJECT_LESSONS.md)：长期排查与实现原则。
- [TASK_RETROSPECTIVE.md](TASK_RETROSPECTIVE.md)：历史纠错复盘，不代表当前待办。
