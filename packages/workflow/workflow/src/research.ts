/**
 * Durable state vocabulary for the human-in-the-loop research workflow.
 *
 * The coordinator deliberately stores every user-visible stage as an immutable
 * node. Continuing from an earlier node creates a new branch, so a rejected
 * idea or a historical inspection cannot rewrite the memory used by a later
 * branch.
 *
 * @module @deepseek-ai/dsh-workflow/research
 */

/** Stages shown by the research workflow navigator. */
export type ResearchStage =
  | 'paper-upload'
  | 'paper-read'
  | 'problem-summary'
  | 'literature-search'
  | 'idea-generation'
  | 'idea-refinement'
  | 'multi-agent-review'
  | 'simulation-or-final-plan'
  | 'final-plan'

/** Lifecycle of one stage node. */
export type ResearchNodeStatus =
  | 'pending'
  | 'active'
  | 'awaiting-confirmation'
  | 'confirmed'
  | 'rejected'
  | 'completed'

/** Human decision recorded against a stage output. */
export type ResearchDecision = 'confirm' | 'reject' | 'feedback'

/** The output a stage makes available to the user and later agents. */
export interface ResearchArtifact {
  /** Stable artifact id within one research session. */
  readonly artifactId: string
  /** Artifact category used by the UI renderer and final planner. */
  readonly kind: 'paper' | 'summary' | 'problem' | 'literature' | 'idea' | 'review' | 'simulation' | 'plan'
  /** User-visible title. */
  readonly title: string
  /** Markdown content shown to the user. */
  readonly content: string
  /** Optional paper filename or source URL. */
  readonly source?: string
  /** Stable creation time supplied by the coordinator. */
  readonly createdAt: number
}

/** Snapshot of the memory available when a node was created. */
export interface ResearchMemorySnapshot {
  /** Artifact ids visible to agents at this point in the branch. */
  readonly artifactIds: readonly string[]
  /** User feedback accumulated before this node. */
  readonly feedback: readonly string[]
  /** Selected expert roles for the next review. */
  readonly reviewerRoles: readonly string[]
}

/** One immutable point in the conversation DAG. */
export interface ResearchNode {
  /** Stable node id. */
  readonly nodeId: string
  /** Parent node, absent only for the root upload node. */
  readonly parentNodeId?: string
  /** Branch that owns this node. */
  readonly branchId: string
  /** Workflow stage represented by this node. */
  readonly stage: ResearchStage
  /** Current stage status. */
  readonly status: ResearchNodeStatus
  /** Artifacts produced by this stage. */
  readonly artifactRefs: readonly string[]
  /** Last human decision, if any. */
  readonly userDecision?: ResearchDecision
  /** Exact memory snapshot used by downstream agents. */
  readonly memorySnapshot: ResearchMemorySnapshot
  /** Optional rejection reason or feedback visible in the branch. */
  readonly userNote?: string
}

/** One named idea branch in the right-hand navigator. */
export interface ResearchBranch {
  /** Stable branch id. */
  readonly branchId: string
  /** Human-facing label. */
  readonly label: string
  /** Node from which this branch diverged. */
  readonly forkNodeId?: string
  /** Node ids in creation order. */
  readonly nodeIds: readonly string[]
}

/** Complete workflow snapshot suitable for a session projection or UI store. */
export interface ResearchState {
  /** All immutable nodes, indexed for O(1) history selection. */
  readonly nodes: Readonly<Record<string, ResearchNode>>
  /** All branches, indexed for the branch navigator. */
  readonly branches: Readonly<Record<string, ResearchBranch>>
  /** Artifacts shared by node references. */
  readonly artifacts: Readonly<Record<string, ResearchArtifact>>
  /** Currently displayed node. */
  readonly selectedNodeId: string
  /** Current branch receiving new work. */
  readonly activeBranchId: string
  /** Monotonic counters make fixture and replay ids deterministic. */
  readonly nextNodeNumber: number
  readonly nextBranchNumber: number
  readonly nextArtifactNumber: number
}

/** Input for appending a user-visible stage output. */
export interface ResearchOutputInput {
  readonly stage: ResearchStage
  readonly title: string
  readonly content: string
  readonly kind: ResearchArtifact['kind']
  readonly source?: string
  readonly status?: ResearchNodeStatus
}

