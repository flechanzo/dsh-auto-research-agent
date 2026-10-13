# Auto research workflow progress

English | [中文](auto-research-progress.zh.md)

Owner: Auto research workflow · Created: 2026-10-13 · Expires: 2026-11-13 · Promotion target: the research workflow package and Web UI README pages

This temporary page records the implementation checkpoints for the human-in-the-loop research workflow. Each checkpoint is committed and pushed to `flechanzo/dsh-auto-research-agent` before the next one starts.

## Current status

- **Clean repository baseline — complete.** The repository was reinitialized with a new `main` history and pushed to the project repository.
- **Research DAG model — complete for the first milestone.** `@deepseek-ai/dsh-workflow/research` now models stage outputs, immutable nodes, branch creation, history continuation, user decisions, feedback, and the explicit innovation-claim check.
- **Web workflow surface — complete for the first milestone.** The existing workflow UI now contributes an `Auto research workflow` action in the Session header and a right-Sidebar page with paper upload, stage output, confirmation, feedback, rejection branches, history navigation, reviewer roles, and simulation/final-plan choice.
- **Host coordinator — second milestone complete.** `ResearchCoordinator` now advances only confirmed nodes, reads durable paper attachments, searches through `ctx.web`, delegates summarization, problem extraction, idea generation, refinement, and parallel method/novelty/reproducibility reviews, preserves rejected ideas in isolated branches, and writes a branch-scoped Markdown plan through `ctx.fs` when assembled with `createHostResearchCoordinator()`.
- **Browser integration and resume — next.** The existing Web panel still uses its local scaffold reducer. The next milestone must expose the coordinator through a Host RPC/session sidecar, upload receipts through `ctx.fileUpload`, render returned artifacts in the right Sidebar, and add a replaceable PDF parser for scanned or compressed papers.

## Verification evidence

- Research state transitions have focused Vitest coverage in `packages/workflow/workflow/tests/research.spec.ts`.
- Coordinator execution and confirmation gates have focused Vitest coverage in `packages/workflow/workflow/tests/research-coordinator.spec.ts`.
- The Web panel is intentionally a deterministic scaffold in this milestone; its placeholder outputs identify the provider seam that the next milestone will replace.
- GitHub baseline upload is complete at [flechanzo/dsh-auto-research-agent](https://github.com/flechanzo/dsh-auto-research-agent).

## Next checkpoint

Expose the Host coordinator through a session-scoped RPC and sidecar projection. Upload receipts must become durable `FileAttachmentRef` inputs, each returned artifact must replace the Web placeholder, and the final plan path must be presented through the existing deliverables flow.

## Dev Note

This page is temporary task tracking. Promote stable event and state contracts to the owning package documentation after the research workflow leaves scaffold status.
