# Web 智能体选择界面进度

[English](agent-ui-progress.md) | 中文

负责人：Web UI 任务 · 创建日期：2026-10-13 · 到期日期：2026-11-13 · 后续归档位置：`packages/client/ui-agent-preset/README.md` 及其中文对应页

本临时页面记录可选择智能体工作的纯 UI 阶段。它记录当前界面和下一步验证或实现工作，不定义后续智能体运行时。

## 当前状态

- **新建任务选择器——当前代码已完成。** `AgentPresetSeat` 在工作区选择器旁显示菜单，列出可用预设，为下一个空白会话暂存选择，并在关闭代码工作工具时隐藏选择器。
- **预设设置——当前代码已完成。** `AgentPresetSection` 列出内置和自定义预设，标记新任务默认值，并保持配置查看只读。
- **运行中会话标签——当前代码已完成。** `AgentPresetLabel` 显示会话记录的预设，不提供会话中途切换。
- **智能体实现——本阶段暂缓。** 本阶段不新增智能体定义、模型路由、工具目录、技能、工作流或提示词。
- **进度记录——已完成。** 本页是纯 UI 阶段的交接记录。

## 验证证据

现有源码位于 `packages/client/ui-agent-preset/src/client/AgentPresetSeat.tsx`、`AgentPresetSection.tsx` 和 `AgentPresetLabel.tsx`。聚焦组件测试位于 `packages/client/ui-agent-preset/tests/`；浏览器流程位于 `apps/web/tests/agent-preset-selection.e2e.ts`，相关预期快照也在该目录下。

- **聚焦组件测试——已通过。** 两个测试文件通过，共 49 个测试。
- **文档检查——已通过。** `pnpm run test:docs` 的 20 个门禁全部通过；指定的双语配对检查和 `git diff --check` 也已通过。
- **浏览器 E2E——受环境阻塞。** 本机未安装 Playwright Chromium，选择流程无法启动，因此 8 个场景未执行；没有产品断言失败。

安装仓库所需的 Chromium 并重新运行流程前，继续把浏览器结果标记为环境阻塞。

## 下一阶段

在现有预设界面之后定义智能体内容。继续让选择界面作为消费者：在 bundle 和 registry 中增加或修改预设声明，并保持 Session 事件以及运行中会话只读标签的行为。模型可见行为变化时同步更新包 README 和快照。

## 开发备注

本页是临时任务记录。只有稳定的 UI 约定需要提升到包 README；纯 UI 阶段结束后删除本页。