/** Create the empty workflow with an active paper-upload root.
 * @param now - Reserved clock input for deterministic coordinators.
 * @returns A new research state with one active root node.
 */
export function createResearchState(now = 0): ResearchState {
  const branchId = 'branch-1'
  const nodeId = 'node-1'
  const root: ResearchNode = {
    nodeId,
    branchId,
    stage: 'paper-upload',
    status: 'active',
    artifactRefs: [],
    memorySnapshot: { artifactIds: [], feedback: [], reviewerRoles: [] },
  }
  void now
  return {
    nodes: { [nodeId]: root },
    branches: { [branchId]: { branchId, label: '方案 A', nodeIds: [nodeId] } },
    artifacts: {},
    selectedNodeId: nodeId,
    activeBranchId: branchId,
    nextNodeNumber: 2,
    nextBranchNumber: 2,
    nextArtifactNumber: 1,
  }
}

/** Return the selected node, throwing when a corrupted projection references nothing.
 * @param state - Research state to inspect.
 * @returns The selected immutable node.
 */
export function selectedResearchNode(state: ResearchState): ResearchNode {
  const node = state.nodes[state.selectedNodeId]
  if (node === undefined) throw new Error(`research node "${state.selectedNodeId}" is missing`)
  return node
}

/** Append a stage output to the active branch without mutating existing nodes.
 * @param state - Current research state.
 * @param input - User-visible stage output to append.
 * @param createdAt - Timestamp assigned to the artifact.
 * @returns The next state with a new node and artifact.
 */
export function appendResearchOutput(
  state: ResearchState,
  input: ResearchOutputInput,
  createdAt = 0,
): ResearchState {
  const parent = selectedResearchNode(state)
  const artifactId = `artifact-${state.nextArtifactNumber}`
  const nodeId = `node-${state.nextNodeNumber}`
  const artifact: ResearchArtifact = {
    artifactId,
    kind: input.kind,
    title: input.title,
    content: input.content,
    ...(input.source === undefined ? {} : { source: input.source }),
    createdAt,
  }
  const node: ResearchNode = {
    nodeId,
    parentNodeId: parent.nodeId,
    branchId: state.activeBranchId,
    stage: input.stage,
    status: input.status ?? 'awaiting-confirmation',
    artifactRefs: [artifactId],
    memorySnapshot: {
      artifactIds: [...parent.memorySnapshot.artifactIds, artifactId],
      feedback: parent.memorySnapshot.feedback,
      reviewerRoles: parent.memorySnapshot.reviewerRoles,
    },
  }
  const branch = state.branches[state.activeBranchId]
  if (branch === undefined) throw new Error(`research branch "${state.activeBranchId}" is missing`)
  return {
    ...state,
    nodes: { ...state.nodes, [nodeId]: node },
    branches: { ...state.branches, [branch.branchId]: { ...branch, nodeIds: [...branch.nodeIds, nodeId] } },
    artifacts: { ...state.artifacts, [artifactId]: artifact },
    selectedNodeId: nodeId,
    nextNodeNumber: state.nextNodeNumber + 1,
    nextArtifactNumber: state.nextArtifactNumber + 1,
  }
}

/** Confirm a stage, preserving the output and marking it ready for the next stage.
 * @param state - Current research state.
 * @returns The state with the selected node confirmed.
 */
export function confirmResearchNode(state: ResearchState): ResearchState {
  const node = selectedResearchNode(state)
  if (node.status !== 'awaiting-confirmation' && node.status !== 'active') return state
  const confirmed: ResearchNode = { ...node, status: 'confirmed', userDecision: 'confirm' }
  return { ...state, nodes: { ...state.nodes, [node.nodeId]: confirmed } }
}

/** Attach feedback to a node while keeping the node identity stable.
 * @param state - Current research state.
 * @param feedback - User feedback to retain in branch memory.
 * @returns The state with feedback attached to the selected node.
 */
