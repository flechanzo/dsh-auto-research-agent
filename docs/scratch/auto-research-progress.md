# Auto research workflow progress

English | [中文](auto-research-progress.zh.md)

Owner: Auto research workflow · Created: 2026-10-13 · Updated: 2026-10-15 · Expires: 2026-11-13 · Promotion target: the research workflow package and Web UI README pages

This temporary page records the implementation checkpoints for the human-in-the-loop research workflow. Each checkpoint is committed and pushed to `flechanzo/dsh-auto-research-agent` before the next one starts.

## Current status

- **Clean repository baseline — complete.** The repository was reinitialized with a new `main` history and pushed to the project repository.
- **Research DAG model — complete for the first milestone.** `@deepseek-ai/dsh-workflow/research` now models stage outputs, immutable nodes, branch creation, history continuation, user decisions, feedback, and the explicit innovation-claim check.
- **Web workflow surface — complete for the first milestone.** The existing workflow UI now contributes an `Auto research workflow` action in the Session header and a right-Sidebar page with paper upload, stage output, confirmation, feedback, rejection branches, history navigation, reviewer roles, and simulation/final-plan choice.
- **Host coordinator — second milestone complete.** `ResearchCoordinator` now advances only confirmed nodes, reads durable paper attachments, searches through `ctx.web`, delegates summarization, problem extraction, idea generation, refinement, and parallel method/novelty/reproducibility reviews, preserves rejected ideas in isolated branches, and writes a branch-scoped Markdown plan through `ctx.fs` when assembled with `createHostResearchCoordinator()`.
- **Browser integration and resume — current milestone complete.** The Web panel now reads and writes the Session-scoped `research` Remote, uploads paper bytes through `ctx.fileUpload`, renders returned artifacts, persists a revision-checked DAG sidecar, and restores state after reload. Selecting a historical node can restore a new Session at its recorded event boundary; confirming the research direction runs a second targeted literature stage; and the final plan displays its Markdown plus the written file path. The Host and Client project graphs, generated Typert Remote artifacts, API Remote aggregation, and Web profile rows are wired. The local Web profile starts without a `research-controller` import warning.
- **Scanned PDF/OCR — complete for this checkpoint.** The Host reader uses PDF.js for embedded text and treats very short text layers as incomplete. It renders at most the configured page count, scale, and pixel budget with native canvas, persists each PNG through `AttachmentStore`, and sends it to a visual OCR subagent. The returned document records `plain-text`, `embedded-text`, or `ocr`, includes the inspected page count, preserves page markers, and reports `PDF_OCR_UNAVAILABLE`, `PDF_OCR_PARENT_REQUIRED`, `PDF_OCR_EMPTY`, or page-specific `PDF_OCR_FAILED` errors clearly.
- **Agent selector entry — current UI fix complete.** The new-session hero now labels the existing preset control as `Agent`, and the Web bundle ships an `Auto research agent` preset. Selecting it gives the agent the research workflow prompt and keeps the existing paper, web-search, subagent, review, and plan tools available.

## Verification evidence

- Research state transitions have focused Vitest coverage in `packages/workflow/workflow/tests/research.spec.ts`.
- Coordinator execution and confirmation gates have focused Vitest coverage in `packages/workflow/workflow/tests/research-coordinator.spec.ts`.
- The Web panel uses live Host results; this milestone's focused research workflow and UI tests pass 49 cases, and the Host/Client build passes.
- GitHub baseline upload is complete at [flechanzo/dsh-auto-research-agent](https://github.com/flechanzo/dsh-auto-research-agent).
- Earlier checks pass for `pnpm install`, the full `pnpm run build`, the focused research/UI suite, `pnpm run test:docs` (20/20), package dependency policy, package invariants, and Client package rules. The aggregate hygiene run retains only the Windows NodeNext temporary-symlink privilege limitation and the pre-existing ACP profile Loader-shape failure.

## Current checkpoint

This milestone's history restoration, post-direction targeted literature search, Markdown file writing, and scanned-PDF/OCR path are complete and ready to upload. Choose `Agent: Auto research agent` on the new-session hero before sending the first message, then open `Auto research workflow`, upload a paper, and confirm each stage. Select a historical node and choose `Restore this turn (new Session branch)` to resume that turn while retaining later nodes, all branches, and artifacts; switch branches to continue editing a different idea. The next checkpoint adds a concrete simple-simulation adapter, deliverable presentation, and end-to-end Remote coverage.

## Dev Note

This page is temporary task tracking. Promote stable event and state contracts to the owning package documentation after the research workflow leaves scaffold status.
