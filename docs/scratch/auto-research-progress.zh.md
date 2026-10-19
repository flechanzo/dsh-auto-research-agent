# 自动科研工作流进度

[English](auto-research-progress.md) | 中文

负责人：自动科研工作流 · 创建日期：2026-10-13 · 更新日期：2026-10-19 · 到期日期：2026-11-13 · 后续归档位置：科研工作流包和 Web UI README

这个临时页面记录人工确认式科研工作流的实现检查点。每个检查点都会先提交并上传到 `flechanzo/dsh-auto-research-agent`，再开始下一个检查点。

## 当前状态

- **干净仓库基线——已完成。** 仓库已重新初始化为新的 `main` 历史，并上传到项目仓库。
- **科研 DAG 模型——第一阶段已完成。** `@deepseek-ai/dsh-workflow/research` 现在描述阶段输出、不可变节点、分支创建、历史节点继续、用户决策、反馈以及显式创新点检查。
- **Web 工作流界面——第一阶段已完成。** 现有工作流 UI 在会话标题栏增加“自动科研流程”入口，并在右侧 Sidebar 提供论文上传、阶段输出、确认、反馈、拒绝分支、历史导航、审查角色和仿真/科研方案选择。
- **科研面板视觉刷新——当前检查点已完成。** 面板顶部增加流程身份、当前阶段和状态徽章；分支树、对话时间线、当前节点输出、上传区、决策区、完整阶段内容和最终方案各自拥有清晰的卡片层级。按钮、输入框和分支选择器统一使用客户端设计 token，键盘焦点和状态颜色更明确，并为窄窗口提供单列布局；同样的视觉处理覆盖标题栏入口和消息尾部分支按钮。
- **Host 协调器——第二阶段已完成。** `ResearchCoordinator` 现在只推进已确认节点，通过 `ctx.web` fetch 明确的论文索引，读取持久化论文附件，委派摘要、问题提炼、想法生成、完善以及方法／创新性／可复现性并行审查，在独立分支中保留被拒绝想法，并在使用 `createHostResearchCoordinator()` 组装时通过 `ctx.fs` 写入当前分支的 Markdown 方案。
- **浏览器接入与恢复——当前阶段已完成。** Web 面板现在读写 Session-scoped `research` Remote，通过 `ctx.fileUpload` 上传论文字节，渲染返回的 artifact，使用带 revision 检查的 DAG sidecar 持久化，并在刷新后恢复状态。选择历史节点后可以按记录的 Session 边界恢复为新的会话分支；确认研究方向后会运行第二轮针对性文献调研；最终方案同时显示 Markdown 和写入文件路径。Host／Client project graph、生成的 Typert Remote artifact、API Remote 聚合和 Web profile 行均已接线。本地 Web profile 启动时不再出现 `research-controller` 导入警告。
- **扫描版 PDF/OCR——本检查点已完成。** Host 读取器按页使用 PDF.js，保留可用的内嵌文本页，并把缺失或很短的页面文本视为不完整；随后按配置的页数、缩放和像素预算用 native canvas 渲染 PNG，通过 `AttachmentStore` 持久化，只把缺失或稀疏页面交给视觉 OCR subagent。返回文档会按原始页序合并内嵌文本和 OCR 页面，记录 `plain-text`、`embedded-text` 或 `ocr` 提取方式和检查页数，保留页码标记；OCR 不可用、缺少父 Agent、结果为空或单页失败时分别返回明确的 `PDF_OCR_UNAVAILABLE`、`PDF_OCR_PARENT_REQUIRED`、`PDF_OCR_EMPTY` 和 `PDF_OCR_FAILED` 错误。
- **智能体选择入口——当前界面修复已完成。** 新会话首页现在把原有 preset 控件明确标为“智能体”，Web bundle 新增“自动科研智能体”。选择后会加载科研流程提示词，并保留论文上传、论文索引 fetch、子智能体、审查和方案工具；该 preset 会关闭 DeepSeek 原生 `web_search`。
- **显式机器学习文献索引与模型路由——当前检查点已完成。** 自动科研流程不再调用 DeepSeek 原生 Web Search，只通过 fetch 能力访问用户选中的论文索引：arXiv 机器学习分类、包含 ICLR／NeurIPS／ICML 等顶会的 OpenReview、Semantic Scholar、ACL Anthology 和 OpenAlex。每个索引都可以独立失败，结果会去重，用户选择会带入确认方向后的第二轮检索。所有研究和 OCR 子 Agent 都继承当前对话的 provider、model、推理强度和 token 上限；提示词要求使用简体中文，同时保留标题、URL、代码、公式和 JSON 字段名。两个文献调研节点都支持上传补充论文，并把摘要追加到同一节点历史。
- **多来源创新性审查——当前检查点已完成。** 想法展示给用户前，协调器会围绕该候选点再次查询用户选中的论文索引，把上传论文摘要、初始／补充／确认方向后的全部文献 artifact 与候选点专项结果合并后只交给隔离的创新性 reviewer。Reviewer 会比较机制、模块、目标、数据、实验、指标和贡献声明；专项证据缺失、出现高度重合或分数低于阈值时会丢弃候选并重新生成。
- **同一面板交互修复——当前检查点已完成。** 一次文件选择可以上传多篇论文并进行跨论文阅读；右侧 Sidebar 在同一界面显示完整分支树和每个阶段可展开的内容，方向侧重支持多选，最终方案从当前分支持久化的 plan artifact 渲染，并在写入文件后显示。写入 Markdown 后，主对话和 Sidebar 仍保留全部已完成阶段内容；消息尾部的科研分支按钮会在当前 Session 创建 DAG 分支，不再打开左侧会话列表中的新对话。继续历史节点会保留该节点记忆，右侧分支树和中间主区共享同一份 revision 快照。
- **按 Session 的项目工作区——当前检查点已完成。** 每个推进中的科研 Session 都会通过注入的文件系统在自身 cwd 下创建 `research-projects/<sessionId>`。`research-conversation.md` 和 `research-state.json` 在该目录保存可见 DAG 和最终方案输出；后续阶段写入会保留上传论文清单，配置的 `planPath` 也会留在项目目录内。
- **项目写入的沙箱修复——当前检查点已完成。** 项目记录和最终 Markdown 写入现在会携带已解析的 Session 沙箱策略。如果 Agent 子上下文没有继承该服务，控制器会回退到根 Context，避免在 `workspace-write` 下上传或输出方案时误报文件访问被拒绝。
- **主对话同步——当前检查点已完成。** 中间 Chat 区现在使用与右侧 Sidebar 相同的、按 revision 排序的 Session store 展示每个科研阶段的消息。对话/轨迹切换栏可以在同一 Session 中选择分支，点击节点会同步两个区域；回溯历史节点时只展示其祖先消息，后续节点仍保留在分支图中。
- **科研 Sidebar 注册——当前检查点已完成。** 工作流现在会等待右侧 Sidebar、科研 Remote 和上传服务后再注册 Tab 类型、面板、标题、标题栏入口和工作流节点 slot。所有注册都可逆；同一面板会用稳定的任务和节点标记展示当前节点、活动分支、任务输出标题和完整祖先路径。
- **多问题提炼——当前检查点已完成。** 问题提炼会按编号保留摘要中的每个可验证问题和缺口，分别回答各个问题，并在末尾给出供后续文献检索和想法生成使用的综合关系说明。