export function addResearchFeedback(state: ResearchState, feedback: string): ResearchState {
  const node = selectedResearchNode(state)
  const trimmed = feedback.trim()
  if (trimmed === '') return state
  const updated: ResearchNode = {
    ...node,
    userDecision: 'feedback',
    userNote: trimmed,
    memorySnapshot: { ...node.memorySnapshot, feedback: [...node.memorySnapshot.feedback, trimmed] },
  }
  return { ...state, nodes: { ...state.nodes, [node.nodeId]: updated } }
}

/**
 * Reject an idea and start a fresh idea-generation branch from the problem
 * summary. The rejected branch remains readable and immutable.
 * @param state - Current research state.
 * @param reason - Optional reason shown on the new branch.
 * @returns The state with a new active idea branch.
 */
export function rejectIdea(state: ResearchState, reason = ''): ResearchState {
  const source = Object.values(state.nodes).find(node => node.stage === 'problem-summary')
  if (source === undefined) throw new Error('research problem summary is required before rejecting an idea')
  const branchId = `branch-${state.nextBranchNumber}`
  const nodeId = `node-${state.nextNodeNumber}`
  const node: ResearchNode = {
    nodeId,
    parentNodeId: source.nodeId,
    branchId,
    stage: 'idea-generation',
    status: 'active',
    artifactRefs: [],
    ...(reason.trim() === '' ? {} : { userNote: reason.trim() }),
    memorySnapshot: source.memorySnapshot,
  }
  return {
    ...state,
    nodes: { ...state.nodes, [nodeId]: node },
    branches: {
      ...state.branches,
      [branchId]: {
        branchId,
        label: `方案 ${String.fromCharCode(65 + state.nextBranchNumber - 2)}`,
        forkNodeId: source.nodeId,
        nodeIds: [source.nodeId, nodeId],
      },
    },
    activeBranchId: branchId,
    selectedNodeId: nodeId,
    nextNodeNumber: state.nextNodeNumber + 1,
    nextBranchNumber: state.nextBranchNumber + 1,
  }
}

/** Continue from a historical node by creating an isolated branch.
 * @param state - Current research state.
 * @param nodeId - Historical node to fork from.
 * @returns The state with a new active continuation branch.
 */
export function continueFromResearchNode(state: ResearchState, nodeId: string): ResearchState {
  const source = state.nodes[nodeId]
  if (source === undefined) throw new Error(`research node "${nodeId}" is missing`)
  const branchId = `branch-${state.nextBranchNumber}`
  const continuationId = `node-${state.nextNodeNumber}`
  const continuation: ResearchNode = {
    nodeId: continuationId,
    parentNodeId: source.nodeId,
    branchId,
    stage: source.stage,
    status: 'active',
    artifactRefs: source.artifactRefs,
    memorySnapshot: source.memorySnapshot,
  }
  return {
    ...state,
    nodes: { ...state.nodes, [continuationId]: continuation },
    branches: {
      ...state.branches,
      [branchId]: {
        branchId,
        label: `回溯 ${state.nextBranchNumber - 1}`,
        forkNodeId: source.nodeId,
        nodeIds: [source.nodeId, continuationId],
      },
    },
    activeBranchId: branchId,
    selectedNodeId: continuationId,
    nextNodeNumber: state.nextNodeNumber + 1,
    nextBranchNumber: state.nextBranchNumber + 1,
  }
}

/** Select a historical node without changing the active branch or its memory.
 * @param state - Current research state.
 * @param nodeId - Node to display.
 * @returns The state with the requested node selected.
 */
export function selectResearchNode(state: ResearchState, nodeId: string): ResearchState {
  if (state.nodes[nodeId] === undefined) throw new Error(`research node "${nodeId}" is missing`)
  return { ...state, selectedNodeId: nodeId }
}

/** Verify that a generated idea makes an explicit, non-empty innovation claim.
 * @param idea - Idea artifact to validate.
 * @returns Nothing when the claim is present.
 */
export function assertInnovationClaim(idea: ResearchArtifact): void {
  if (idea.kind !== 'idea') throw new Error('innovation validation requires an idea artifact')
  const text = idea.content.toLowerCase()
  if (!text.includes('创新') && !text.includes('novel') && !text.includes('innovation')) {
    throw new Error('idea must state an innovation claim before review')
  }
}
