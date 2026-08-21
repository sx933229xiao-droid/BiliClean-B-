---
description: 执行自动化验证，区分机器已跑与待人肉回归
agent: tester
---

对 BiliClean 执行自动化验证，不修改业务代码。

执行步骤（按序，记录真实输出，不编造）：

1. `npm run check` —— 语法 / 引用 / `public/manifest.json` 版本与权限基线
2. `npm test` —— Node 内置测试回归
3. `npm run build && node scripts/verify-dist.mjs` —— 构建产物与 `dist/` 完整性

可用 `npm run verify` 串联以上三步。若任一步失败，保留错误摘要并定位到 `path:line`。

报告格式必须明确区分：

- **自动验证（机器已执行）**：列出每一步是否通过与日志要点
- **人工验证（待人肉浏览器）**：按 `docs/AI_PROJECT_CONTEXT.md` §11 T01-T20 与 `docs/KNOWN_ISSUES.md` 列出需在 Chrome/Edge 最新版加载 `dist/` 到真实 `*.bilibili.com` 验证的项（登录/未登录、视频页/首页/搜索页、滚动加载、SPA 跳转、分 P、刷新、暂停/恢复等），未测的写“待人工验证”，绝不说“线上已验证”

输入参数：$ARGUMENTS
