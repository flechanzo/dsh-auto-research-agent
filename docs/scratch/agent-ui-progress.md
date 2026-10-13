# Web agent selection UI progress

English | [中文](agent-ui-progress.zh.md)

Owner: Web UI task · Created: 2026-10-13 · Expires: 2026-11-13 · Promotion target: `packages/client/ui-agent-preset/README.md` and its Chinese counterpart

This expiring scratch page tracks the UI-only phase of the selectable-agent work. It records the current surface and the next verification or implementation step; it does not define the future agent runtime.

## Current status

- **New-task selector — complete in the current tree.** `AgentPresetSeat` renders beside the workspace picker, opens a menu of the available presets, stages a choice for the next blank session, and hides the selector when Coding Tools are disabled.
- **Preset settings — complete in the current tree.** `AgentPresetSection` lists built-in and custom presets, marks the new-task default, and keeps configuration viewing read-only.
- **Running-session label — complete in the current tree.** `AgentPresetLabel` reports the preset recorded by the session without offering a mid-session switch.
- **Agent implementation — intentionally deferred.** This phase does not add a new agent definition, model route, tool catalog, skill, workflow, or prompt.
- **Progress record — complete.** This page is the handoff record for the UI-only phase.

## Verification evidence

The existing sources are `packages/client/ui-agent-preset/src/client/AgentPresetSeat.tsx`, `AgentPresetSection.tsx`, and `AgentPresetLabel.tsx`. The focused component tests live under `packages/client/ui-agent-preset/tests/`; the browser flow is `apps/web/tests/agent-preset-selection.e2e.ts` with the related expected snapshots.

- **Focused component tests — passed.** Two test files passed with 49 tests.
- **Documentation checks — passed.** `pnpm run test:docs` passed all 20 gates; the named translation-pair check and `git diff --check` also passed.
- **Browser E2E — environment blocked.** The selection flow could not launch because Playwright Chromium is not installed locally, so its eight scenarios were skipped. No product assertion failed.

Keep the browser result marked as environment-blocked until the repository's Chromium dependency is installed and the flow is rerun.

## Next phase

Define the agent contents behind the existing preset surface. Keep the selection UI as the consumer: add or change preset declarations in the bundle and registry, then preserve the session event and read-only running-session label behavior. Update the package README and snapshots when model-visible behavior changes.

## Dev Note

This page is temporary task tracking. Promote only durable UI contracts to the package README, and remove this scratch page when the UI-only phase is closed.
