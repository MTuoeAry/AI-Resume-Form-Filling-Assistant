# 通用填写引擎：2026-09-07 改进记录

本文按阶段保留实现与验证证据；当前统一基线见 [HANDOFF.md](HANDOFF.md)，待办与验收标准见 [ROADMAP.md](ROADMAP.md)。下面 v14 的浏览器结果不能作为 v15 的浏览器验收结果。

本轮目标是让不同招聘页面共享区块、条目、字段和控件的识别能力。没有新增域名分支，也没有把某个网站的 ID 注册为固定映射。

## 实现

- 新增 `shared/page-structure.js`。由祖先标识、直属标题和可访问性名称确定区块；标题优先于标识。明确归属后停止使用其他区块的标题作为字段上下文。
- 根据重复容器识别条目，同一条目中的字段共享索引。单选组按字段行/条目分组，避免同名控件跨卡片合并；增量模式沿用内容锚点与来源对齐。
- 对明确的列表区块限定 AI 候选路径，并在本地拒绝跨区块、跨条目结果。原有 work-only 临时投影仍保留。
- 普通 `div` 选择器通过显示值、候选列表、选项编码和年月面板结构识别，执行真实选项点击并校验显示结果。日面板存在时需要真实日期，不猜测 1 日。
- 从原始相邻文本节点读取单选标签；与字段标签一致、且仍等于默认值的“请输入…”识别为提示，供增量模式跳过判断使用。
- Schema v8 保留 `educations.*.degree` 的学历层次含义，另加 `academicDegree`、`isFullTime`、`schoolType`、`majorDescription`。旧文档的新字段保持空白，不推断已获得的学位。
- 未配置模型或请求失败时继续执行本地映射。诊断区分本地/AI/缓存来源，结果报告已填、保留已有、未确定映射、缺少数据和失败数量。
- 本阶段扩展版本 1.3.0，缓存 V14，内容脚本握手 `2026-09-07-structural-fields-v14`；后续握手变更见下文。使用新版本前重新加载扩展并刷新目标页面。

## 验证与边界

v14 阶段记录的完整 Node 测试：170/170 通过，其中新增 12 个结构/控件/执行链路集成用例。

`tests/structural-integration.test.js` 执行完整内容脚本，涵盖不同布局、英文关联标签、错误标识、多卡片、跨来源路径、年月/日面板、增量保留和模型失败。测试替代 jsdom 缺少的布局几何、定时器以及扩展消息/存储，不代替真实浏览器布局、异步时序和扩展链路验收。

`tests/browser/structural-smoke.html` 通过普通浏览器中的完整内容脚本和真实点击事件执行教育、项目共 10 个控件。2026-09-07 Chrome 验收：首次填入 10 个，再次增量保留 10 个、写入 0 个，下拉实际编码与年月结果正确。没有调用在线模型或提交表单。

这不是“所有网站已经支持”的声明。仍需验证未参与开发的招聘页面，重点包括：

1. 单个编辑器反复承载不同已保存卡片，以及复杂自动新增流程。
2. 异步搜索结果、渲染后替换的组件节点、依赖字段出现后的重新扫描。
3. 通过 portal 渲染到区块外的选择器及日期面板。
4. 同时存在多个同义区块、无明确标题/标识的布局与有歧义的来源锚点。
5. 最高学历、最高学位、主学习经历等条目级布尔派生。目前明确跳过，不能把学历值填入状态开关。
6. 自定义控件失败后能否通过网站提供的原选项或清除动作恢复内部状态；不以修改展示文字冒充恢复。

后续新增适配应先保存脱敏结构和事件 fixture，再在其他布局上检验回归；已扫描控件数不等于页面全部应填写字段数。

## 后续增量：v15 输入值生命周期修复

在部分旧表单中，聚焦事件会在 `input.value === input.defaultValue` 时清空输入。填写时若把简历内容同步写进 HTML `value` 属性，会让真实内容被当作默认提示，下一次点击就消失。这是执行生命周期问题，不能通过更换映射路径修复。

当前 `content.js` 的 `setValueWithEvents` 使用原生 setter 写 live value，触发 input/change/blur，保留原始 value 属性；失败仍尝试恢复原值及原属性。内容脚本握手升级为 `2026-09-07-live-input-value-v15`，扩展 1.3.0、Schema v8、映射缓存 V14 保持当前值。

新增集成用例 `text filling does not turn resume content into a legacy focus-cleared default value`：给公司与职务输入框添加旧式聚焦清空逻辑，填写后再次聚焦，断言新内容保留且 defaultValue 未被修改。

