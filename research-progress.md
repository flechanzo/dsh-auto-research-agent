# Auto Research Agent Progress

Updated: 2026-10-15

## Completed

- Initial Git repository created and published to `flechanzo/dsh-auto-research-agent`.
- Research workflow state model and Web research panel are implemented.
- `ResearchCoordinator` supports paper attachment reading, question extraction, web search summaries, idea generation and refinement, reviewer passes, innovation validation, isolated rejection branches, Markdown plan generation, and an explicit simulation adapter seam.
- The Session-scoped `research` Host Remote is connected to the Web profile, with revision-checked sidecar persistence, paper upload receipts, artifact rendering, confirmation, feedback, rejection, branch selection, history selection, and continuation from a historical node.
- Confirming the research direction now triggers a second targeted literature search that includes the confirmed idea and problem. The final plan remains visible as Markdown and is written to `research-plan.md` (or the configured Session workspace path).
- Restoring a selected historical node forks a new Session at that node's event boundary while retaining the complete research DAG, later artifacts, and all idea branches, so the new Session can switch branches and continue a different revision.
- Scanned and mixed PDFs now use PDF.js page extraction first, then bounded native-canvas rendering for missing or sparse pages and visual subagent OCR. The reader merges recovered OCR pages with embedded pages in source order, keeps page markers, reports the extraction method and page count, and fails with page-specific `PDF_OCR_*` errors when the visual route is unavailable or empty.
- Host and Client project references, generated Typert Remote artifacts, Web bundle rows, and the API Remote aggregation are wired and typechecked.
- The new-session preset control is now visibly labeled `Agent`, and the Web bundle includes a selectable `Auto research agent` preset with the research workflow prompt and existing research tools.

## Current milestone

- The current milestone is complete and paused after local DSH installation, Host build, Web startup smoke validation, and scanned-PDF/OCR integration.
- The installed build exposes the workflow from the Session header's `自动科研流程` action and the right Sidebar.
- On a new session, choose `Agent: 自动科研智能体` from the preset dropdown before sending the first message.
- The Web profile loads `research-controller` successfully; paper upload, confirmation, feedback, branch, history, and plan commands are wired through the Session-scoped Remote.
- Verification: the focused research workflow and UI suite (49 tests), Host/Client TypeScript checks, package bundles, `pnpm run test:docs` (20 gates), persistence checks, and Client UI locale checks pass; the repository build passed before the final UI condition adjustment, which is covered by the UI typecheck and tests.
- The aggregate hygiene run still reports the Windows NodeNext temporary-symlink privilege limitation and the pre-existing `apps/cli/tests/profiles/acp/cordis.yml` Loader-shape failure; neither is introduced by this milestone.

## Next work after confirmation

- Add a replaceable simple-simulation adapter and surface its result in the normal deliverable flow.
- Add end-to-end Host/Client Remote tests for OCR and a concrete simple-simulation adapter.
- Continue the remaining multi-agent workflow hardening only after user confirmation.
