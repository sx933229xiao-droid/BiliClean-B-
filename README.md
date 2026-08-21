# BiliClean - 哔哩净屏

BiliClean 是一个本地运行的 Chromium Manifest V3 扩展，用于静默隐藏哔哩哔哩网页中的干扰性评论和不符合阈值的视频卡片，并默认关闭视频弹幕。

本仓库目录是依据官方发布的 `BiliClean-v0.1.4-install.zip` 恢复出的可维护源码工程。安装包中的模块边界注释、运行逻辑和静态资源均被保留；新增了零依赖构建、自动化测试、交接文档和恢复记录。

## 快速开始

要求：Node.js 20 或更高版本，以及用于生成发布压缩包的 `zip` 命令。项目没有 npm 第三方依赖，不需要执行 `npm install`。

```bash
npm run verify
```

该命令依次执行源码检查、自动化测试、构建和安装目录核验。构建结果位于 `dist/`。

在 Chrome 中测试：

1. 打开 `chrome://extensions/`；
2. 启用“开发者模式”；
3. 点击“加载已解压的扩展程序”；
4. 选择本项目的 `dist/` 目录；
5. 打开 B 站视频页、首页或搜索页进行实机回归。

生成安装包：

```bash
npm run package
```

产物位于 `release/BiliClean-v0.1.4-install.zip`。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run check` | 检查 JavaScript 语法、模块引用、清单版本和权限基线 |
| `npm test` | 使用 Node.js 内置测试运行器执行纯逻辑回归测试 |
| `npm run build` | 从 `src/` 和 `public/` 生成可加载的 `dist/` |
| `npm run verify` | 完整执行检查、测试、构建和产物核验 |
| `npm run package` | 构建并生成安装 ZIP |

## 目录结构

```text
src/                         可维护 JavaScript 模块
  background/                MV3 后台消息入口
  content/                   页面适配、解析、规则、渲染和弹幕控制
  options/                   完整设置页逻辑
  popup/                     工具栏弹窗逻辑
  shared/                    默认值、校验、消息和客户端
  storage/                   chrome.storage.local 数据仓库
public/                      manifest、HTML、CSS、图标和用户说明
scripts/                     零依赖构建、检查、核验与打包脚本
tools/recover-v0.1.4.mjs     从原安装目录复现模块提取过程的取证工具
test/                        Node.js 自动化测试
docs/AI_PROJECT_CONTEXT.md   给接手 AI 的完整项目上下文
docs/RECOVERY_REPORT.md      源码恢复证据、边界和核验结果
docs/KNOWN_ISSUES.md         已确认问题及建议修复顺序
docs/VERIFICATION.md         本次自动化核验结果与未覆盖范围
dist/                        构建后的可加载扩展
```

## v0.1.4 行为基线

- 评论和视频命中后静默隐藏，不在网页中插入提示或占位；
- 首批最多 50 条评论合批处理，超时 1.2 秒；
- 含 `@` 的评论只有可见字数大于 50 且点赞大于 100 时保留；
- 首页和搜索页默认隐藏播放量低于 5 万或时长短于 60 秒的视频；
- 弹幕默认关闭，但默认允许用户在当前视频中手动开启；
- 设置、规则、名单和累计数量只保存到 `chrome.storage.local`；
- 不包含远程代码、遥测、广告 SDK 或服务器端服务。

恢复工作没有顺带修改已知业务问题，以避免未经实机回归就改变发布版行为。后续开发请先阅读 [已知问题](docs/KNOWN_ISSUES.md) 和 [AI 项目交接文档](docs/AI_PROJECT_CONTEXT.md)。

## 恢复说明

恢复基线安装包 SHA-256：

```text
62a546d9627e03b6398277a7b0a6540fadaf43c66620f576b111d239e22455eb
```

原始 TypeScript 类型、源映射和原构建配置不在发布包中，因此无法逐字恢复。当前工程把可确认的 24 个原模块恢复为标准 ESM JavaScript，并重新建立显式依赖关系。运行逻辑来自发布包，构建结果不保证与旧产物逐字节一致。详情见 [恢复报告](docs/RECOVERY_REPORT.md)。

## 许可证

GNU General Public License v3.0 only。详见 `LICENSE`。
