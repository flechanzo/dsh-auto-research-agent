# Auto Research Agent Progress

Updated: 2026-10-19

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
- Each advancing research Session now creates `research-projects/<sessionId>` below the Session cwd. The project keeps `research-conversation.md`, `research-state.json`, and the final `research-plan.md`; later stage writes preserve the original uploaded-paper list, and the Sidebar opens against the active Session's state.
- Project and final-plan writes now pass the resolved Session sandbox policy, falling back to the root Context provider when an Agent scope does not expose it. This prevents the upload or final write from failing with a false file-access denial under `workspace-write`.
- The main Chat view now renders every research stage message from the same revision-ordered Session store as the right Sidebar. The Conversation/Trajectory tab strip contains the in-session branch selector, node clicks synchronize both regions, and historical selections show only their ancestor messages while later branch nodes remain available in the graph.
- The automatic research Sidebar now waits for `sidebarRightTabs`, `sidebarRight`, the research Remote, and the upload service before registering. Its body, title, header action, and workflow-node slots are registered as reversible effects, so the `自动科研流程` action opens a populated panel instead of an empty Sidebar.
- The panel marks every research node and task output with stable DOM identities, shows each task's artifact title in the branch tree, keeps the selected node's lineage and later branch nodes visible, and exposes the selected node's complete output for inspection before creating a same-panel continuation branch.
- The research preset now waits for each delegated child result, disables child model-route overrides, and keeps the parent Session's exact route (including GPT-6 Astra). A failure from the general Web search backend no longer discards arXiv results; source fetch failures remain isolated.
- Automatic goal completion now rejects a goal-round `complete` call while a direct child is running or a non-goal tool call in that round failed, so recoverable failures cannot turn an unfinished run into a completed `3/8` goal.
- Research checkpoints now require explicit `ask_user_question` options, including multi-select choices, instead of allowing the model to infer user decisions. Final Markdown is returned as a visible preview first; a second confirmation writes the file and then exposes its persisted path.
- Continuing from a historical node now creates a same-Session branch that retains the node memory and can be edited without reopening the left conversation list. Cross-Session history metadata is rebound when the continuation is created in the current panel.
- Problem extraction now preserves every distinct testable question and gap in numbered form, so literature search and idea generation receive the full problem set instead of only the first question.
- Host and Client project references, generated Typert Remote artifacts, Web bundle rows, and the API Remote aggregation are wired and typechecked.
- The new-session preset control is now visibly labeled `Agent`, and the Web bundle includes a selectable `Auto research agent` preset with the research workflow prompt and existing research tools.
- The automatic research panel now has a visual hierarchy with a status header, branch and timeline cards, a highlighted current artifact card, grouped upload and decision controls, semantic status pills, stronger focus states, and a narrow-window layout. The same treatment is applied to the header and message-tail branch actions.
- The main conversation transcript now keeps stage cards static on hover and lets the user click or press Enter/Space to expand or collapse the current stage content.
- Stage cards now keep the conversation background unchanged while the pointer rests over them. Their `data-expanded` state directly controls collapsed or full artifact content, so a click, Enter, or Space visibly expands the selected stage even when the artifact is short.
- The main conversation's stage content area now toggles directly: the collapsed card keeps its 360px scroll view, and clicking the artifact content expands it to its full height; clicking again restores the scroll view.
- Literature-index requests now bound URL-encoded queries so long multi-question problem summaries are accepted by the HTTP fetch provider, use the direct arXiv export endpoint to avoid its cross-origin redirect, reject non-2xx and empty responses, and report the selected source and status when every index fails instead of silently showing an empty result.
- The automatic-research right Sidebar now owns an independent vertical scroll container, so short windows can reach confirmation, feedback, and branch controls without clipping the panel.

## Current milestone

- The approved same-panel task and branch navigation update is implemented. Completed answers remain visible in the main Chat view, the Sidebar receives the active Session identity, the Conversation/Trajectory strip selects branches in the same Session, and the per-Session project directory is written through the injected filesystem with its resolved sandbox policy. The visual refresh is complete; interactive browser verification remains blocked by the local Windows launcher/automation environment.
- The installed build exposes the workflow from the Session header's `自动科研流程` action and the right Sidebar.
- On a new session, choose `Agent: 自动科研智能体` from the preset dropdown before sending the first message.
- The Web profile loads `research-controller` successfully; paper upload, confirmation, feedback, branch, history, and plan commands are wired through the Session-scoped Remote.
- Verification: the focused research UI suite passes (8 tests), the shared research-session-store suite passes (2 tests), contract lint, affected Host/Client TypeScript projects, and the repository Host/client build complete. The local Web server is reachable on port 3080 but browser automation could not attach; `dev:web` also reports the existing Node ESM loader error after building.
- The aggregate hygiene run still reports the Windows NodeNext temporary-symlink privilege limitation and the pre-existing `apps/cli/tests/profiles/acp/cordis.yml` Loader-shape failure; neither is introduced by this milestone.

## Next work after confirmation

- Add a replaceable simple-simulation adapter and surface its result in the normal deliverable flow.
- Add end-to-end Host/Client Remote tests for OCR and a concrete simple-simulation adapter.
- Continue the remaining multi-agent workflow hardening only after user confirmation.
