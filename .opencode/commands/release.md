---
description: GitHub Release 发布——校验版本、打包、校验产物、打 tag 并创建 Release（不改源码、不改版本）
agent: release
---

# /release — GitHub Release 发布工作流

在 OpenCode Desktop 中执行 `/release <version>`（如 `/release 0.1.6`）完成受控的 GitHub Release 发布。
本命令**不负责修改源码**，不改版本号，不自动 `commit`，不自动 `push main`。

> 安全边界：`git tag`、`git push origin v${version}` 与 `gh release create --verify-tag` 均由 `opencode.jsonc` `permission.bash` 的 `ask` 触发，需用户独立审批；Release 必须绑定已存在且经 `git ls-remote` 验证已推送到远端的 Tag，禁止 `gh` 自动创建/推送 tag，必须使用显式 `git push origin v${version}`；`git push --force/-f/--force-with-lease`、`git reset --hard`、`git clean`、`npm publish` 永久禁止；绝不自动 `merge`/`rebase`/`reset`/`pull`/`force push`。

输入参数：`$1` 为目标版本号（首个位置参数，OpenCode 官方 `$1` 占位），由 OpenCode 按 `$1` 单独解析传入

---

## 执行步骤（严格按序，任一步失败立即停止并报告）

### 1. 前置检查

#### 1.1 工作区必须干净

```bash
git status --short
```

- 输出必须为空（无任何 `M`/`A`/`D`/`?`/`!!` 条目）。
- 若不为空，**立即停止**，报告 `工作区不干净，请先提交或清理后再执行 /release`，并展示 `git status --short` 与 `git diff --stat` / `git diff --cached --stat`，不继续后续步骤。

#### 1.2 必须处于 main 分支

```bash
git branch --show-current
```

- 结果必须严格为 `main`。
- 若 `!= main`，立即停止，报告 `当前分支为 <branch>，请切换到 main 后重试`。

#### 1.3 远程同步门禁

```bash
git fetch origin
git rev-list --left-right --count origin/main...HEAD
```

- 结果必须严格为 `0 0`（左侧为 `behind`，右侧为 `ahead`）。
- 若为 `0 1`（本地 ahead）、`1 0`（本地 behind）、`1 1`（分叉）等任何非 `0 0`，**立即停止**，报告实际计数并提示用户先手动处理同步（`git log --oneline origin/main..HEAD` / `HEAD..origin/main` 自查）。
- **禁止**自动执行 `merge` / `rebase` / `reset` / `pull` / `force push` 中的任何一项。

---

### 2. 版本检查

#### 2.1 参数来源与格式校验

- `TARGET_VERSION` 必须来源于 `$1`（去除首尾空白后）。
- 必须严格匹配 `^\d+\.\d+\.\d+$`（仅三段数字，如 `0.1.6`）。
- 以下均视为非法并立即停止，提示正确用法 `/release 0.1.6`：
  - `v0.1.6`
  - `0.1`
  - `0.1.6-beta`
  - `0.1.6abc`
  - 空参数 / 未提供 `$1`
- 实现参考：

  ```bash
  node -e "let v=process.argv[1]||''; v=v.trim(); if(!/^\d+\.\d+\.\d+$/.test(v)){console.error('版本格式非法: '+v+'，正确示例: 0.1.6');process.exit(1)};console.log(v)" "$1"
  ```

#### 2.2 版本一致性检查

```bash
node -p "require('./package.json').version"
node -p "require('./public/manifest.json').version"
```

- `package.json` 的 `version` 必须 `== TARGET_VERSION`。
- `public/manifest.json` 的 `version` 必须 `== TARGET_VERSION`。
- 两处必须相等且等于目标版本，否则立即停止并报告不一致值。本命令**不修改版本号**，需用户自行修正后重跑。

---

### 3. 发布包生成

#### 3.1 执行打包

```bash
npm run package
```

- 等价于 `npm run build && node scripts/package.mjs`。
- 若 `check`/`build`/`verify-dist` 任一步失败，立即停止并保留错误日志定位到 `path:line`。

