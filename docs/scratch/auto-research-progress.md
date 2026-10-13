# Auto research workflow progress

English | [中文](auto-research-progress.zh.md)

Owner: Auto research workflow · Created: 2026-10-13 · Expires: 2026-11-13 · Promotion target: the research workflow package and Web UI README pages

This temporary page records the implementation checkpoints for the human-in-the-loop research workflow. Each checkpoint is committed and pushed to `flechanzo/dsh-auto-research-agent` before the next one starts.

## Current status

- **Clean repository baseline — complete.** The repository was reinitialized with a new `main` history and pushed to the project repository.
- **Research DAG model — complete for the first milestone.** `@deepseek-ai/dsh-workflow/research` now models stage outputs, immutable nodes, branch creation, history continuation, user decisions, feedback, and the explicit innovation-claim check.
- **Web workflow surface — complete for the first milestone.** The existing workflow UI now contributes an `Auto research workflow` action in the Session header and a right-Sidebar page with paper upload, stage output, confirmation, feedback, rejection branches, history navigation, reviewer roles, and simulation/final-plan choice.
- **Real agent execution — next.** PDF extraction, literature search, idea generation, reviewer subagents, simulation, session event persistence, and final deliverable writing still need host providers wired to this model.

## Verification evidence

- Research state transitions have focused Vitest coverage in `packages/workflow/workflow/tests/research.spec.ts`.
- The Web panel is intentionally a deterministic scaffold in this milestone; its placeholder outputs identify the provider seam that the next milestone will replace.
- GitHub baseline upload is complete at [flechanzo/dsh-auto-research-agent](https://github.com/flechanzo/dsh-auto-research-agent).

## Next checkpoint

Add the host-side coordinator that reads uploaded paper attachments, emits durable research-stage events, calls the Web search provider, and delegates parallel method, novelty, and reproducibility reviews through the existing workflow and subagent seams. Keep every stage output user-visible and require an explicit confirmation before advancing.

## Dev Note

This page is temporary task tracking. Promote stable event and state contracts to the owning package documentation after the research workflow leaves scaffold status.
