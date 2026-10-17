---
description: "Expose the confirmed, Session-scoped automatic research workflow to the Web client, with durable branch state, paper uploads, human decisions, review, and final plan output."
kind: "package-reference"
---
# Research Controller

English | [中文](README.zh.md)

## Summary

`@deepseek-ai/dsh-api-research-controller` exposes a Session-scoped automatic research workflow through the Host `ctx.researchController` service and generated Client `ctx.remote.research` namespace. The controller keeps the research DAG in the `research` storage domain, rejects stale browser revisions, accepts uploaded paper references, and returns each confirmed artifact so the Web panel can render the next stage. Each advancing Session creates a `research-projects/<sessionId>` directory below its Session cwd and keeps the workflow record and final Markdown plan there.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The Host controller requires the attachment, Session filesystem, Session controller, storage-domain, subagent, Typert, and Web services. It opens one `research` domain and stores one row per Session, so a browser reload resumes the complete immutable DAG without opening one database domain for every Session. The controller resolves the Session Agent only when a command must advance the coordinator; a read does not resume an Agent.

The Client calls `research.read({ sessionId })` to load the current revision. `research.upload` accepts one or more uploaded `FileAttachmentRef` values, reads all selected papers, and returns one comparative summary artifact for confirmation; the next `research.confirm` runs problem extraction. Later confirmations advance one stage; after the improvement direction and its multi-select focus areas are confirmed, the coordinator performs a targeted literature search before multi-agent review. `research.feedback` records human feedback, and `research.reject` creates an isolated idea branch. `research.selectBranch` and `research.selectNode` change the displayed selection; `research.continueFromNode` starts a new branch in the current Session from a historical node while retaining its memory, while `research.restore` remains available to integrations that need a new Session at the node's recorded event boundary. Every mutating request carries `expectedRevision`; a stale value fails with `research/stale`, so the caller must read the returned state before retrying.

The controller passes provider work to `createHostResearchCoordinator()`. The coordinator reads the attachment, extracts PDF text with PDF.js, and for scanned pages renders bounded PNG images for a visual OCR subagent. It can combine the general Web search with arXiv machine-learning categories, de-duplicates returned URLs, and repeats the selected sources after direction confirmation. Direction weights for novelty, impact, feasibility, and reproducibility are included in idea prompts. Each generated or refined idea is sent to a fresh `innovation-reviewer` child with only the candidate and literature evidence; low scores and high overlap with cited work are discarded and retried. Accepted artifacts retain the score, threshold, overlap result, and rationale for the UI and final plan. The coordinator delegates summarization, ideation, refinement, and parallel reviews to the configured subagent provider, returns the final Markdown as a visible preview first, and writes it through `ctx.fs` only after a second `research.confirm` acknowledges that preview. The final artifact then keeps the Markdown content and the persisted file path. A simulation remains an explicit coordinator adapter and is selected by `research.confirm` at the simulation-or-plan checkpoint. The configured `planPath` is resolved inside the per-Session project directory, and later stage writes preserve the original uploaded-paper list.

New nodes record the source Session that owns their event boundary, so later nodes retained after a restore can be restored from that source Session. A restore cuts the source Session's conversation prefix but copies the complete research sidecar, so every later branch remains selectable; to edit a later node from the source Session, restore that node again first, and the controller rejects confirmation, feedback, or rejection from the wrong Session. Legacy sidecars without a recorded source Session fall back to the current Session.

### Config

| Field | Default | Meaning |
|---|---:|---|
| `subagentProvider` | `spawn` | Registered subagent provider used for research steps and reviews |
| `planPath` | `research-plan.md` | Relative output path inside the per-Session research project directory |
| `maxPaperBytes` | `20,971,520` | Maximum paper bytes read into a summarizer prompt |
| `maxLiteratureResults` | `8` | Maximum Web results included in one literature step |
| `literatureSources` | `['web', 'arxiv']` | Default search backends; arXiv requests target machine-learning categories |
| `innovationScoreThreshold` | `70` | Minimum isolated expert score for an idea to reach the user |
| `maxIdeaAttempts` | `3` | Maximum candidates generated at one idea checkpoint |
| `maxPdfPages` | `12` | Maximum PDF pages inspected or rendered for OCR |
| `ocrScale` | `1.5` | Initial raster scale before the pixel cap is applied |
| `maxOcrPixels` | `4,000,000` | Maximum width × height of one rendered OCR page |

The generated [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-api-research-controller) is the exhaustive source for accepted fields and their JSDoc.

<a id="model-experience"></a>
## Model Experience

Indirectly, through the ResearchCoordinator and configured subagent provider.

#### KV Cache effect

No direct effect; the controller delegates model work to the configured provider and adds no fixed prompt prefix.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The built-in reader handles text attachments and PDFs with an embedded text layer. Scanned or very sparse PDFs use the configured visual subagent; OCR is bounded by page, scale, and pixel limits and reports page-specific failures.
- Research state is process-local to the configured storage backend. A deployment must use a durable backend when state must survive a Host restart.
- The controller serializes commands in one Host service instance. A horizontally scaled deployment must route a Session's commands to one owner or add a shared write fence.
- Literature search and subagent review require the configured Web and subagent providers; without them the advancing command returns the provider error.
- arXiv uses the configured Web fetch provider to retrieve its Atom feed. A fetch failure stops that search step, so deployments that enable arXiv must allow `export.arxiv.org` through their Web policy.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The package owns the Remote projection and durable sidecar. The workflow package owns state transitions and coordinator behavior; the Web package owns the right Sidebar presentation and upload control.

</details>

**Runtime invariant:** No companion is published. The controller projects the durable research row and workflow transitions; the storage domain and workflow package own the mutable relationships that can be checked.