#### 3.2 产物路径与存在性

- 要求生成：`release/BiliClean-v${version}.zip`（如 `release/BiliClean-v0.1.6.zip`）。
- 执行后校验：

  ```bash
  node -e "let fs=require('fs'); let p='release/BiliClean-v'+process.argv[1]+'.zip'; if(!fs.existsSync(p)){console.error('ZIP 未生成: '+p);process.exit(1)};console.log('ZIP exists: '+p)" "$1"
  ```

- 若不存在，立即停止。

#### 3.3 ZIP 内容检查

**必须包含**（ZIP 根级别）：

- `manifest.json`
- `background/`（含 `background/service-worker.js`）
- `content/`（含 `content/bootstrap.js`、`content/style.css`）
- `icons/`（含 `icons/icon-*.png`）
- `options/`（含 `options/index.html`）
- `popup/`（含 `popup/index.html`）

**禁止包含**（任一出现即失败）：

- `src/`
- `test/`
- `docs/`
- `.git/`
- `.opencode/`
- `node_modules/`

校验方式（Windows / Unix 兼容）：

```bash
# Windows PowerShell 列出
powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::OpenRead('release/BiliClean-v0.1.6.zip').Entries | ForEach-Object { $_.FullName } | Sort-Object"
# 或 Unix
unzip -l release/BiliClean-v0.1.6.zip
```

- 若缺失必需条目或命中禁止条目，立即停止并报告具体缺失/多余条目。

#### 3.4 校验 ZIP 内 manifest.json 版本

```bash
node -e "
import fs from 'node:fs';
import { execSync } from 'node:child_process';
let v=process.argv[1];
let zip='release/BiliClean-v'+v+'.zip';
let out='';
// 优先用 PowerShell 读取（Windows），失败回退 unzip -p
try {
  out = execSync(\"powershell -NoProfile -Command \\\"\$z=[IO.Compression.ZipFile]::OpenRead('\"+zip+\"'); \$e=\$z.Entries | Where-Object { \$_.FullName -eq 'manifest.json' }; \$r=[IO.StreamReader]::new(\$e.Open()); \$r.ReadToEnd(); \$z.Dispose()\\\"\", {encoding:'utf8'});
} catch(e) {
  out = execSync('unzip -p '+zip+' manifest.json', {encoding:'utf8'});
}
let m=JSON.parse(out);
if(m.version!==v){console.error('ZIP 内 manifest.json version='+m.version+' != 目标版本 '+v);process.exit(1)}
console.log('ZIP manifest version OK: '+m.version);
" "0.1.6"
```

- `manifest.json` 内的 `version` 必须 `== TARGET_VERSION`，否则停止。

---

### 4. 生成校验信息

打包脚本 `scripts/package.mjs` 已输出 ZIP 路径、大小与 SHA-256，本步骤需再次汇总并展示给用户：

```bash
# 脚本已打印：release/BiliClean-v0.1.6.zip / Size / SHA-256 / Version
# 额外校验（跨平台）：
node -e "
import fs from 'node:fs';
import crypto from 'node:crypto';
let v=process.argv[1];
let p='release/BiliClean-v'+v+'.zip';
let buf=fs.readFileSync(p);
let sha=crypto.createHash('sha256').update(buf).digest('hex');
let size=fs.statSync(p).size;
console.log('ZIP路径: '+p);
console.log('文件大小: '+size+' bytes ('+(size/1024).toFixed(2)+' KB)');
console.log('SHA-256: '+sha);
" "0.1.6"
```

输出内容必须包含：

- ZIP 路径
- 文件大小（bytes + KB/MB）
- SHA-256

此信息将用于 Release body 与完成验证。

---

### 5. Git Tag

#### 5.1 生成 tag 名

- 格式：`v${version}`（如 `v0.1.6`），注意前缀 `v` 仅用于 tag，`$1` 参数本身不带 `v`。

#### 5.2 tag 不存在检查

```bash
git tag --list "v0.1.6"
git rev-parse --verify "refs/tags/v0.1.6"  # 若存在则退出 0，不存在则非 0
```

