# 自动科研工作流进度

[English](auto-research-progress.md) | 中文

负责人：自动科研工作流 · 创建日期：2026-10-13 · 更新日期：2026-10-15 · 到期日期：2026-11-13 · 后续归档位置：科研工作流包和 Web UI README

这个临时页面记录人工确认式科研工作流的实现检查点。每个检查点都会先提交并上传到 `flechanzo/dsh-auto-research-agent`，再开始下一个检查点。

## 当前状态

- **干净仓库基线——已完成。** 仓库已重新初始化为新的 `main` 历史，并上传到项目仓库。
- **科研 DAG 模型——第一阶段已完成。** `@deepseek-ai/dsh-workflow/research` 现在描述阶段输出、不可变节点、分支创建、历史节点继续、用户决策、反馈以及显式创新点检查。
- **Web 工作流界面——第一阶段已完成。** 现有工作流 UI 在会话标题栏增加“自动科研流程”入口，并在右侧 Sidebar 提供论文上传、阶段输出、确认、反馈、拒绝分支、历史导航、审查角色和仿真/科研方案选择。
- **Host 协调器——第二阶段已完成。** `ResearchCoordinator` 现在只推进已确认节点，读取持久化论文附件，通过 `ctx.web` 检索，委派摘要、问题提炼、想法生成、完善以及方法／创新性／可复现性并行审查，在独立分支中保留被拒绝想法，并在使用 `createHostResearchCoordinator()` 组装时通过 `ctx.fs` 写入当前分支的 Markdown 方案。
- **浏览器接入与恢复——当前阶段已完成。** Web 面板现在读写 Session-scoped `research` Remote，通过 `ctx.fileUpload` 上传论文字节，渲染返回的 artifact，使用带 revision 检查的 DAG sidecar 持久化，并在刷新后恢复状态。选择历史节点后可以按记录的 Session 边界恢复为新的会话分支；确认研究方向后会运行第二轮针对性文献调研；最终方案同时显示 Markdown 和写入文件路径。Host／Client project graph、生成的 Typert Remote artifact、API Remote 聚合和 Web profile 行均已接线。本地 Web profile 启动时不再出现 `research-controller` 导入警告。
- **扫描版 PDF/OCR——本检查点已完成。** Host 读取器按页使用 PDF.js，保留可用的内嵌文本页，并把缺失或很短的页面文本视为不完整；随后按配置的页数、缩放和像素预算用 native canvas 渲染 PNG，通过 `AttachmentStore` 持久化，只把缺失或稀疏页面交给视觉 OCR subagent。返回文档会按原始页序合并内嵌文本和 OCR 页面，记录 `plain-text`、`embedded-text` 或 `ocr` 提取方式和检查页数，保留页码标记；OCR 不可用、缺少父 Agent、结果为空或单页失败时分别返回明确的 `PDF_OCR_UNAVAILABLE`、`PDF_OCR_PARENT_REQUIRED`、`PDF_OCR_EMPTY` 和 `PDF_OCR_FAILED` 错误。
- **智能体选择入口——当前界面修复已完成。** 新会话首页现在把原有 preset 控件明确标为“智能体”，Web bundle 新增“自动科研智能体”。选择后会加载科研流程提示词，并保留论文、联网检索、子智能体、审查和方案工具。

## 验证证据

- 科研状态转移的聚焦 Vitest 覆盖位于 `packages/workflow/workflow/tests/research.spec.ts`。
- 协调器执行和确认门禁的聚焦 Vitest 覆盖位于 `packages/workflow/workflow/tests/research-coordinator.spec.ts`。
- Web 面板使用 Host 实际返回结果；本轮科研工作流和 UI 聚焦测试共通过 49 项，Host/Client 构建通过。
- GitHub 基线上传已完成：[flechanzo/dsh-auto-research-agent](https://github.com/flechanzo/dsh-auto-research-agent)。
- 之前的检查已通过：`pnpm install`、完整 `pnpm run build`、科研/UI 聚焦测试、`pnpm run test:docs`（20/20）、包依赖策略、包不变量和 Client 包规则。汇总 hygiene 仍保留两个问题：当前 Windows 权限无法让 NodeNext 检查创建临时符号链接，以及既有 ACP profile 的 Loader 根结构错误。

## 当前检查点

本轮历史恢复、确认方向后的二次文献调研、Markdown 文件写入和扫描版 PDF/OCR 路径已完成并待上传。发送第一条消息前，在新会话首页通过“智能体：自动科研智能体”下拉选择它；进入右侧“自动科研流程”后上传论文，逐阶段确认。选择历史节点后点击“恢复此轮对话（新会话分支）”可回到该轮，同时保留已有后续节点、全部分支和 artifact，之后可以切换分支继续修改。后续仍需加入具体的简单仿真适配器、deliverable 展示和端到端 Remote 覆盖。

## 开发备注

本页用于临时任务跟踪。科研工作流脱离骨架状态后，再把稳定的事件和状态约定提升到所属包的文档中。
