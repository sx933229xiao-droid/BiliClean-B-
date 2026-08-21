# AGENTS.md — BiliClean 项目协作总则

> 本文件为 OpenCode 项目级指令，优先级高于模型默认行为。所有 Agent 必须遵守。

## 0. 项目一句话

BiliClean（哔哩净屏）是本地运行的 Chromium Manifest V3 扩展，在 `*.bilibili.com` 上静默隐藏干扰性评论/不符合阈值的视频卡片并默认关闭弹幕，不接管账号、不读隐私、不做远程调用。

---

## 1. 工作流（必须遵守）

```
Plan → Build → /verify → /review → /release
```

- **Plan**：明确本次要改什么、改动范围、验收标准。涉及用户可见行为变化时必须先与用户确认。
- **Build**：唯一允许改源码的阶段。只改 `src/` 和 `public/`，`dist/` 由脚本生成，绝不手改。
- **/verify**：自动化验证，做完 Build 后必须跑，区分“机器跑过的”和“需要人肉在浏览器里看的”。
- **/review**：只读审查，挑问题不改代码。
- **/release**：准备发布材料，任何文件改动都要用户点头。

> **分支**：开发流 `修改 → /verify → /review → 人工浏览器测试`（见 §5 与 `docs/AI_PROJECT_CONTEXT.md` T01-T20）；发布流单独走 `/ship <version>`（如 `/ship 0.1.5`）—— 版本检查 → 双轮 `npm run verify` → 双审批 `commit` → `push` 到 `origin/main`。`git commit` 与 `git push origin main` 为两个独立审批点，commit 审批不视为 push 审批；`--force/-f` 等强制推送永久禁止。

本轮任务只建立工作流配置，不改插件业务代码。

---

## 2. 谁决定什么

- **用户负责产品决策**：是否改过滤逻辑、阈值、文案、隐私承诺、新增页面、是否发版。
- **Agent 负责纯技术实现**：怎么拆文件、怎么写测试、怎么修构建脚本等，Agent 自行决定，无需事事询问。
- **需要问用户时**：必须先用普通中文说清“用户会看到什么变化”，再问是否继续。不要直接抛技术术语。

> 反例：不要直接问“是否用 WeakSet 处理 revealed 状态避免 race condition”
> 正例：要说“‘恢复本页内容’后点‘重新扫描’，现在同一批内容不会再被隐藏。改完后，点重新扫描会重新把符合规则的内容藏起来。你希望改成这样吗？”

类似需要翻译的术语：`MutationObserver`→“页面内容是动态加载的，扩展怎么盯住新出现的内容”；`storage`→“设置存在浏览器的本地存储里”；`SPA 路由`→“在 B 站内点链接换页面不刷新”。

---

## 3. 角色与权限

| 角色 | 能做什么 | 不能做什么 |
| --- | --- | --- |
| **Build（主开发）** | 读写 `src/`、`public/`、`scripts/`、文档 | 禁止 `git push --force/-f`、`git reset --hard`、`git clean`、`npm publish`；`git commit`/`tag`/`push` 需用户审批（见 §9） |
| **reviewer（只读审查）** | 读代码、跑 `git status/diff/log` 等只读命令，输出问题清单 | 绝不修改源码文件 |
| **tester（只读验证）** | 只读 + 运行 `npm run verify`/`check`/`test`/`build` 等验证命令 | 绝不修改源码文件 |
| **release（发布准备）** | 起草 `CHANGELOG`、核对版本号、校验 `dist/`、打包预览 | 任何写文件前必须经用户审批；同样禁止 push/publish 等危险命令 |

所有角色：禁止读取 `.env`、`.env.*`、`*.pem`、`*.key` 等可能含密钥的文件；访问项目外目录必须先 `ask`；`git push --force/-f` / `git reset --hard` / `git clean` / `npm publish` 永久禁止；`git commit` / `git tag` / `git push`（非强制）需用户审批且 `commit` 与 `push` 为两次独立审批。

安全命令自动允许：`npm run verify`、`npm run check`、`npm test`、`npm run build`、`npm run package`、`node --test`、`git status`/`diff`/`log`/`show`/`branch`/`add`/`rev-parse`/`rev-list`/`ls-remote`/`fetch origin`/`remote -v`/`remote get-url` 等；详见 `opencode.jsonc` `permission.bash`（`*` 默认 `ask`，force push 以 `deny` 覆盖 `ask`）。

---

## 4. 浏览器扩展专项检查原则（每次改动必查）