- 若 `v${version}` 已存在（本地或 `git ls-remote --tags origin v0.1.6` 远程已存在），**立即停止**，报告 `tag v0.1.6 已存在，禁止覆盖`，不执行创建。

#### 5.3 创建 tag（需审批）

```bash
git tag v0.1.6
```

- **审批说明**：此步由 `opencode.jsonc` 中 `git tag* = ask` 触发用户审批，属独立审批点；未批准则停止，不产生 tag。
- 禁止带 `-f` / `--force` 覆盖已存在 tag。
- 创建后校验：

  ```bash
  git tag --list "v0.1.6"
  git show --no-patch --oneline v0.1.6
  ```

#### 5.4 推送 tag 到远端（需审批，禁止 force/delete）

```bash
git push origin v0.1.6
```

- **审批说明**：此步由 `opencode.jsonc` 中 `git push* = ask` 触发用户审批，属独立审批点；未批准则停止，不推送 tag，不进入 §6。
- **永久禁止**：`git push --force` / `git push -f` / `git push --force-with-lease` / `--force-with-lease` 任何变体，以及 `git tag -d` / `git push origin :refs/tags/v${version}` 删除 tag；`opencode.jsonc` 已 `deny` 覆盖 `ask`。
- **推送后校验**：

  ```bash
  git ls-remote --tags origin v0.1.6
  # 必须输出 refs/tags/v0.1.6，否则视为推送失败
  ```
- 若推送失败或未获审批，立即停止，不进入 §6。

---

### 6. GitHub Release（必须绑定已验证且已推送的 Tag，禁止自动创建/推送 tag）

#### 6.1 前置检查

```bash
gh --version
gh auth status
```

- 若 `gh` 未安装或未登录，立即停止并提示 `请先安装 gh CLI 并执行 gh auth login`。
- **Tag 先决条件（本地）**：`v${version}` 必须已由 §5 成功创建并验证（`git tag --list` / `git rev-parse --verify` 通过）；若本地 tag 不存在，**禁止**进入 6.2。
- **Tag 先决条件（远端）**：必须已由 §5.4 `git push origin v${version}` 推送且通过 `git ls-remote --tags origin v${version}` 验证远端存在；若远端不存在，**禁止**进入 6.2。

#### 6.1b 远端 tag 存在性校验（阻断 gh 隐式推送）

```bash
git ls-remote --tags origin v0.1.6
```

- 若输出为空（无 `refs/tags/v0.1.6`），立即停止并报错：

  ```
  远程 tag 不存在，禁止创建 GitHub Release
  ```
- 此校验必须在 `gh release create --verify-tag` 之前执行，未通过则绝不执行 Release 创建。
- **职责边界**：`gh release create` 不允许承担 tag 推送职责；tag 推送必须且只能由 §5.4 的显式 `git push origin v${version}` 完成（受 `ask` 审批、禁止 `force`）。

#### 6.2 创建 Release（需审批，强制 --verify-tag）

使用 `gh` CLI 创建并上传资产，**必须**携带 `--verify-tag`：

```bash
gh release create v0.1.6 release/BiliClean-v0.1.6.zip --verify-tag --title "BiliClean v0.1.6" --notes "待填入自动生成的 Release body"
```

- 上传文件：`release/BiliClean-v${version}.zip`（唯一资产，不额外上传 `*.zip` / `dist/` 等）。
- Release 标题：`BiliClean v${version}`。
- **强制要求**：
  - Git Tag 必须提前由本命令 §5 创建并经 §5.4 `git push origin v${version}` 显式推送到远端且通过 `git ls-remote` 验证，不允许依赖 `gh` 自动创建/推送 tag。
  - 必须使用 `--verify-tag`，使 `gh` 在 tag 不存在时直接失败并停止，禁止绕过 tag 检查。
  - 若本地或远端 tag 不存在或 `gh release create --verify-tag` 报错 `tag not found` / `not exists`，立即停止，不重试、不回退为不带 `--verify-tag` 的创建，亦不允许临时执行 `git push` 补救后重试（需重新按流程执行）。
  - 禁止 `gh release create` 自动创建/推送 tag 的任何行为（不加 `--verify-tag`、跳过 `git push`/`ls-remote` 均视为违规）。
  - `gh release create` 不承担 tag 推送职责，tag 推送只能由 §5.4 显式 `git push origin v${version}` 完成。

