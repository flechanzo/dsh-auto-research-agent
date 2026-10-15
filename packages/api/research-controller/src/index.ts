/** Host Remote owner for the confirmed, Session-scoped automatic research workflow. */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import type { FileAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { SessionId } from '@deepseek-ai/dsh-session'
import { defineDomain, domainTable, type Domain } from '@deepseek-ai/dsh-storage-domain'
import { createHostResearchCoordinator, type ResearchAdvanceResult } from '@deepseek-ai/dsh-workflow'
import {
  addResearchFeedback,
  confirmResearchNode,
  continueFromResearchNode,
  createResearchState,
  rejectIdea,
  selectResearchBranch,
  selectResearchNode,
  setResearchReviewerRoles,
  markResearchSessionBoundary,
  researchSourceSessionId,
} from '@deepseek-ai/dsh-workflow'
import type {
  ResearchArtifact,
  ResearchBranch,
  ResearchMemorySnapshot,
  ResearchNode,
  ResearchState,
} from './types.ts'
import z from '@deepseek-ai/schemastery'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { z as zod } from 'zod'
import type {
  ResearchCommandValue,
  ResearchConfirmRequest,
  ResearchContinueRequest,
  ResearchFeedbackRequest,
  ResearchReadRequest,
  ResearchRejectRequest,
  ResearchRestoreRequest,
  ResearchSelectBranchRequest,
  ResearchSelectNodeRequest,
  ResearchSnapshot,
  ResearchUploadRequest,
} from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Session-scoped automatic research Remote owner. */
    researchController: ResearchController
  }
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** Browser state was based on an older durable research revision. */
    'research/stale': { readonly expected: number; readonly actual: number }
    /** A historical node must be continued into a new branch before mutation. */
    'research/history': { readonly nodeId: string; readonly branchId: string }
    /** The selected Session does not exist or cannot be resumed. */
    'research/session-not-found': { readonly sessionId: SessionId }
  }
}

const researchStage = zod.enum([
  'paper-upload', 'paper-read', 'problem-summary', 'literature-search',
  'idea-generation', 'idea-refinement', 'targeted-literature-search', 'multi-agent-review',
  'simulation-or-final-plan', 'final-plan',
])
const researchStatus = zod.enum(['pending', 'active', 'awaiting-confirmation', 'confirmed', 'rejected', 'completed'])
const researchKind = zod.enum(['paper', 'summary', 'problem', 'literature', 'idea', 'review', 'simulation', 'plan', 'decision'])
const researchArtifactInput = zod.object({
  artifactId: zod.string(), kind: researchKind, title: zod.string(), content: zod.string(),
  source: zod.string().optional(), createdAt: zod.number(),
})
const researchArtifact = researchArtifactInput.transform((artifact): ResearchArtifact => ({
  artifactId: artifact.artifactId,
  kind: artifact.kind,
  title: artifact.title,
  content: artifact.content,
  ...(artifact.source === undefined ? {} : { source: artifact.source }),
  createdAt: artifact.createdAt,
}))
const researchMemoryInput = zod.object({
  artifactIds: zod.array(zod.string()), feedback: zod.array(zod.string()), reviewerRoles: zod.array(zod.string()),
})
const researchMemory = researchMemoryInput.transform((memory): ResearchMemorySnapshot => ({
  artifactIds: memory.artifactIds,
  feedback: memory.feedback,
  reviewerRoles: memory.reviewerRoles,
}))
const researchNodeInput = zod.object({
  nodeId: zod.string(), parentNodeId: zod.string().optional(), branchId: zod.string(),
  stage: researchStage, status: researchStatus, artifactRefs: zod.array(zod.string()),
  sessionSeq: zod.number().int().nonnegative().optional(), sourceSessionId: zod.string().optional(),
  userDecision: zod.enum(['confirm', 'reject', 'feedback']).optional(), memorySnapshot: researchMemory,
  userNote: zod.string().optional(),
})
const researchNode = researchNodeInput.transform((node): ResearchNode => ({
  nodeId: node.nodeId,
  ...(node.parentNodeId === undefined ? {} : { parentNodeId: node.parentNodeId }),
  branchId: node.branchId,
  stage: node.stage,
  status: node.status,
  artifactRefs: node.artifactRefs,
  ...(node.sessionSeq === undefined ? {} : { sessionSeq: node.sessionSeq }),
  ...(node.sourceSessionId === undefined ? {} : { sourceSessionId: SessionId(node.sourceSessionId) }),
  memorySnapshot: node.memorySnapshot,
  ...(node.userDecision === undefined ? {} : { userDecision: node.userDecision }),
  ...(node.userNote === undefined ? {} : { userNote: node.userNote }),
}))
const researchBranchInput = zod.object({
  branchId: zod.string(), label: zod.string(), forkNodeId: zod.string().optional(), nodeIds: zod.array(zod.string()),
})
const researchBranch = researchBranchInput.transform((branch): ResearchBranch => ({
  branchId: branch.branchId,
  label: branch.label,
  ...(branch.forkNodeId === undefined ? {} : { forkNodeId: branch.forkNodeId }),
  nodeIds: branch.nodeIds,
}))
const researchStateInput = zod.object({
  nodes: zod.record(zod.string(), researchNode), branches: zod.record(zod.string(), researchBranch),
  artifacts: zod.record(zod.string(), researchArtifact), selectedNodeId: zod.string(), activeBranchId: zod.string(),
  nextNodeNumber: zod.number().int().nonnegative(), nextBranchNumber: zod.number().int().nonnegative(),
  nextArtifactNumber: zod.number().int().nonnegative(),
})
const researchState = researchStateInput.transform((state): ResearchState => ({
  nodes: state.nodes,
  branches: state.branches,
  artifacts: state.artifacts,
  selectedNodeId: state.selectedNodeId,
  activeBranchId: state.activeBranchId,
  nextNodeNumber: state.nextNodeNumber,
  nextBranchNumber: state.nextBranchNumber,
  nextArtifactNumber: state.nextArtifactNumber,
}))