1. **Manifest V3**：`public/manifest.json` 版本与 `package.json` 一致，权限只保留 `storage` + `*://*.bilibili.com/*`，不擅自扩大。
2. **Bilibili SPA**：B 站切视频/搜索/首页是地址变化不刷新，路由变化（轮询 + popstate/hashchange）后要重新绑定适配器并清理上一页的临时状态。
3. **内容脚本注入**：`content/bootstrap.js` 在 `document_idle` 注入，需兼容新版 `bili-comment-*` Web Component 与旧版 `.reply-item`，选对最小隐藏边界，避免网格空洞或误藏整个线程。
4. **storage**：唯一真相在 `chrome.storage.local` 的 `biliclean.state.v1`，`schemaVersion` 迁移必须兼容旧配置，旧 JSON 导入要校验，损坏数据不得覆盖当前有效设置。
5. **消息通信**：后台 `BC_GET_STATE/BC_SAVE_*` 与页面 `BC_GET_PAGE_STATUS/BC_SHOW_ALL_ON_PAGE/BC_RESCAN_PAGE` 协议保持一致，避免页面与后台状态不一致。
6. **DOM 动态加载**：评论/卡片是滚动后才出现，需通过适配器增量扫描，不依赖一次性全量抓取。
7. **MutationObserver 与 Shadow DOM**：监听范围尽量收敛到评论区/卡片容器，按元素边界去重，避免全页全量遍历和重复扫描；开放 Shadow Root 需递归但要限流。
8. **旧配置兼容**：新增字段给默认值，废弃字段做迁移（如旧 `collapse/blur` 动作统一迁为 `hide`），`rules`、`userLists`、`stats` 结构变更要有单测。
9. **隐私**：默认不存正文/标题/URL/用户信息，统计只存计数；`diagnosticsEnabled` 若无真实实现不得对外宣称有诊断能力；不引入远程代码、遥测、广告 SDK。
10. **静默隐藏**：命中后直接 `display:none`，不在页面插入“已过滤”提示、占位或按钮，排版靠 B 站原生网格回流。

---

## 5. 验证规范：必须区分的两类验证

- **自动验证（机器）**：`npm run check`（语法/引用/清单）、`npm test`（Node 内置测试）、`npm run build && node scripts/verify-dist.mjs`。都通过才算“自动验证通过”。
- **人工验证（人肉浏览器）**：在 Chrome/Edge 最新版加载 `dist/`，覆盖登录/未登录、视频页/首页/搜索页、滚动加载、SPA 跳转、分 P、刷新、暂停/恢复、导入导出。未在真实页面测过的，不得声称“线上已验证”。

规则：**没实际执行过的测试，不得声称通过**。在报告里写清“已执行/未执行/待人工验证”。

---

## 6. 行为红线

- 不编造测试结果，不把“代码存在”当“已验证”。
- 不做无意义重构、批量重命名、格式化整个仓库。
- 修复聚焦单个问题，小步提交，改动说明对应 Issue。
- 不擅自扩大站点权限、新增 `host_permissions`、接入云端或账号相关能力。
- 业务代码本轮不改，只搭工作流。

---

## 7. 常用命令

```bash
npm run verify      # 完整本地验证：check + test + build + 产物核验
npm run check       # 语法、引用、清单基线
npm test            # 纯逻辑回归测试
npm run build       # 生成 dist/
npm run package     # 生成 release/*.zip 并记录 SHA-256
```

人工回归清单见 `docs/AI_PROJECT_CONTEXT.md` §11（T01-T20）与 `docs/KNOWN_ISSUES.md`。

---

## 8. 提问与报告格式

- 提问用户前：先用一句普通中文说清“改完后用户在 B 站会看到什么不同”，再给出选项。
- 报告问题时：文件路径用 `path:line` 形式，如 `src/content/renderers/filter-renderer.js:42`。
- 涉及选择器或页面结构：保存脱敏 DOM 片段，不保存真实用户名/评论内容。

---

## 9. 发布工作流 `/ship <version>`（本地 Git 发布）

