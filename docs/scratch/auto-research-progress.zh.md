# 自动科研工作流进度

[English](auto-research-progress.md) | 中文

负责人：自动科研工作流 · 创建日期：2026-10-13 · 到期日期：2026-11-13 · 后续归档位置：科研工作流包和 Web UI README

这个临时页面记录人工确认式科研工作流的实现检查点。每个检查点都会先提交并上传到 `flechanzo/dsh-auto-research-agent`，再开始下一个检查点。

## 当前状态

- **干净仓库基线——已完成。** 仓库已重新初始化为新的 `main` 历史，并上传到项目仓库。
- **科研 DAG 模型——第一阶段已完成。** `@deepseek-ai/dsh-workflow/research` 现在描述阶段输出、不可变节点、分支创建、历史节点继续、用户决策、反馈以及显式创新点检查。
- **Web 工作流界面——第一阶段已完成。** 现有工作流 UI 在会话标题栏增加“自动科研流程”入口，并在右侧 Sidebar 提供论文上传、阶段输出、确认、反馈、拒绝分支、历史导航、审查角色和仿真/科研方案选择。
- **真实智能体执行——下一阶段。** PDF 解析、论文检索、想法生成、审查子智能体、仿真、Session 事件持久化和最终交付文件仍需接入 Host 提供方。

## 验证证据

- 科研状态转移的聚焦 Vitest 覆盖位于 `packages/workflow/workflow/tests/research.spec.ts`。
- 本阶段 Web 面板是确定性的骨架；占位输出明确标出下一阶段要替换的提供方 seam。
- GitHub 基线上传已完成：[flechanzo/dsh-auto-research-agent](https://github.com/flechanzo/dsh-auto-research-agent)。

## 下一检查点

增加 Host 侧协调器：读取上传的论文附件，发出持久化科研阶段事件，通过现有 workflow 和 subagent seam 并行调用方法、创新性和可复现性审查，并接入 Web 搜索提供方。每个阶段的输出都要展示给用户，并在进入下一阶段前要求显式确认。

## 开发备注

本页用于临时任务跟踪。科研工作流脱离骨架状态后，再把稳定的事件和状态约定提升到所属包的文档中。
