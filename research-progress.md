# Auto Research Agent Progress

Updated: 2026-10-16

## Completed

- Initial Git repository created and published to `flechanzo/dsh-auto-research-agent`.
- Research workflow state model and Web research panel are implemented.
- `ResearchCoordinator` supports paper attachment reading, question extraction, web search summaries, idea generation and refinement, reviewer passes, innovation validation, isolated rejection branches, Markdown plan generation, and an explicit simulation adapter seam.
- The Session-scoped `research` Host Remote is connected to the Web profile, with revision-checked sidecar persistence, paper upload receipts, artifact rendering, confirmation, feedback, rejection, branch selection, history selection, and continuation from a historical node.
- Confirming the research direction now triggers a second targeted literature search that includes the confirmed idea and problem. The final plan is first returned as an awaiting-confirmation Markdown preview; a second confirmation writes it to `research-plan.md` (or the configured Session workspace path).
- Restoring a selected historical node forks a new Session at that node's event boundary while retaining the complete research DAG, later artifacts, and all idea branches, so the new Session can switch branches and continue a different revision.
- Scanned and mixed PDFs now use PDF.js page extraction first, then bounded native-canvas rendering for missing or sparse pages and visual subagent OCR. The reader merges recovered OCR pages with embedded pages in source order, keeps page markers, reports the extraction method and page count, and fails with page-specific `PDF_OCR_*` errors when the visual route is unavailable or empty.
- Literature searches now combine selectable Web and arXiv machine-learning sources, de-duplicate citations, and repeat the selected sources after direction confirmation. Direction weights for novelty, impact, feasibility, and reproducibility are captured in branch memory and included in idea prompts.
- Generated and refined ideas now pass an isolated `innovation-reviewer` JSON evaluation. Candidates below the configured threshold or marked as overlapping cited work are discarded and retried; accepted artifacts expose the score, threshold, overlap result, and rationale in the UI.
- The current Web panel accepts multiple papers in one file selection, shows the full branch tree and every stage artifact in the same right Sidebar, supports multi-select research focus areas, and renders the final Markdown from the selected branch's plan artifact before and after persistence.
- The research preset now waits for each delegated child result, disables child model-route overrides, and keeps the parent Session's exact route (including GPT-6 Astra). A failure from the general Web search backend no longer discards arXiv results; source fetch failures remain isolated.
- Automatic goal completion now rejects a goal-round `complete` call while a direct child is running or a non-goal tool call in that round failed, so recoverable failures cannot turn an unfinished run into a completed `3/8` goal.
- Research checkpoints now require explicit `ask_user_question` options, including multi-select choices, instead of allowing the model to infer user decisions. Final Markdown is returned as a visible preview first; a second confirmation writes the file and then exposes its persisted path.
- Continuing from a historical node now creates a same-Session branch that retains the node memory and can be edited without reopening the left conversation list. Cross-Session history metadata is rebound when the continuation is created in the current panel.
- Problem extraction now preserves every distinct testable question and gap in numbered form, so literature search and idea generation receive the full problem set instead of only the first question.
- Host and Client project references, generated Typert Remote artifacts, Web bundle rows, and the API Remote aggregation are wired and typechecked.
- The new-session preset control is now visibly labeled `Agent`, and the Web bundle includes a selectable `Auto research agent` preset with the research workflow prompt and existing research tools.

## Current milestone

- The current milestone is complete and paused after local DSH installation, Host build, Web startup smoke validation, scanned-PDF/OCR integration, multi-source literature search, direction controls, isolated innovation scoring, multi-paper upload, in-panel branch navigation, and final-plan rendering.
- The installed build exposes the workflow from the Session header's `自动科研流程` action and the right Sidebar.
- On a new session, choose `Agent: 自动科研智能体` from the preset dropdown before sending the first message.
- The Web profile loads `research-controller` successfully; paper upload, confirmation, feedback, branch, history, and plan commands are wired through the Session-scoped Remote.
- Verification: the focused workflow, coordinator, question-composer, and client UI suites pass (75 tests); workflow/API/UI TypeScript checks pass. Documentation gates and the repository Host build remain the next publication checks for this checkpoint.
- The aggregate hygiene run still reports the Windows NodeNext temporary-symlink privilege limitation and the pre-existing `apps/cli/tests/profiles/acp/cordis.yml` Loader-shape failure; neither is introduced by this milestone.

## Next work after confirmation

- Add a replaceable simple-simulation adapter and surface its result in the normal deliverable flow.
- Add end-to-end Host/Client Remote tests for OCR and a concrete simple-simulation adapter.
- Continue the remaining multi-agent workflow hardening only after user confirmation.
