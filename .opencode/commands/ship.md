---
description: 本地 Git 发布——版本检查、双轮验证、双重审批后 commit+push 到 main
agent: build
---

# /ship — 本地 Git 发布工作流

在 OpenCode Desktop 中执行 `/ship <version>`（如 `/ship 0.1.5`）完成受控发布。
不自动创建 tag，不自动创建 GitHub Release，tag/Release 以后单独扩展。

> 安全边界：`git commit` 与 `git push` 是两个独立审批点（均由 `opencode.jsonc` `permission.bash` 的 `ask` 触发）；`git push --force/-f`、`git reset --hard`、`git clean`、`npm publish` 永久禁止；绝不自动 `merge`/`rebase`/`reset`。

输入参数：`$1` 为目标版本号（首个位置参数，OpenCode 官方 `$1` 占位），由 OpenCode 按 `$1` 单独解析传入

---

## 执行步骤（严格按序，任一步失败立即停止并报告）

### 1. 检查当前分支和工作区

```bash
git status --short
git branch --show-current
git diff --stat
git diff --cached --stat
```

- 记录工作区是否干净；若有未提交改动，先提示用户自行确认是否纳入本次发布。

### 2. 必须处于 main

```bash
git branch --show-current
```

- 若 `!= main`，立即停止，报告 `当前分支为 <branch>，请切换到 main 后重试`。

### 3. 检查 origin/main 是否存在

```bash
git ls-remote --heads origin main
git remote -v
```

- 若 `origin/main` 不存在（空仓库/首次推送），报告并停止；由用户决定是否首次推送（不自动创建远程分支）。

### 4. 加强 Git 同步门禁（在任何版本修改 / staging / commit 之前）

```bash
git fetch origin
git rev-list --left-right --count origin/main...HEAD
```

- 结果必须严格为 `0 0`（左侧为 `behind`，右侧为 `ahead`）。
- 若为 `0 1`（本地 ahead）、`1 0`（本地 behind）、`1 1`（分叉）等任何非 `0 0`，**立即停止 /ship**，报告实际计数并提示用户先手动处理同步（`git log --oneline origin/main..HEAD` / `HEAD..origin/main` 自查），**不要自动 `merge`/`rebase`/`reset`/`pull`/`force push`**。
- 此门禁保证 `/ship` 不会把之前遗留的本地 commit 顺带推到 GitHub；只有 `0 0` 才允许进入后续版本修改。

### 5. 检查版本参数格式（严格）

- `TARGET_VERSION` 必须来源于 `$1`（去除首尾空白后）。
- 必须严格匹配 `^\d+\.\d+\.\d+$`（仅三段数字，如 `0.1.5`）。
- 以下均视为非法并立即停止，提示正确用法 `/ship 0.1.5`：
  - `0.1.5abc`
  - `v0.1.5`
  - `0.1.5-beta`
  - `0.1`
  - 空参数 / 未提供 `$1`
- 实现参考（PowerShell / bash 通用）：
  ```bash
  # TARGET_VERSION 来自 $1
  node -e "let v=process.argv[1]||''; v=v.trim(); if(!/^\d+\.\d+\.\d+$/.test(v)){console.error('版本格式非法: '+v);process.exit(1)};console.log(v)" "$1"
  ```

### 6. 检查当前版本号来源（权威位置）

```bash
node -p "require('./package.json').version"
node -p "require('./public/manifest.json').version"
```

- 至少核对 `package.json` 与 `public/manifest.json` 的 `version` 是否一致。
- 若不一致，先停止并报告不一致值，要求用户先修复一致性。
- 同时扫描其他可能的权威版本位置（若存在也需一并检查）：
  ```bash
  grep -r "\"version\"" --include="*.json" | cat
  ```
  如发现除上述两处外还有声明版本的 JSON（如 `src/**/version.ts` 等），一并校验，一致才继续。

### 7. 改版本前执行完整验证

```bash
npm run verify
```

- 等价于 `npm run check && npm test && npm run build && node scripts/verify-dist.mjs`
- 任意 `check/test/build/verify-dist` 失败立即停止，保留错误日志并定位到 `path:line`。

### 8. 将版本号更新到目标版本

- 所有权威版本位置必须一致更新为 `TARGET_VERSION`（来源于 `$1`）。
- 必须同时更新（至少）：
  - `package.json` 的 `version`
  - `public/manifest.json` 的 `version`
- 若扫描发现其他权威位置，一并更新。
- 推荐用 Node 原地改写以保持 JSON 格式：
  ```bash
  node -e "let p=require('./package.json'); p.version='$TARGET_VERSION'; require('fs').writeFileSync('package.json', JSON.stringify(p,null,2)+'\n')"
  node -e "let m=require('./public/manifest.json'); m.version='$TARGET_VERSION'; require('fs').writeFileSync('public/manifest.json', JSON.stringify(m,null,2)+'\n')"
  ```
- 更新后立即校验：
  ```bash
  node -p "require('./package.json').version"
  node -p "require('./public/manifest.json').version"
  ```
  两处必须 `== TARGET_VERSION` 且相等，否则停止。

### 9. 版本更新后重新执行验证

```bash
npm run verify
```

- 再次 `check + test + build + verify-dist`，任一步失败立即停止。
- `manifest.json` 版本与 `package.json` 版本不一致会在 `scripts/check.mjs` 中被拦截。

