---
description: "Expose the confirmed, Session-scoped automatic research workflow to the Web client, with durable branch state, paper uploads, human decisions, review, and final plan output."
kind: "package-reference"
---
# Research Controller

English | [中文](README.zh.md)

## Summary

`@deepseek-ai/dsh-api-research-controller` exposes a Session-scoped automatic research workflow through the Host `ctx.researchController` service and generated Client `ctx.remote.research` namespace. The controller keeps the research DAG in the `research` storage domain, rejects stale browser revisions, accepts uploaded paper references, and returns each confirmed artifact so the Web panel can render the next stage. The final confirmed branch can write a Markdown research plan through the Session filesystem.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The Host controller requires the attachment, Session filesystem, Session controller, storage-domain, subagent, Typert, and Web services. It opens one `research` domain and stores one row per Session, so a browser reload resumes the complete immutable DAG without opening one database domain for every Session. The controller resolves the Session Agent only when a command must advance the coordinator; a read does not resume an Agent.

The Client calls `research.read({ sessionId })` to load the current revision. `research.upload` stores the uploaded `FileAttachmentRef`, reads the paper, and returns the summary artifact for confirmation; the next `research.confirm` runs problem extraction. Later confirmations advance one stage; after the improvement direction is confirmed, the coordinator performs a targeted literature search before multi-agent review. `research.feedback` records human feedback, and `research.reject` creates an isolated idea branch. `research.selectBranch` and `research.selectNode` change the displayed selection; `research.continueFromNode` starts a new branch from a historical node, while `research.restore` forks a new Session at the node's recorded event boundary and restores that conversation memory. Every mutating request carries `expectedRevision`; a stale value fails with `research/stale`, so the caller must read the returned state before retrying.

The controller passes provider work to `createHostResearchCoordinator()`. The coordinator reads the attachment, searches `ctx.web` for both the initial problem and the confirmed direction, delegates summarization, ideation, refinement, and parallel reviews to the configured subagent provider, and writes the selected final plan through `ctx.fs`. The final artifact keeps the Markdown content and the persisted file path. A simulation remains an explicit coordinator adapter and is selected by `research.confirm` at the simulation-or-plan checkpoint.

New nodes record the source Session that owns their event boundary, so later nodes retained after a restore can be restored from that source Session. A restore cuts the source Session's conversation prefix but copies the complete research sidecar, so every later branch remains selectable; to edit a later node from the source Session, restore that node again first, and the controller rejects confirmation, feedback, or rejection from the wrong Session. Legacy sidecars without a recorded source Session fall back to the current Session.

### Config

| Field | Default | Meaning |
|---|---:|---|
| `subagentProvider` | `spawn` | Registered subagent provider used for research steps and reviews |
| `planPath` | `research-plan.md` | Relative output path inside the Session workspace |
| `maxPaperBytes` | `20,971,520` | Maximum paper bytes read into a summarizer prompt |
| `maxLiteratureResults` | `8` | Maximum Web results included in one literature step |

The generated [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-api-research-controller) is the exhaustive source for accepted fields and their JSDoc.

<a id="model-experience"></a>
## Model Experience

Indirectly, through the ResearchCoordinator and configured subagent provider.

#### KV Cache effect

No direct effect; the controller delegates model work to the configured provider and adds no fixed prompt prefix.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The built-in reader handles text attachments and simple text-bearing PDFs. Scanned or compressed PDFs require a replacement attachment reader adapter.
- Research state is process-local to the configured storage backend. A deployment must use a durable backend when state must survive a Host restart.
- The controller serializes commands in one Host service instance. A horizontally scaled deployment must route a Session's commands to one owner or add a shared write fence.
- Literature search and subagent review require the configured Web and subagent providers; without them the advancing command returns the provider error.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The package owns the Remote projection and durable sidecar. The workflow package owns state transitions and coordinator behavior; the Web package owns the right Sidebar presentation and upload control.

</details>

**Runtime invariant:** No companion is published. The controller projects the durable research row and workflow transitions; the storage domain and workflow package own the mutable relationships that can be checked.
