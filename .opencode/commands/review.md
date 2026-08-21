---
description: 只读审查代码与配置，输出问题清单不改文件
agent: reviewer
---

对 BiliClean 进行只读审查，绝不修改任何文件。

审查清单（逐项打勾/打叉，问题用 `path:line` 定位）：

1. `AGENTS.md` 与 `opencode.jsonc` 的工作流、权限（禁止 `git push`/`reset --hard`/`clean`/`npm publish`，外部目录 ask，`.env` 拒绝）是否一致
2. `public/manifest.json` MV3、版本与 `package.json` 一致性、权限仅 `storage` + `*://*.bilibili.com/*`
3. Bilibili SPA 路由（轮询 + popstate/hashchange）重新绑定与临时状态清理
4. 内容脚本注入 `document_idle`、新旧评论与卡片最小隐藏边界
5. `chrome.storage.local` `biliclean.state.v1` 单一真相与 `schemaVersion` 迁移
6. 后台 `BC_GET_STATE/BC_SAVE_*` 与页面 `BC_SHOW_ALL_ON_PAGE/BC_RESCAN_PAGE` 协议一致性
7. DOM 动态增量扫描、MutationObserver/Shadow DOM 限流与去重
8. 旧配置兼容（`collapse/blur→hide` 等迁移）与单测覆盖
9. 隐私（不存正文/标题/URL，用户数据零上传，`diagnosticsEnabled` 不虚假宣称）
10. 静默 `display:none`，无“已过滤”占位

另需：引用一次 `npm run check` / `npm test` 若已跑过的真实结果；未跑过的写“未执行”。按优先级与影响输出问题清单。

输入参数：$ARGUMENTS
