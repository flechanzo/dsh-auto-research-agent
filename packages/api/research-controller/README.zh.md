---
description: "把带确认门的、按 Session 作用域的自动科研工作流暴露给 Web Client，提供持久化分支状态、论文上传、人工决策、审查和最终方案输出。"
kind: "package-reference"
---
# Research Controller

[English](README.md) | 中文

## 概述

`@deepseek-ai/dsh-api-research-controller` 通过 Host 的 `ctx.researchController` 服务和生成的 Client `ctx.remote.research` namespace 暴露按 Session 作用域的自动科研工作流。控制器把科研 DAG 保存在 `research` storage domain 中，拒绝过期的浏览器 revision，接收上传论文的引用，并返回每个已确认阶段的 artifact，供 Web 面板渲染下一阶段。每个推进中的 Session 都会在自身 cwd 下创建 `research-projects/<sessionId>` 目录，并把工作流记录和最终 Markdown 方案保存在那里。项目文件和方案写入会携带已解析的 Session 沙箱策略；如果 Agent 子上下文没有继承该 provider，则回退到根 Context，避免在允许工作区写入的配置下误报文件访问被拒绝。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

Host 控制器要求附件、Session 文件系统、Session controller、storage-domain、subagent、Typert 和 Web 服务。它打开一个 `research` domain，并为每个 Session 保存一行记录，因此浏览器刷新后可以恢复完整的不可变 DAG，而不必为每个 Session 打开一个数据库 domain。只有必须推进协调器的命令才会解析 Session Agent；读取操作不会恢复 Agent。

Client 用 `research.read({ sessionId })` 读取当前 revision。`research.upload` 接受一个或多个上传的 `FileAttachmentRef`，读取全部选中的论文并返回一份跨论文比较摘要 artifact；下一次 `research.confirm` 才会运行问题提炼。之后每次确认推进一个阶段；确认改进方向及其多选侧重点后会先执行一次针对性文献调研，再进入多智能体审查。`research.feedback` 保存人工反馈，`research.reject` 创建隔离的想法分支。`research.selectBranch` 和 `research.selectNode` 更改显示选择；`research.continueFromNode` 在当前 Session 中从历史节点创建新分支并保留该节点记忆，`research.restore` 仍供需要新 Session 的集成按节点记录的事件边界恢复对话。每个改变状态的请求都携带 `expectedRevision`；过期值会以 `research/stale` 失败，调用方必须读取返回状态后再重试。

控制器把提供方工作交给 `createHostResearchCoordinator()`。协调器读取附件，使用 PDF.js 提取 PDF 文本层；扫描页面则渲染有上限的 PNG 图片并交给视觉 OCR subagent。它只通过 Web fetch provider 查询明确的论文索引：arXiv、OpenReview、Semantic Scholar、ACL Anthology 和 OpenAlex；按 URL 去重，并在确认方向后再次使用用户选择的索引检索，科研 Session 不会暴露 DeepSeek 原生 `web_search` 工具。创新性、影响力、可行性和可复现性权重会写入想法提示词。每个生成或完善后的想法都会先触发一次候选点专项索引检索，再交给只接收隔离证据的新 `innovation-reviewer` 子 Agent；该 reviewer 同时比较上传论文摘要、初始／补充／针对性文献 artifact 和候选点专项检索到的已发表论文。专项证据缺失、低分或与任意对比论文高度重合的候选会被丢弃并重试，通过的 artifact 会保留分数、阈值、重合结果和理由，供界面与最终方案使用。协调器随后把摘要、想法生成、完善以及并行审查委派给配置的 subagent provider，先返回可见的最终 Markdown 预览，用户通过第二次 `research.confirm` 确认后才通过 `ctx.fs` 写入选定的最终方案。最终 artifact 随后同时保留 Markdown 内容和写入后的路径。仿真仍是显式的协调器适配器，在仿真或方案检查点通过 `research.confirm` 选择。配置的 `planPath` 会解析到每个 Session 的科研项目目录内，后续阶段写入时也会保留首次上传的论文清单，所有写入都会使用解析后的 Session 策略，避免工作区可写配置出现错误的文件访问拒绝。

新节点记录产生其事件边界的源 Session；恢复后保留的后续节点仍可从源 Session 恢复。恢复会截取源 Session 的对话前缀，但复制完整的科研 sidecar，因此可以切换查看所有后续分支；要修改源 Session 中的后续节点，先再次恢复该节点，控制器会拒绝在错误 Session 上确认、反馈或拒绝。旧 sidecar 没有源 Session 标记时，恢复操作兼容地使用当前 Session。

### 配置

| 字段 | 默认值 | 含义 |
|---|---:|---|
| `subagentProvider` | `spawn` | 用于科研阶段和审查的已注册 subagent provider |
| `planPath` | `research-plan.md` | 每个 Session 科研项目目录内的相对输出路径 |
| `maxPaperBytes` | `20,971,520` | 读入摘要提示词的论文最大字节数 |
| `maxLiteratureResults` | `8` | 一个文献检索阶段包含的最大索引论文数 |
| `literatureSources` | `['arxiv', 'openreview', 'semantic-scholar', 'acl-anthology', 'openalex']` | 明确的论文索引来源；arXiv 请求限定机器学习分类 |
| `innovationScoreThreshold` | `70` | 想法展示给用户前必须达到的隔离专家最低分数 |
| `maxIdeaAttempts` | `3` | 一个想法检查点最多生成的候选数量 |
| `maxPdfPages` | `12` | OCR 检查或渲染的 PDF 最大页数 |
| `ocrScale` | `1.5` | 应用像素上限前的初始栅格缩放比例 |
| `maxOcrPixels` | `4,000,000` | 单个 OCR 页面渲染的最大宽 × 高像素数 |

生成的[配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-api-research-controller)是所有受支持字段及其 JSDoc 的完整来源。

<a id="model-experience"></a>
## 模型体验

间接通过 ResearchCoordinator 和配置的 subagent provider。

#### KV 缓存影响

无直接影响；控制器把模型工作委派给配置的 provider，不添加固定提示词前缀。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- 内置读取器支持文本附件和带内嵌文本层的 PDF。扫描版或文本很少的 PDF 会使用配置的视觉 subagent；OCR 受页数、缩放和像素上限约束，并会返回具体页的失败信息。
- 科研状态只存在于配置的 storage backend 所在进程。要在 Host 重启后保留状态，部署必须使用持久化 backend。
- 一个 Host service 实例会串行执行命令。水平扩展部署必须把同一 Session 的命令路由到一个所有者，或增加共享写入围栏。
- 文献检索和 subagent 审查依赖配置的 Web 与 subagent provider；缺少它们时，推进命令会返回提供方错误。
- arXiv 通过配置的 Web fetch provider 获取 Atom feed；启用 arXiv 的部署必须允许 Web 策略访问 `export.arxiv.org`，否则该检索阶段会失败。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本包拥有 Remote 投影和持久化 sidecar。workflow 包拥有状态转移与协调器行为；Web 包拥有右侧 Sidebar 展示与上传控件。

</details>

**运行时不变量：** 不发布 companion。控制器只投影持久化科研记录和工作流迁移；可检查的可变关系由 storage domain 与 workflow 包负责。
