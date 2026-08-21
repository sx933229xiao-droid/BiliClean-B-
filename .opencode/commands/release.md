---
description: 准备发布材料，任何文件修改前需用户审批
agent: release
---

为 BiliClean 准备发布，不自动改业务代码，未经审批不写文件。

步骤：

1. 只读核对：`public/manifest.json` 与 `package.json` 版本一致、`permissions` 仅 `storage` + host `*://*.bilibili.com/*`、`node scripts/verify-dist.mjs` 通过、`/verify` 报告摘要
2. 预览产出：起草 `CHANGELOG.md` 新增条目与发版说明（基于 `git log` / `git diff`），给出 `npm run package` 后的预期 ZIP 路径与 SHA-256 记录方式
3. 审批门槛：用普通中文向用户说明“装上新版后在 B 站会看到什么不同”，并明确提示“是否写入文件/执行打包”，仅在用户说“继续/确认”后才执行写入或 `npm run package`

红线：绝不执行 `git push` / `npm publish` / `git reset --hard` / `git clean`；不读取 `.env` / `*.pem` / `*.key`；未在真实浏览器人肉验证过的，不声称“已验证”。

输入参数：$ARGUMENTS