> Release 安全流程（必须按序，不可跳过/合并）：
>
> ```
> 检查 tag 是否存在（§5.2，已存在则停止）
>         ↓
> 创建 tag（§5.3 git tag v${version}）
>         ↓
> 验证 tag 存在（§5.3 git tag --list / git show）
>         ↓
> git push origin v${version}（§5.4，ask 审批，禁止 force/delete）
>         ↓
> git ls-remote 验证（§6.1b，若远端不存在则报错“远程 tag 不存在，禁止创建 GitHub Release”并停止）
>         ↓
> gh release create --verify-tag（§6.2，若 tag 缺失则失败停止，不承担推送职责）
>         ↓
> 上传 ZIP（release/BiliClean-v${version}.zip 随 --verify-tag 一并上传）
> ```
> 禁止：`gh release create` 在无 tag 时自动创建/推送 tag；禁止以去掉 `--verify-tag` 或跳过 `git push`/`ls-remote` 的方式绕过校验；`gh` 绝不承担 tag 推送，必须使用显式 `git push origin v${version}`。

#### 6.3 Release body 自动生成

Release body 必须包含以下四部分（由命令自动拼接，不手写占位）：

```markdown
## BiliClean v0.1.6

### 版本号
- package.json: 0.1.6
- public/manifest.json: 0.1.6
- tag: v0.1.6

### 更新内容
<!-- 来源：CHANGELOG.md 对应版本条目 + git log v上一版本..HEAD --oneline -->
<!-- 若 CHANGELOG.md 无对应条目，则用 git log 汇总近 20 条 -->
git log --oneline -20
# 或
git log v0.1.5..HEAD --oneline  # 若上一 tag 存在

### 测试结果
<!-- 来源：最近一次 npm run verify 的真实输出，不编造 -->
- npm run check: 通过/失败 + 要点
- npm test: 通过/失败 + 要点
- npm run build && node scripts/verify-dist.mjs: 通过/失败 + 要点
# 若未执行过，需先执行 npm run verify 并记录结果

### 校验信息
- ZIP: release/BiliClean-v0.1.6.zip
- 大小: 12345 bytes (12.06 KB)
- SHA-256: <64位 hex>
- 打包策略: PowerShell Compress-Archive / zip
```

生成示例（PowerShell / bash）：

```bash
node -e "
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
let v=process.argv[1];
let p='release/BiliClean-v'+v+'.zip';
let sha=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let size=fs.statSync(p).size;
let log='';
try{ log=execSync('git log --oneline -20', {encoding:'utf8'});}catch(e){ log='(git log 获取失败)';}
let changelog='';
try{
  let cl=fs.readFileSync('CHANGELOG.md','utf8');
  // 截取 v${version} 段落（简单策略：取前 80 行或匹配标题）
  changelog=cl.split('\n').slice(0,80).join('\n');
}catch(e){ changelog='(CHANGELOG.md 未找到)';}
let body='# BiliClean v'+v+'\n\n## 版本号\n- package.json: '+v+'\n- public/manifest.json: '+v+'\n- tag: v'+v+'\n\n## 更新内容\n'+changelog+'\n\n## 近期提交\n```\n'+log+'```\n\n## 测试结果\n<!-- 请填入最近一次 npm run verify 的真实输出 -->\n\n## 校验信息\n- ZIP: '+p+'\n- 大小: '+size+' bytes\n- SHA-256: '+sha+'\n';
fs.writeFileSync('release/RELEASE_BODY_v'+v+'.md', body);
console.log(body);
" "0.1.6"
```

然后创建 Release 时引用（同样必须带 `--verify-tag`）：

