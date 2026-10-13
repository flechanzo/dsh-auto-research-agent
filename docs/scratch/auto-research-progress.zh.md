# 自动科研工作流进度

[English](auto-research-progress.md) | 中文

负责人：自动科研工作流 · 创建日期：2026-10-13 · 到期日期：2026-11-13 · 后续归档位置：科研工作流包和 Web UI README

这个临时页面记录人工确认式科研工作流的实现检查点。每个检查点都会先提交并上传到 `flechanzo/dsh-auto-research-agent`，再开始下一个检查点。

## 当前状态

- **干净仓库基线——已完成。** 仓库已重新初始化为新的 `main` 历史，并上传到项目仓库。
- **科研 DAG 模型——第一阶段已完成。** `@deepseek-ai/dsh-workflow/research` 现在描述阶段输出、不可变节点、分支创建、历史节点继续、用户决策、反馈以及显式创新点检查。
- **Web 工作流界面——第一阶段已完成。** 现有工作流 UI 在会话标题栏增加“自动科研流程”入口，并在右侧 Sidebar 提供论文上传、阶段输出、确认、反馈、拒绝分支、历史导航、审查角色和仿真/科研方案选择。
- **Host 协调器——第二阶段已完成。** `ResearchCoordinator` 现在只推进已确认节点，读取持久化论文附件，通过 `ctx.web` 检索，委派摘要、问题提炼、想法生成、完善以及方法／创新性／可复现性并行审查，在独立分支中保留被拒绝想法，并在使用 `createHostResearchCoordinator()` 组装时通过 `ctx.fs` 写入当前分支的 Markdown 方案。
- **浏览器接入与恢复——下一阶段。** 现有 Web 面板仍使用本地骨架 reducer。下一阶段需要通过 Host RPC／Session sidecar 暴露协调器，通过 `ctx.fileUpload` 上传收据，在右侧 Sidebar 渲染返回的 artifact，并加入可替换的扫描件或压缩 PDF 解析器。

## 验证证据

- 科研状态转移的聚焦 Vitest 覆盖位于 `packages/workflow/workflow/tests/research.spec.ts`。
- 协调器执行和确认门禁的聚焦 Vitest 覆盖位于 `packages/workflow/workflow/tests/research-coordinator.spec.ts`。
- 本阶段 Web 面板是确定性的骨架；占位输出明确标出下一阶段要替换的提供方 seam。
- GitHub 基线上传已完成：[flechanzo/dsh-auto-research-agent](https://github.com/flechanzo/dsh-auto-research-agent)。

## 下一检查点

通过 Session-scoped RPC 和 sidecar projection 暴露 Host 协调器。上传收据必须转为持久化 `FileAttachmentRef` 输入，每个返回的 artifact 都要替换 Web 占位内容，最终方案路径要通过现有 deliverables 流程展示。

## 开发备注

本页用于临时任务跟踪。科研工作流脱离骨架状态后，再把稳定的事件和状态约定提升到所属包的文档中。