## 验证证据

- 科研状态转移的聚焦 Vitest 覆盖位于 `packages/workflow/workflow/tests/research.spec.ts`。
- 协调器执行和确认门禁的聚焦 Vitest 覆盖位于 `packages/workflow/workflow/tests/research-coordinator.spec.ts`。
- Web 面板使用 Host 实际返回结果；科研协调器聚焦套件覆盖 21 项（包含全部显式论文索引解析、不调用原生 Web Search、索引独立失败、补充上传、当前模型路由、多来源创新性证据和无证据时拒绝候选），共享 research-session-store 套件继续覆盖。视觉刷新对应的 UI 聚焦套件通过 8 项，契约 lint、受影响的 Host/Client TypeScript 项目和完整 Host/client 构建通过。
- GitHub 基线上传已完成：[flechanzo/dsh-auto-research-agent](https://github.com/flechanzo/dsh-auto-research-agent)。
- 之前的检查已通过：`pnpm install`、完整 `pnpm run build`、科研/UI 聚焦测试、`pnpm run test:docs`（20/20）、包依赖策略、包不变量和 Client 包规则。汇总 hygiene 仍保留两个问题：当前 Windows 权限无法让 NodeNext 检查创建临时符号链接，以及既有 ACP profile 的 Loader 根结构错误。

## 当前检查点

本检查点的显式机器学习论文索引检索、方向权重、多来源隔离创新点评分、论文重合过滤、历史恢复、确认方向后的二次文献调研、多篇论文上传、同一面板分支导航、已完成回答保留、与当前 Session 同步的 Sidebar 和主 Chat transcript、消息尾部的同一 Session 科研分支、对话／轨迹切换栏中的分支选择、带沙箱策略的按 Session 项目工作区、Markdown 文件写入、中文模型输出、当前会话模型继承、文献阶段补充上传、扫描版 PDF/OCR 路径以及本次 UI 视觉刷新已完成。发送第一条消息前，在新会话首页通过“智能体：自动科研智能体”下拉选择它；进入右侧“自动科研流程”后可一次选择多篇论文，在问题提炼节点调节方向侧重、多选研究侧重点和论文索引，再逐阶段确认。每个候选创新点展示前都会再次检索并在缺少证据或与任意已发表论文重合时拒绝；每次文献结果显示后，可以点击“上传补充文献”追加论文，再确认进入下一阶段。选择分支树中的历史节点后点击“从此阶段继续”会在当前面板创建分支，同时保留已有后续节点、全部分支和 artifact，之后可以切换分支继续修改；写入最终 Markdown 后仍可查看全部历史阶段。后续仍需加入具体的简单仿真适配器、deliverable 展示和端到端 Remote 覆盖。

## 开发备注

本页用于临时任务跟踪。科研工作流脱离骨架状态后，再把稳定的事件和状态约定提升到所属包的文档中。
