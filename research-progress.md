# Auto Research Agent Progress

Updated: 2026-10-14

## Completed

- Initial Git repository created and published to `flechanzo/dsh-auto-research-agent`.
- Research workflow state model and Web research panel are implemented.
- `ResearchCoordinator` supports paper attachment reading, question extraction, web search summaries, idea generation and refinement, reviewer passes, innovation validation, isolated rejection branches, Markdown plan generation, and an explicit simulation adapter seam.
- The Session-scoped `research` Host Remote is connected to the Web profile, with revision-checked sidecar persistence, paper upload receipts, artifact rendering, confirmation, feedback, rejection, branch selection, history selection, and continuation from a historical node.
- Host and Client project references, generated Typert Remote artifacts, Web bundle rows, and the API Remote aggregation are wired and typechecked.
- The new-session preset control is now visibly labeled `Agent`, and the Web bundle includes a selectable `Auto research agent` preset with the research workflow prompt and existing research tools.

## Current milestone

- The current milestone is complete and paused after local DSH installation, Host build, and Web startup smoke validation.
- The installed build exposes the workflow from the Session header's `自动科研流程` action and the right Sidebar.
- On a new session, choose `Agent: 自动科研智能体` from the preset dropdown before sending the first message.
- The Web profile loads `research-controller` successfully; paper upload, confirmation, feedback, branch, history, and plan commands are wired through the Session-scoped Remote.
- Verification: `pnpm install`, `pnpm run build`, the focused research/UI suite (47 tests), and `pnpm run test:docs` (20 gates) pass; package dependency, invariant, and Client package checks also pass.
- The aggregate hygiene run still reports the Windows NodeNext temporary-symlink privilege limitation and the pre-existing `apps/cli/tests/profiles/acp/cordis.yml` Loader-shape failure; neither is introduced by this milestone.

## Next work after confirmation

- Add a replaceable simple-simulation adapter and surface its result in the normal deliverable flow.
- Improve PDF extraction for scanned/compressed PDFs and add end-to-end Host/Client Remote tests.
- Continue the remaining multi-agent workflow hardening only after user confirmation.