/** Durable row keyed by Session identity; the whole immutable DAG is one record. */
const researchRecord = zod.object({
  revision: zod.number().int().nonnegative(), state: researchState, updatedAt: zod.number().int().nonnegative(),
})

/** One global domain stores all Session sidecars without opening one domain per Session. */
export const researchDomain = defineDomain({
  name: 'research', version: 1,
  tables: { sessions: domainTable<SessionId, ResearchRecord>(researchRecord) },
})

/** Persisted research row inferred from the durable schema. */
export type ResearchRecord = zod.infer<typeof researchRecord>

/** Host limits and provider selection for automatic research. */
export interface Config {
  /** Registered subagent provider used for summarization, ideation, and review. */
  readonly subagentProvider?: string
  /** Relative output path inside the Session workspace. */
  readonly planPath?: string
  /** Maximum uploaded paper bytes read into the summarizer prompt. */
  readonly maxPaperBytes?: number
  /** Maximum Web sources included in one literature step. */
  readonly maxLiteratureResults?: number
  /** Maximum PDF pages inspected and rendered for OCR. */
  readonly maxPdfPages?: number
  /** Initial PDF rendering scale before pixel capping. */
  readonly ocrScale?: number
  /** Maximum width × height for one rendered OCR page. */
  readonly maxOcrPixels?: number
}

type ResolvedConfig = Required<Config>

/** Host service backing `ctx.remote.research`. */
export class ResearchController extends TypertRemoteService {
  static inject = ['attachments', 'fs', 'sessionController', 'storageDomain', 'subagents', 'typert', 'web']

  static Config: z<Config, ResolvedConfig> = z.object({
    subagentProvider: z.string().default('spawn'),
    planPath: z.string().default('research-plan.md'),
    maxPaperBytes: z.natural().min(1).default(20 * 1024 * 1024),
    maxLiteratureResults: z.natural().min(1).max(50).default(8),
    maxPdfPages: z.number().step(1).min(1).max(100).default(12),
    ocrScale: z.number().min(0.25).max(4).default(1.5),
    maxOcrPixels: z.number().step(1).min(1).max(16_000_000).default(4_000_000),
  })

  private readonly config: ResolvedConfig
  private readonly ready: Promise<Domain<typeof researchDomain>>
  private chain: Promise<unknown> = Promise.resolve()

