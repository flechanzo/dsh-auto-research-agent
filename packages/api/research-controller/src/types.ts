/** Wire vocabulary for the Session-scoped automatic research controller. */

import type { FileAttachmentRef } from '@deepseek-ai/dsh-attachment/types'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

export type { SessionId } from '@deepseek-ai/dsh-session/types'

/** Stages exposed by the research workflow. */
export type ResearchStage =
  | 'paper-upload' | 'paper-read' | 'problem-summary' | 'literature-search'
  | 'idea-generation' | 'idea-refinement' | 'multi-agent-review'
  | 'simulation-or-final-plan' | 'final-plan'

/** Lifecycle status of one research stage node. */
export type ResearchNodeStatus =
  | 'pending' | 'active' | 'awaiting-confirmation' | 'confirmed' | 'rejected' | 'completed'

/** Artifact shown to the user and available to downstream agents. */
export interface ResearchArtifact {
  /** Stable artifact identity within one research Session. */
  readonly artifactId: string
  /** Artifact category used by the UI and planner. */
  readonly kind: 'paper' | 'summary' | 'problem' | 'literature' | 'idea' | 'review' | 'simulation' | 'plan' | 'decision'
  /** User-visible title. */
  readonly title: string
  /** Markdown content. */
  readonly content: string
  /** Optional paper filename or source URL. */
  readonly source?: string
  /** Creation timestamp. */
  readonly createdAt: number
}

/** Memory captured when a node is created. */
export interface ResearchMemorySnapshot {
  /** Artifact ids available to downstream agents. */
  readonly artifactIds: readonly string[]
  /** Feedback accumulated before this node. */
  readonly feedback: readonly string[]
  /** Reviewer roles selected for the next review. */
  readonly reviewerRoles: readonly string[]
}

/** Immutable stage node in the research conversation DAG. */
export interface ResearchNode {
  /** Stable node identity. */
  readonly nodeId: string
  /** Parent node, absent only for the upload root. */
  readonly parentNodeId?: string
  /** Owning branch. */
  readonly branchId: string
  /** Workflow stage. */
  readonly stage: ResearchStage
  /** Current lifecycle status. */
  readonly status: ResearchNodeStatus
  /** Artifact references produced by this node. */
  readonly artifactRefs: readonly string[]
  /** Last human decision. */
  readonly userDecision?: 'confirm' | 'reject' | 'feedback'
  /** Memory snapshot used by downstream agents. */
  readonly memorySnapshot: ResearchMemorySnapshot
  /** Optional feedback or rejection note. */
  readonly userNote?: string
}

/** Named branch in the research conversation DAG. */
export interface ResearchBranch {
  /** Stable branch identity. */
  readonly branchId: string
  /** Human-facing label. */
  readonly label: string
  /** Node from which this branch diverged. */
  readonly forkNodeId?: string
  /** Node ids in creation order. */
  readonly nodeIds: readonly string[]
}

/** Complete research DAG state returned by the Host. */
export interface ResearchState {
  /** Nodes indexed by identity. */
  readonly nodes: Readonly<Record<string, ResearchNode>>
  /** Branches indexed by identity. */
  readonly branches: Readonly<Record<string, ResearchBranch>>
  /** Artifacts indexed by identity. */
  readonly artifacts: Readonly<Record<string, ResearchArtifact>>
  /** Node currently displayed by the UI. */
  readonly selectedNodeId: string
  /** Branch receiving future work. */
  readonly activeBranchId: string
  /** Deterministic node counter. */
  readonly nextNodeNumber: number
  /** Deterministic branch counter. */
  readonly nextBranchNumber: number
  /** Deterministic artifact counter. */
  readonly nextArtifactNumber: number
}

/** Final Markdown file returned when the coordinator completes the plan. */
export interface ResearchPlanFile {
  /** Safe display filename chosen by the Host writer. */
  readonly fileName: string
  /** UTF-8 Markdown content. */
  readonly content: string
}

/** Complete durable research state returned by every command. */
export interface ResearchSnapshot {
  /** Session that owns the state. */
  readonly sessionId: SessionId
  /** Monotonic revision used to reject stale browser writes. */
  readonly revision: number
  /** Immutable research DAG and branch selection. */
  readonly state: ResearchState
}

/** Result from a research command. */
export interface ResearchCommandValue {
  /** Complete state after the command commits. */
  readonly snapshot: ResearchSnapshot
  /** Artifact made visible by an execution step, when one was created. */
  readonly artifact?: ResearchArtifact
  /** Final plan file when the command generated one. */
  readonly planFile?: ResearchPlanFile
}

/** Read the persisted state without resuming an Agent. */
export interface ResearchReadRequest {
  readonly sessionId: SessionId
}

/** Start reading and summarizing one uploaded paper. */
export interface ResearchUploadRequest {
  readonly sessionId: SessionId
  readonly expectedRevision: number
  readonly paper: FileAttachmentRef
}

/** Confirm the selected output and run exactly one next coordinator step. */
export interface ResearchConfirmRequest {
  readonly sessionId: SessionId
  readonly expectedRevision: number
  /** Stable reviewer role ids selected before the review step. */
  readonly reviewerRoles?: readonly string[]
  /** Required when confirming the simulation-or-plan checkpoint. */
  readonly finalChoice?: 'simulation' | 'plan'
}

/** Attach human feedback without advancing the coordinator. */
export interface ResearchFeedbackRequest {
  readonly sessionId: SessionId
  readonly expectedRevision: number
  readonly feedback: string
}

/** Reject the current idea and generate a new isolated idea branch. */
export interface ResearchRejectRequest {
  readonly sessionId: SessionId
  readonly expectedRevision: number
  readonly reason?: string
}

/** Select an existing branch for display and later work. */
export interface ResearchSelectBranchRequest {
  readonly sessionId: SessionId
  readonly expectedRevision: number
  readonly branchId: string
}

/** Select one historical node for inspection. */
export interface ResearchSelectNodeRequest {
  readonly sessionId: SessionId
  readonly expectedRevision: number
  readonly nodeId: string
}

/** Continue from a historical node in a new isolated branch. */
export interface ResearchContinueRequest {
  readonly sessionId: SessionId
  readonly expectedRevision: number
  readonly nodeId: string
}