- **入口**：OpenCode Desktop 中执行 `/ship 0.1.5`（见 `.opencode/commands/ship.md` 21 步完整流程），版本参数来源于 OpenCode 官方占位 `$1`，严格匹配 `^\d+\.\d+\.\d+$`。
- **前置**：必须在 `main` 分支、`origin/main` 存在；**发布开始前执行 `git fetch origin` + `git rev-list --left-right --count origin/main...HEAD` 必须严格为 `0 0`**，本地 ahead/behind/分叉任一非 0 均立即停止，不自动 `merge`/`rebase`/`reset`/`pull`/`force push`，确保不顺带推送历史遗留 commit。
- **版本权威**：至少 `package.json` 与 `public/manifest.json` 版本一致；若有其他权威位置一并核对；改版前后各执行一次 `npm run verify`（`check + test + build + verify-dist`），任一步失败即停。
- **产物红线**：`git diff --check` 与 `git diff --cached --check` 均必须 `EXIT 0`（后者在选择性 staging 完成后新增）；绝不 `add`/`commit` `dist/`、`*.zip`、`release/`、`node_modules/`、`.opencode/node_modules`、`.opencode/package.json|lock` 及 `.env`/`*.pem`/`*.key` 等敏感文件；仅 `git add` 源码/配置/文档/测试等受控文件，禁止 `git add -A/.`。
- **双审批（由 `permission.bash` 触发）**：按 `.opencode/commands/ship.md` 输出提交预览（目标版本/修改文件/测试结果/diff stat/推荐 `release: v<version>`），随后实际执行 `git commit -m "release: v<version>"` 时触发第一次 `ask` 审批，执行 `git push origin main` 时触发第二次独立 `ask` 审批；`commit` 批准不视为 `push` 批准，`--force/-f/--force-with-lease` 永久 `deny`。
- **收尾**：经用户批准后 `/ship` 最终会执行 `git push origin main`；`push` 后 `git rev-list --left-right --count origin/main...HEAD` 必须 `0 0`；不自动 `tag`/`GitHub Release`，以后单独扩展。

---

## 10. 多智能体开发工作流 `/dev`（单写入 coordinator 架构）

> 目标：修复旧 `/dev` 在阶段 C→D 因空 `Task` payload 导致 `implementer` 未启动、E/F 未执行的编排可靠性问题，改为更稳健的“单写入 coordinator”架构。

- **总览**：`/dev → coordinator → explore + reviewer + tester 并行调查 → coordinator 汇总结论 → coordinator 自己实现最小修改 → reviewer + tester 并行最终验收 → coordinator 最终报告`
- **入口**：OpenCode Desktop 中执行 `/dev <任务描述>`（见 `.opencode/commands/dev.md`），由 `dev-coordinator`（`mode: primary`）总协调。
- **唯一写入者**：`dev-coordinator` 为本工作流唯一允许修改业务代码的 Agent（`edit: allow`）；`implementer.md` 暂时保留但 `/dev` 不再依赖、不再自动调用，仅供手工 `@implementer` 或其他工作流使用。
- **权限**：
  - `permission.task` 白名单：`"*": deny`，仅 `explore` / `scout` / `reviewer` / `tester` 为 `allow`，已移除 `implementer`，禁止 `release`；如果项目全局规则更严格则保留更严格规则。
  - `permission.bash` 严格最小权限：仅 `git status*` / `git diff*` / `git log*` / `git show*` / `git grep*` / `npm run check*` / `npm test*` / `npm run test*` / `npm run build*` / `npm run verify*` 为 `allow`，其余 `*` 为 `ask`，`git add*` / `git commit*` / `git tag*` / `git push*` / `git reset --hard*` / `git clean*` / `npm publish*` / 所有 `force push`（`--force`/`-f`/`--force-with-lease` 变体）为 `deny`。
  - `permission.edit: allow` 仅对 `dev-coordinator` 开放，使其成为 `/dev` 唯一可改 `src/`/`public/` 的 Agent；`reviewer`/`tester` 保持 `edit: deny` 只读。
- **阶段**：
  1. **A 前置检查**：读 `AGENTS.md`、看 `git status --short/diff`、记录版本基线、禁止丢失无关脏修改。
  2. **B 并行调查**：尽可能同一轮并行启动 `explore` + `reviewer` + `tester`（必要时 + `scout`），相互独立不污染结论。
  3. **C 汇总结论**：由 coordinator 亲自汇总，必须得到 6 项（可复现链路、根因、最小修复方案、修改范围、回归风险、测试方案）后才允许 `edit`；禁止边猜边改。
  4. **D 实现**：由 coordinator 自己做最小 diff；不扩大需求、不改版本号、不改 `release`/`package` 发布流程、不动与本任务无关的脏工作区文件。
  5. **E 并行验收**：再次并行调用 `reviewer`（只读审查最终 diff）与 `tester`（必须真正执行 `npm run verify`，不得静态推断通过）；若 `tester` 失败或 `reviewer` 有 blocker，由 coordinator 自己修复后重跑 `reviewer + tester`，最多 2 次修复循环。
  6. **F 结束**：绝不自动 `commit`/`push`/`tag`/`release`/`ship`，只输出结构化报告并明确区分【机器已验证】与【仍需浏览器人工验证】。
- **Task 安全**：每次 `Task` 调用前必须明确生成非空 `description` + `prompt` + `subagent_type`，禁止空 payload；单 Agent 失败必须明示失败 Agent，不得伪造 `completed`。
- **报告真实性**：`tester` 只有真正获得命令执行输出才允许写“`npm run verify` 已通过”“`node --test` 已执行”；静态读取只能写“静态分析认为……”。