  /**
   * @param ctx - Host services for attachments, Web search, subagents, and Session resumption.
   * @param config - bounded research provider policy.
   */
  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'researchController', { namespace: 'research' })
    this.config = ResearchController.Config(config)
    this.ready = ctx.storageDomain.open(researchDomain)
    ctx.effect(() => async () => { await this.chain; await (await this.ready).close() }, 'research-controller.domain')
  }

  /**
   * Read one persisted research DAG without resuming its Agent.
   * @param request - Session identity to read.
   * @returns The current durable research snapshot.
   */
  @Remote('read')
  async read(request: ResearchReadRequest): Promise<ResearchSnapshot> {
    const record = (await this.ready).table('sessions').get(request.sessionId)
    return this.snapshot(request.sessionId, record)
  }

  /**
   * Upload a paper and run the paper-reading and summarization step.
   * @param request - Session, revision, and uploaded paper reference.
   * @param signal - Cancellation signal for attachment and agent work.
   * @returns The committed snapshot and newly visible summary artifact.
   */
  @Remote('upload')
  upload(request: ResearchUploadRequest, signal: AbortSignal): Promise<ResearchCommandValue> {
    return this.serialize(() => this.advance(request.sessionId, request.expectedRevision, signal, state => ({
      state, paper: request.paper,
    })))
  }

  /**
   * Confirm the current output and run exactly one next stage.
   * @param request - Session, revision, reviewer roles, and optional final choice.
   * @param signal - Cancellation signal for coordinator work.
   * @returns The committed snapshot and stage output when one is generated.
   */
  @Remote('confirm')
  confirm(request: ResearchConfirmRequest, signal: AbortSignal): Promise<ResearchCommandValue> {
    return this.serialize(() => this.advance(request.sessionId, request.expectedRevision, signal, (state) => {
      let next = state
      if (request.reviewerRoles !== undefined) next = setResearchReviewerRoles(next, request.reviewerRoles)
      const confirmed = confirmResearchNode(next)
      return request.finalChoice === undefined
        ? { state: confirmed }
        : { state: confirmed, finalChoice: request.finalChoice }
    }))
  }

  /**
   * Save human feedback without running a model step.
   * @param request - Session, revision, and feedback text.
   * @returns The committed snapshot containing the feedback.
   */
  @Remote('feedback')
  feedback(request: ResearchFeedbackRequest): Promise<ResearchCommandValue> {
    return this.serialize(async () => {
      const current = await this.current(request.sessionId, request.expectedRevision)
      this.requireActiveTail(current.state, request.sessionId)
      const state = addResearchFeedback(current.state, request.feedback)
      return this.commit(request.sessionId, current.revision, state)
    })
  }

  /**
   * Reject the selected idea, create an isolated branch, and generate its first idea.
   * @param request - Session, revision, and optional rejection reason.
   * @param signal - Cancellation signal for coordinator work.
   * @returns The committed snapshot and replacement idea artifact.
   */
  @Remote('reject')
  reject(request: ResearchRejectRequest, signal: AbortSignal): Promise<ResearchCommandValue> {
    return this.serialize(() => this.advance(request.sessionId, request.expectedRevision, signal, state => ({
      state: rejectIdea(state, request.reason),
    })))
  }

  /**
   * Select an existing branch without mutating its historical nodes.
   * @param request - Session, revision, and branch identity.
   * @returns The committed snapshot with the branch selected.
   */
  @Remote('selectBranch')
  selectBranch(request: ResearchSelectBranchRequest): Promise<ResearchCommandValue> {
    return this.serialize(async () => {
      const current = await this.current(request.sessionId, request.expectedRevision)
      return this.commit(request.sessionId, current.revision, selectResearchBranch(current.state, request.branchId))
    })
  }

  /**
   * Select a historical node for inspection.
   * @param request - Session, revision, and node identity.
   * @returns The committed snapshot with the node selected.
   */
  @Remote('selectNode')
  selectNode(request: ResearchSelectNodeRequest): Promise<ResearchCommandValue> {
    return this.serialize(async () => {
      const current = await this.current(request.sessionId, request.expectedRevision)
      return this.commit(request.sessionId, current.revision, selectResearchNode(current.state, request.nodeId))
    })
  }

  /**
   * Continue from a historical node in a new isolated branch.
   * @param request - Session, revision, and source node identity.
   * @returns The committed snapshot with the continuation selected.
   */
  @Remote('continueFromNode')
  continueFromNode(request: ResearchContinueRequest): Promise<ResearchCommandValue> {
    return this.serialize(async () => {
      const current = await this.current(request.sessionId, request.expectedRevision)
      return this.commit(request.sessionId, current.revision, continueFromResearchNode(current.state, request.nodeId))
    })
  }

  /**
   * Restore a historical stage by forking the Session at its recorded boundary.
   * @param request - Session, revision, and historical node identity.
   * @returns The new Session snapshot with the selected historical branch.
   */
  @Remote('restore')
  restore(request: ResearchRestoreRequest): Promise<ResearchCommandValue> {
    return this.serialize(async () => {
      const current = await this.current(request.sessionId, request.expectedRevision)
      const source = current.state.nodes[request.nodeId]
      if (source === undefined) {
        throw new RemoteError('gateway/bad-request', `research node "${request.nodeId}" does not exist`, {})
      }
      const branchState = continueFromResearchNode(current.state, request.nodeId)
      if (source.sessionSeq === undefined) {
        return this.commit(request.sessionId, current.revision, branchState)
      }
      const sourceSessionId = researchSourceSessionId(source, request.sessionId)
      const fork = await this.ctx.sessionController.fork({
        sessionId: sourceSessionId,
        atSeq: source.sessionSeq,
      })
      const forkedState = markResearchSessionBoundary(branchState, source.sessionSeq, fork.sessionId)
      const childRevision = 1
      await (await this.ready).table('sessions').put(fork.sessionId, {
        revision: childRevision, state: forkedState, updatedAt: Date.now(),
      })
      return {
        snapshot: { sessionId: fork.sessionId, revision: childRevision, state: forkedState },
      }
    })
  }

  private async advance(
    sessionId: SessionId,
    expectedRevision: number,
    signal: AbortSignal,
    prepare: (state: ResearchState) => {
      readonly state: ResearchState
      readonly paper?: FileAttachmentRef
      readonly finalChoice?: 'simulation' | 'plan'
    },
  ): Promise<ResearchCommandValue> {
    const current = await this.current(sessionId, expectedRevision)
    this.requireActiveTail(current.state, sessionId)
    const prepared = prepare(current.state)
    const agent = await this.agent(sessionId)
    const coordinator = createHostResearchCoordinator({
      attachments: this.ctx.attachments,
      web: this.ctx.web,
      subagents: this.ctx.subagents,
      fs: agent.ctx.get('fs') ?? this.ctx.fs,
    }, {
      subagentProvider: this.config.subagentProvider,
      planPath: this.config.planPath,
      maxPaperBytes: this.config.maxPaperBytes,
      maxLiteratureResults: this.config.maxLiteratureResults,
      maxPdfPages: this.config.maxPdfPages,
      ocrScale: this.config.ocrScale,
      maxOcrPixels: this.config.maxOcrPixels,
    })
    const result: ResearchAdvanceResult = await coordinator.advance({
      state: prepared.state,
      parent: agent,
      ...(prepared.paper === undefined ? {} : { paper: prepared.paper }),
      ...(prepared.finalChoice === undefined ? {} : { finalChoice: prepared.finalChoice }),
      signal,
    })
    const lastEventSeq = Number(agent.session.seq) - 1
    const state = lastEventSeq < 0
      ? result.state
      : markResearchSessionBoundary(result.state, lastEventSeq, sessionId)
    return this.commit(sessionId, current.revision, state, { ...result, state })
  }

  private async agent(sessionId: SessionId): Promise<Agent> {
    const result = await this.ctx.sessionController.resolveAgent(sessionId)
    if ('error' in result) throw result.error
    return result.agent
  }

  private async current(sessionId: SessionId, expectedRevision: number): Promise<ResearchSnapshot> {
    const snapshot = this.snapshot(sessionId, (await this.ready).table('sessions').get(sessionId))
    if (snapshot.revision !== expectedRevision) {
      throw new RemoteError('research/stale', 'Research state changed; reload this Session before retrying.', {
        expected: expectedRevision, actual: snapshot.revision,
      })
    }
    return snapshot
  }

  private requireActiveTail(state: ResearchState, sessionId: SessionId): void {
    const selected = state.nodes[state.selectedNodeId]
    if (selected?.sourceSessionId !== undefined && selected.sourceSessionId !== sessionId) {
      throw new RemoteError('research/history', 'Restore this node into its source Session before changing it.', {
        nodeId: state.selectedNodeId,
        branchId: state.activeBranchId,
      })
    }
    const branch = state.branches[state.activeBranchId]
    if (branch?.nodeIds.at(-1) !== state.selectedNodeId) {
      throw new RemoteError('research/history', 'Continue from the selected historical node before changing it.', {
        nodeId: state.selectedNodeId,
        branchId: state.activeBranchId,
      })
    }
  }

  private async commit(
    sessionId: SessionId,
    previousRevision: number,
    state: ResearchState,
    result?: ResearchAdvanceResult,
  ): Promise<ResearchCommandValue> {
    const nextRevision = previousRevision + 1
    await (await this.ready).table('sessions').put(sessionId, {
      revision: nextRevision, state, updatedAt: Date.now(),
    })
    return {
      snapshot: { sessionId, revision: nextRevision, state },
      ...(result?.artifact === undefined ? {} : { artifact: result.artifact }),
      ...(result?.planFile === undefined ? {} : { planFile: result.planFile }),
    }
  }

  private snapshot(sessionId: SessionId, record: ResearchRecord | undefined): ResearchSnapshot {
    return record === undefined
      ? { sessionId, revision: 0, state: createResearchState(Date.now()) }
      : { sessionId, revision: record.revision, state: record.state }
  }

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const next = this.chain.then(work)
    this.chain = next.catch(() => undefined)
    return next
  }
}

export default ResearchController