```bash
gh release create v0.1.6 release/BiliClean-v0.1.6.zip --verify-tag --title "BiliClean v0.1.6" --notes-file release/RELEASE_BODY_v0.1.6.md
```

- **审批说明**：此步由 `opencode.jsonc` 中 `bash: "*": ask`（`gh release*` 未单独 allow，命中 `*`）触发用户审批；未批准则停止，不产生 Release。
- **Tag 绑定校验**：`gh` 必须因 `--verify-tag` 在 tag 不存在时失败并停止；禁止去掉 `--verify-tag` 后重试，禁止绕过 tag 检查自动建 tag。

---

### 7. 权限要求

- `git tag v${version}` 必须经用户审批（`opencode.jsonc` `git tag* = ask`），禁止自动绕过。
- `git push origin v${version}` 必须经用户审批（`opencode.jsonc` `git push* = ask`），禁止自动绕过；禁止 `--force`/`-f`/`--force-with-lease`，禁止删除 tag。
- `gh release create v${version} --verify-tag` 必须经用户审批（`bash: "*": ask` 覆盖），禁止自动绕过；且必须携带 `--verify-tag`，禁止无校验创建；且禁止由 `gh` 承担 tag 推送。
- `git push` 不允许绕过 `opencode.jsonc`，本命令**不执行 `git push main`**；`git push origin v${version}` 为本流程唯一允许的 `push` 操作，且必须显式执行并验证远端 tag 后才允许进入 §6.2。
- **永久禁止**：
  - `git push --force` / `git push -f` / `git push --force-with-lease`（`opencode.jsonc` 已 `deny`）
  - `git tag -d` 删除 tag / `git push origin :refs/tags/v${version}` 删除远程 tag（`git push origin :refs/tags/v${version}` 形式）
  - `gh release delete v${version}` / 覆盖已存在 Release（若 `gh release view v${version}` 已存在则停止，不加 `--clobber`）
  - `gh release create` 不带 `--verify-tag` 自动创建/推送 tag / 绕过 `git push`/`ls-remote` 检查

---

### 8. 完成验证

#### 8.1 确认 tag

```bash
git tag --list "v0.1.6"
# 必须包含 v0.1.6
git show --no-patch --oneline v0.1.6
```

- 若未找到 `v${version}`，报告失败。

#### 8.2 确认 Release

```bash
gh release view v0.1.6 --json tagName,name,url,assets --jq "{tag: .tagName, title: .name, url: .url, assets: [.assets[].name]}"
gh release view v0.1.6
```

- 必须能查询到 `v${version}` 的 Release，且资产包含 `BiliClean-v${version}.zip`。

#### 8.3 输出发布结果

汇总并向用户展示：

- **Release URL**：`gh release view v${version} --json url --jq .url`
- **Tag**：`v${version}`（`git tag --list` 与 `gh release view --json tagName` 一致）
- **Asset**：`release/BiliClean-v${version}.zip`（远程资产名与本地一致）
- **SHA256**：`release/BiliClean-v${version}.zip` 的 SHA-256（与 §4 一致）

示例输出：

```
Release URL: https://github.com/<owner>/<repo>/releases/tag/v0.1.6
Tag: v0.1.6
Asset: BiliClean-v0.1.6.zip (12345 bytes)
SHA256: <64位 hex>
```

---

## 红线

- 本命令**不要修改源码**（不触碰 `src/`、`public/`、`scripts/` 等业务代码）。
- 不要修改版本号（`package.json` / `public/manifest.json` 由 `/ship` 或用户手动维护，本命令只做相等性校验）。
- 不要自动 `commit`（不执行 `git commit`）。
- 不要自动 `push main`（不执行 `git push origin main`，tag 的推送如需也必须经用户另行审批，且绝不使用 `--force`）。
- 不提交 `dist/`、`*.zip`、`release/`、`node_modules/`、`.opencode/node_modules`、`.opencode/package.json|lock` 及 `.env`/`*.pem`/`*.key` 等敏感文件。
- 未实际执行过的 `npm run verify` / `gh release view` 不得声称通过；报告需区分【机器已验证】与【待人工验证】。

输入参数：$1
