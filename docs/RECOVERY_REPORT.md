# BiliClean v0.1.4 源码恢复报告

## 结论

已从 v0.1.4 官方安装包恢复出一个可读、可测试、可构建、可打包的完整工程。恢复后的代码按发布包保留的 `src/...` 模块标记拆分为 24 个模块，并补齐了明确的 ESM 导入导出关系。

恢复目标是忠实保留 v0.1.4 行为，而不是在恢复阶段同时重构或修复业务问题。

## 输入基线

| 项目 | 值 |
| --- | --- |
| 文件 | `BiliClean-v0.1.4-install.zip` |
| SHA-256 | `62a546d9627e03b6398277a7b0a6540fadaf43c66620f576b111d239e22455eb` |
| 文件数 | 16 |
| 扩展版本 | 0.1.4 |
| Manifest | V3 |
| 最低 Chrome 版本 | 120 |

## 可恢复证据

四个发布 JavaScript 文件保留了构建器生成的模块边界注释，例如：

```text
// src/shared/defaults.ts
// src/content/core/rule-engine.ts
// src/content/adapters/video-page-adapter.ts
// src/background/service-worker.ts
```

这些标记提供了原始模块路径和精确代码边界。恢复过程据此完成：

1. 从四个发布 bundle 中按模块标记提取代码；
2. 对重复模块选择信息最完整的实例；
3. 重建模块之间的显式 `import` / `export`；
4. 保留 HTML、CSS、图标、清单和中文说明；
5. 建立零第三方依赖的构建脚本；
6. 为默认值、迁移、解析器和规则引擎补充回归测试；
7. 重新生成可加载的 `dist/` 并执行语法和结构核验。

## 恢复边界

可以忠实恢复：

- 发布版中的 JavaScript 运行逻辑；
- 24 个原模块的路径与职责边界；
- 默认设置、消息协议、状态迁移和规则算法；
- 页面适配器、DOM 解析、过滤渲染和弹幕控制；
- 弹窗与完整设置页逻辑；
- 所有静态发布资源。

无法逐字恢复：

- 原 TypeScript 类型声明和接口；
- 被构建器删除的源码注释；
- 原 `package.json`、锁文件和第三方工具版本；
- 原构建器的精确选项；
- 未进入发布包的测试、脚本或未使用代码；
- 源映射和原提交历史。

因此，恢复源码采用标准 ESM JavaScript，而不是伪造无法证明的 TypeScript 类型。构建输出在行为上以 v0.1.4 为基线，但不承诺与旧 bundle 逐字节一致。

## 新增工程能力

- `node scripts/check.mjs`：语法、模块引用、版本和权限检查；
- `node --test`：零依赖逻辑回归测试；
- `node scripts/build.mjs`：确定性地组合源码模块并复制静态资源；
- `node scripts/verify-dist.mjs`：核验发布目录和所有入口脚本；
- `node scripts/package.mjs`：生成安装 ZIP 和 SHA-256；
- `node tools/recover-v0.1.4.mjs <安装目录> <输出目录>`：复现 bundle 模块提取过程；
- `docs/AI_PROJECT_CONTEXT.md`：下一位 AI 可直接接手的上下文；
- `docs/KNOWN_ISSUES.md`：恢复时刻已确认但未擅自修复的问题。

## 进一步验证建议

自动化测试不包含真实 B 站 DOM。发布新版本前仍应在 Chrome 和 Edge 中至少回归：

- 视频页首批评论、楼中楼和后加载评论；
- 首页瀑布流与搜索结果的播放量、时长和 UP 主解析；
- SPA 切换视频后的弹幕状态；
- 弹窗“恢复本页内容”和“重新扫描”；
- 设置、规则、名单、导入导出和统计迁移；
- B 站组件使用开放 Shadow DOM 时的选择器路径。
