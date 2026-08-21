---
description: Multi-agent development workflow (single-writer coordinator)
agent: dev-coordinator
subtask: false
---

当前用户开发任务：

$ARGUMENTS

严格执行 dev-coordinator 定义的单写入多智能体开发流程（AGENTS.md §10）。不要把 /dev 当成普通单 Agent 编码请求。必须按以下顺序执行，不可跳过：

阶段 A：前置检查 — 阅读 AGENTS.md、查看 git status、理解未提交修改、禁止覆盖丢失用户修改

阶段 B：并行调查 — 同时 Task 并行调用 explore + reviewer + tester（必要时 + scout），相互独立、结论不互相污染；尽可能同一轮并行启动；每次 Task 调用前必须生成非空 description/prompt/subagent_type，失败需明示失败 Agent 不得伪造 completed

阶段 C：汇总结论 — 由 coordinator 亲自汇总三个 Agent 结果，必须得到可复现链路、根因、最小修复方案、修改范围、回归风险、测试方案 6 项后才允许 edit；禁止边猜边改

阶段 D：实现 — 由 coordinator 自己做最小 diff 修改（唯一写入点，不再调用 implementer）；不扩大需求、不改版本号、不改 release/package 流程、不动无关脏工作区文件

阶段 E：并行验收 — 再次同时 Task 调用 reviewer（只读审查最终 diff）+ tester（真正执行 npm run verify，不得静态推断通过）；失败则 coordinator 自己修复后重新执行 reviewer+tester，最多 2 轮循环

阶段 F：结束 — 绝不自动 git add/commit/tag/push/npm publish//ship//release，只输出结构化报告并明确区分【机器已验证】与【仍需浏览器人工验证】

示例调用：/dev 搜索页过滤视频后不会继续补充搜索结果，评论功能正常。找出根因并修复，不要破坏首页布局。

安全边界：dev-coordinator 为本工作流唯一 edit:allow 的业务代码写入者，不再自动调用 implementer；permission.task 白名单仅 allow explore/scout/reviewer/tester，默认 deny，已移除 implementer，禁止 release；implementer.md 保留但 /dev 不再依赖，仅供手工 @implementer 或其他工作流使用。Task 调用必须非空三要素，tester 只有获真实执行输出才可写“已通过”，否则只能写“静态分析认为……”。

新架构总览：/dev → coordinator → explore+reviewer+tester 并行调查 → coordinator 汇总结论 → coordinator 自己实现最小修改 → reviewer+tester 并行最终验收 → coordinator 最终报告