2026-09-07 文档整理时重新执行 `npm test`：**171/171 通过**，其中结构集成用例 13 项。本次未重新执行浏览器或真实招聘页面验收，不能将前一阶段 10 控件结果归于 v15。聚焦、失焦、页面重渲染、保存及重开编辑器的进一步验收列入 ROADMAP 的 P0-4。

## 可靠性门禁增量

随后在同一握手版本上增加：

- 标识锁定只接受 `educationInfo` 这类主导标识，随机 ID 即使包含 education 也不会锁区块。
- 混合工作/项目弱证据不再选出单一区块。
- 条目对齐改为精确主锚点加日期加分，并列最高分跳过；覆盖模式保持空白卡片页序。
- 原生 `type=date` 缺少日则跳过，年月精度不再把年份补成 1 月；contenteditable 写入后校验并回滚。
- 诊断事件进入会话导出；冻结 L1–L3、H1–H3 样本；unpacked 扩展 E2E 接入 CI。
- 条目对齐抽到 `shared/repeat-alignment.js`；日期解析并入 `shared/fill-runtime.js`；生产入口仍是 `content.js`。

2026-09-07 可靠性门禁后重新执行 `npm test`：**195/195 通过**。v15 浏览器冒烟 12/12，unpacked E2E 4/4。真实招聘网站仍未测。

## 后续增量：v16 重复经历逐条推进

原先整页填写会先把所有重复条目“新增”到接近简历条数，再一次性扫描填写。这无法处理必须先完成当前教育/工作记录、网站才允许新增下一条的流程。

当前实现把协调器放在字段引擎之上：

1. `shared/repeat-flow.js` 负责区块顺序和单条记录状态：观察 → 对齐 → 打开编辑器 → 填写 → 校验 → 保存或新增 → 用后置条件确认 → 重新扫描。
2. `content.js` 的 `observeRepeatSection` / `createRepeatFlowHost` / `runRepeatExperienceFlow` 提供页面观察与动作；`scanFields`、`normalizeMappings`、`fillOne` 仍只处理当前编辑器内部字段。
3. 整页 `startFill` 在选区模式外先跑协调器，再扫描其余非重复区块。不再把 `ensureRepeatableSections` 作为默认“先全部新增”。
4. 动作识别看当前区块、编辑器范围和可访问名称；`type=submit` 以及“提交/投递/apply”不得进入协调器。没有域名-按钮 ID 对照表。
5. 记录身份复用 `repeat-alignment` 的学校/公司、专业/职位、日期组合；无法唯一对齐时停止，不按 DOM 顺序猜测。保存/新增超时后先重新观察对账，确认卡片已出现则不重试点击。
6. 增量模式继续保留已有值；“保留成功”不会被当成“记录内容正确”。阻塞文案需指出区块、第几条和原因。

握手升级为 `2026-09-07-repeat-flow-v16`。扩展 1.3.0、Schema v8、映射缓存 V14 不变。

维护时优先改 `shared/repeat-flow.js` 的分类/后置条件，再改 `content.js` 观察层。新增网站流程应增加虚构 DOM 样本，而不是按主机名登记按钮。

验证入口：

- `tests/repeat-flow.test.js`：分类器、后置条件、超时对账、乱序编辑器、同名歧义、复用编辑器
- `tests/repeat-flow-integration.test.js`：生产 `startFill` 的 gated-add、save-then-add、校验失败、多编辑器、相邻区块按钮、实习/工作、阻塞恢复、增量防重复、英文 holdout、无新增按钮的静态区块
- `tests/e2e/fixtures/gated-education.html` 与 `holdout-education.html`：真实扩展注入链路
- `tests/browser/repeat-flow-smoke.html`：普通浏览器 gated-add；`structural-smoke.html` 已在 v16 下重跑 12/12

英文 holdout 使用 fieldset `aria-label="Education history"` 与 `Done` / `Add another education`，未再为该页增加专用按钮 ID 或域名规则。

2026-09-07 本阶段重新执行：Node **216/216** 通过；unpacked Chrome E2E **6/6**；`structural-smoke.html` 首次 12、增量保留 12。

2026-09-07 尝试打开中国移动校招简历 `https://job.10086.cn/personal/resume_campus.html`，被重定向到登录页，**未测填写**。公开触屏编辑页可见「专业论著 / 项目经历 / 校内职务」字段标签，已记入 [HANDOFF.md](HANDOFF.md) 与 [ACCEPTANCE.md](tests/fixtures/baseline/ACCEPTANCE.md)；标签对照不是站点验收通过，也未据此新增域名规则。登录后应在真实扩展上用增量模式复测逐条保存/新增。