### 10. 检查空白错误（工作区）

```bash
git diff --check
```

- 必须 `EXIT 0`。若检出尾随空格等空白错误，先修复后再继续，不自动绕过。

### 11. 检查 staged/unstaged 内容，绝对不能提交的

- 执行：
  ```bash
  git status --short
  git diff --stat
  git diff --cached --stat
  ```
- 若以下任一出现在 `git status` / `diff` 中，**必须排除，绝不能 `git add`**：
  - `dist/`
  - `*.zip`
  - `release/`
  - `node_modules/`
  - `.opencode/node_modules/`
  - `.opencode/package.json`
  - `.opencode/package-lock.json`
  - 敏感文件：`.env`、`.env.*`、`*.pem`、`*.key`（含 `**/.env` / `**/.env.*`）
- 若工作区中存在上述未跟踪文件但未 staged，忽略即可；若已 staged，需 `git restore --staged <path>` 移除。

### 12. 只 staging 应该进入版本控制的源码、配置、文档、测试和版本修改

- 仅 `git add` 允许进入版本控制的文件，示例：
  ```bash
  git add package.json public/manifest.json
  git add src/ public/ scripts/ test/ docs/ CHANGELOG.md README.md AGENTS.md .gitignore opencode.jsonc
  ```
- 逐个明确列出要提交的文件，**禁止 `git add -A` / `git add .`** 批量添加，避免误带 `dist/` 等产物。
- 完成后再次：
  ```bash
  git status --short
  git diff --cached --stat
  ```

### 12b. 校验已暂存内容的空白错误

```bash
git diff --cached --check
```

- 必须 `EXIT 0`。若失败，**不允许 `git commit`**，先修复空白错误（`git diff --cached --check` 指向的行）后再重试。

### 13. 输出提交预览（commit 前必须展示）

汇总并向用户展示：

- **目标版本**：`TARGET_VERSION`（来自 `$1`）
- **修改文件**：`git diff --cached --name-only` 列表
- **测试结果**：第 7 步与第 9 步 `npm run verify` 的通过摘要（check/test/build/verify-dist 各是否通过）
- **diff stat**：`git diff --cached --stat`
- **推荐 commit message**：`release: v<TARGET_VERSION>`（如 `release: v0.1.5`）
- 另附 `git diff --cached` 关键片段（若过大则截断并提示用 `git diff --cached` 查看完整）

### 14. 执行 git commit（第一审批点，由 permission 触发）

```bash
git commit -m "release: v<TARGET_VERSION>"
```

- 示例：`release: v0.1.5`
- **审批说明**：此步由 `opencode.jsonc` 中 `git commit* = ask` 触发用户审批，属第一个独立审批点；未批准则停止，不产生 commit。**不另设 `question` 审批**，以避免重复审批。

### 15. commit 成功后再次检查

```bash
git status --short
git log -1 --oneline --decorate
git log -1 --stat
git rev-list --left-right --count origin/main...HEAD
```

- 确认工作区干净、`HEAD` 指向新 commit；此时 `rev-list` 应为 `1 0`（本地领先 1，远程 0）若发前为 `0 0`。

### 16. 执行 git push origin main（第二审批点，由 permission 触发）

```bash
git push origin main
```

- 仅推送 `main`，不使用 `--force` / `-f` / `--force-with-lease` 等任何强制参数。
- **审批说明**：此步由 `opencode.jsonc` 中 `git push* = ask` 触发用户审批，属第二个独立审批点；`commit` 批准绝不能自动视为 `push` 批准。**不另设 `question` 审批**。
- 若用户拒绝 push，保留本地 commit，不推送，提示可稍后手动 `git push origin main`。

### 17. push 后验证

```bash
git status --short
git rev-list --left-right --count origin/main...HEAD
```

- 最终必须为 `0 0`（本地与远程完全同步）。
- 若不是 `0 0`，报告实际计数并提示用户检查网络或远程保护规则，不自动重试强制推送。

### 18. 如果任何环节失败

- 明确报告失败步骤编号与原因（如 `步骤 7 npm run verify 失败：scripts/check.mjs:56 版本不一致`）。
- **禁止自动使用**：
  - `git reset --hard`
  - `git clean`
  - `git push --force` / `git push -f`
  - 自动 `merge` / 自动 `rebase`
- 由用户手动决定修复方式后重新执行 `/ship`。

### 19. 不自动创建 GitHub Release / 不自动打 tag

- `/ship` 仅负责 `commit + push` 到 `origin/main`。
- `git tag` 与 GitHub Release 以后单独扩展，当前即使 `git tag` 权限为 `ask` 也不在 `/ship` 中自动执行。

---

## 红线与补充

- 本流程**不修改** `dist/`（由 `scripts/build.mjs` 生成），不提交任何产物。
- 全程保持 Manifest V3 权限基线 `storage` + `*://*.bilibili.com/*`，版本一致性由 `scripts/check.mjs` 兜底。
- 任何涉及用户在 B 站可见行为的变化，需先用普通中文向用户说明再继续（见 `AGENTS.md` §2）。
- 正常成功路径仅出现两次人工 Git 审批：`git commit` 与 `git push origin main`（均由 `permission.bash` `ask` 触发）。
