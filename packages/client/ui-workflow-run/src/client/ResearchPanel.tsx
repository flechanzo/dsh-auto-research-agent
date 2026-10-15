import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconBranchOutlineRegular, IconCheckOutlineRegular, IconPlayOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  ResearchArtifact,
  ResearchCommandValue,
  ResearchDirectionWeights,
  ResearchLiteratureSourceId,
  ResearchNode,
  ResearchRemote,
  ResearchSnapshot,
  ResearchStage,
  ResearchState,
} from '@deepseek-ai/dsh-api-research-controller/client'
import type { FileUploadService } from '@deepseek-ai/dsh-client-file-upload/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { WorkflowRunKey } from './locales.ts'
import css from './ResearchPanel.module.css'

/** Props for the session-scoped right-sidebar page. */
export type ResearchPanelProps = PropsRuntime<'sidebar.right.pane.tab'> & PropsLocale<'workflowRun'> & ResearchPanelInjected

/** Host-backed services used by the research panel. */
export interface ResearchPanelInjected {
  /** Session-scoped automatic research Remote namespace. */
  readonly research: ResearchRemote
  /** Browser file upload service that returns an attachment reference. */
  readonly fileUpload: FileUploadService
  /** Open a forked Session when the user restores a historical stage. */
  readonly openSession: (sessionId: ResearchSnapshot['sessionId']) => void
}

const REVIEWER_ROLES = [
  { key: 'research.reviewer.method', role: 'method' },
  { key: 'research.reviewer.novelty', role: 'novelty' },
  { key: 'research.reviewer.repro', role: 'reproducibility' },
] as const satisfies readonly { key: WorkflowRunKey; role: string }[]

const DEFAULT_DIRECTION_WEIGHTS: ResearchDirectionWeights = {
  novelty: 30, impact: 25, feasibility: 25, reproducibility: 20,
}

const STAGE_KEYS = {
  'paper-upload': 'research.paper-upload',
  'paper-read': 'research.paper-read',
  'problem-summary': 'research.problem-summary',
  'literature-search': 'research.literature-search',
  'idea-generation': 'research.idea-generation',
  'idea-refinement': 'research.idea-refinement',
  'targeted-literature-search': 'research.targeted-literature-search',
  'multi-agent-review': 'research.multi-agent-review',
  'simulation-or-final-plan': 'research.simulation-or-final-plan',
  'final-plan': 'research.final-plan',
} as const satisfies Record<ResearchStage, WorkflowRunKey>

function stageText(stage: ResearchStage, t: ResearchPanelProps['t']): string {
  return t(STAGE_KEYS[stage])
}

function statusText(status: ReturnType<typeof selectedResearchNode>['status'], t: ResearchPanelProps['t']): string {
  switch (status) {
    case 'active': return t('research.active')
    case 'awaiting-confirmation': return t('research.awaiting')
    case 'confirmed': return t('research.confirmed')
    case 'completed': return t('research.completed')
    case 'rejected': return t('research.rejected')
    case 'pending': return t('research.active')
    default: return status satisfies never
  }
}

function initialResearchState(label: string): ResearchState {
  const node: ResearchNode = {
    nodeId: 'node-1', branchId: 'branch-1', stage: 'paper-upload', status: 'active', artifactRefs: [],
    memorySnapshot: {
      artifactIds: [], feedback: [], reviewerRoles: [],
      directionWeights: { ...DEFAULT_DIRECTION_WEIGHTS }, literatureSources: ['web', 'arxiv'],
    },
  }
  return {
    nodes: { [node.nodeId]: node },
    branches: { 'branch-1': { branchId: 'branch-1', label, nodeIds: [node.nodeId] } },
    artifacts: {}, selectedNodeId: node.nodeId, activeBranchId: 'branch-1',
    nextNodeNumber: 2, nextBranchNumber: 2, nextArtifactNumber: 1,
  }
}

function selectedResearchNode(state: ResearchState): ResearchNode {
  const node = state.nodes[state.selectedNodeId]
  if (node === undefined) throw new Error(`research node "${state.selectedNodeId}" is missing`)
  return node
}

function latestArtifact(state: ResearchState, node: ResearchNode): ResearchArtifact | undefined {
  const artifactId = node.artifactRefs[node.artifactRefs.length - 1]
  return artifactId === undefined ? undefined : state.artifacts[artifactId]
}

function innovationClaimPasses(artifact: ResearchArtifact | undefined): boolean {
  if (artifact === undefined || artifact.kind !== 'idea') return false
  const text = artifact.content.toLowerCase()
  return text.includes('创新') || text.includes('novel') || text.includes('innovation')
}

function failureText(failure: { readonly message: string; readonly code: string }, t: ResearchPanelProps['t']): string {
  return failure.code === 'research/stale' ? t('research.error.stale') : t('research.error.operation', { message: failure.message })
}

/** Render the staged research workflow, its branches, artifacts, and checkpoints. */
export function ResearchPanel({ useTabInfo, sessionId, research, fileUpload, openSession, t }: ResearchPanelProps): ReactNode {
  const { tab } = useTabInfo()
  const [state, setState] = useState<ResearchState>()
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [feedback, setFeedback] = useState('')
  const [choice, setChoice] = useState<'simulation' | 'plan'>('plan')
  const [directionWeights, setDirectionWeights] = useState<ResearchDirectionWeights>(DEFAULT_DIRECTION_WEIGHTS)
  const [literatureSources, setLiteratureSources] = useState<readonly ResearchLiteratureSourceId[]>(['web', 'arxiv'])
  const [reviewers, setReviewers] = useState<readonly string[]>(REVIEWER_ROLES.map(item => item.role))
  const inputRef = useRef<HTMLInputElement>(null)
  const displayState = state ?? initialResearchState(t('research.defaultBranch'))
  const selected = selectedResearchNode(displayState)
  const branch = displayState.branches[displayState.activeBranchId]
  const branchNodes = useMemo(
    () => branch?.nodeIds.map(id => displayState.nodes[id]).filter(node => node !== undefined) ?? [],
    [branch, displayState.nodes],
  )
  const isHistorical = selected.nodeId !== branch?.nodeIds.at(-1)
  const sessionMismatch = selected.sourceSessionId !== undefined && selected.sourceSessionId !== sessionId
  const canMutate = !isHistorical && !sessionMismatch
  const canContinue = !sessionMismatch && isHistorical && selected.stage !== 'paper-upload' && selected.stage !== 'final-plan'
  const canRestore = selected.sessionSeq !== undefined && (isHistorical || sessionMismatch)
  const artifact = latestArtifact(displayState, selected)
  const ideaNeedsReview = selected.stage === 'idea-generation' || selected.stage === 'idea-refinement'

  useEffect(() => {
    let disposed = false
    const load = async (): Promise<void> => {
      setLoading(true)
      setError(undefined)
      setState(undefined)
      setRevision(0)
      try {
        const result = await research.read({ sessionId })
        if (disposed) return
        if (result.ok) {
          setRevision(result.value.revision)
          setState(result.value.state)
        } else {
          setError(failureText(result.error, t))
        }
      } catch {
        if (!disposed) setError(t('research.error.request'))
      } finally {
        if (!disposed) setLoading(false)
      }
    }
    void load()
    return () => { disposed = true }
  }, [research, sessionId, t])

  useEffect(() => {
    setReviewers(selected.memorySnapshot.reviewerRoles.length > 0
      ? selected.memorySnapshot.reviewerRoles
      : REVIEWER_ROLES.map(item => item.role))
  }, [selected.nodeId, selected.memorySnapshot.reviewerRoles])

  useEffect(() => {
    setDirectionWeights(selected.memorySnapshot.directionWeights ?? DEFAULT_DIRECTION_WEIGHTS)
    setLiteratureSources(selected.memorySnapshot.literatureSources ?? ['web', 'arxiv'])
  }, [selected.nodeId, selected.memorySnapshot.directionWeights, selected.memorySnapshot.literatureSources])

  const execute = async (operation: () => Promise<RemoteResult<ResearchCommandValue>>): Promise<ResearchCommandValue | undefined> => {
    if (busy) return undefined
    setBusy(true)
    setError(undefined)
    try {
      const result = await operation()
      if (!result.ok) {
        setError(failureText(result.error, t))
        return undefined
      }
      // A restore forks the Session and returns the child snapshot before the
      // workspace navigation completes. Keep the source panel unchanged until
      // its sessionId changes so edits cannot target the wrong Session.
      if (result.value.snapshot.sessionId === sessionId) {
        setRevision(result.value.snapshot.revision)
        setState(result.value.snapshot.state)
      }
      return result.value
    } catch {
      setError(t('research.error.request'))
      return undefined
    } finally {
      setBusy(false)
    }
  }

  const upload = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    if (file === undefined) return
    event.target.value = ''
    void execute(async () => {
      const uploaded = await fileUpload.upload(sessionId, file, file.name, tab.signal)
      if (!uploaded.ok) return uploaded
      return research.upload({ sessionId, expectedRevision: revision, paper: uploaded.value.file }, tab.signal)
    })
  }

  const confirm = (): void => {
    void execute(() => research.confirm({
      sessionId, expectedRevision: revision,
      ...(selected.stage === 'targeted-literature-search' ? { reviewerRoles: reviewers } : {}),
      ...(selected.stage === 'problem-summary' ? { directionWeights, literatureSources } : {}),
      ...(selected.stage === 'simulation-or-final-plan' ? { finalChoice: choice } : {}),
    }, tab.signal))
  }

  const submitFeedback = (): void => {
    if (feedback.trim() === '') return
    void execute(() => research.feedback({ sessionId, expectedRevision: revision, feedback })).then((success) => {
      if (success !== undefined) setFeedback('')
    })
  }

  const reject = (): void => {
    void execute(() => research.reject({
      sessionId, expectedRevision: revision,
      ...(feedback.trim() === '' ? {} : { reason: feedback }),
    }, tab.signal))
  }

  const selectBranch = (branchId: string): void => {
    void execute(() => research.selectBranch({ sessionId, expectedRevision: revision, branchId }))
  }

  const selectNode = (nodeId: string): void => {
    void execute(() => research.selectNode({ sessionId, expectedRevision: revision, nodeId }))
  }

  const continueFromNode = (nodeId: string): void => {
    void execute(() => research.continueFromNode({ sessionId, expectedRevision: revision, nodeId }))
  }

  const restoreNode = (): void => {
    if (selected.sessionSeq === undefined) return
    void execute(() => research.restore({ sessionId, expectedRevision: revision, nodeId: selected.nodeId }))
      .then((result) => {
        if (result !== undefined && result.snapshot.sessionId !== sessionId) openSession(result.snapshot.sessionId)
      })
  }

  return (
    <div className={css.root} data-research-panel data-tab-id={tab.id} aria-busy={loading || busy}>
      <div className={css.header}>
        <span className={css.title}>{t('research.title')}</span>
        <span className={css.subtle}>{stageText(selected.stage, t)}</span>
      </div>

      <div>
        <div className={css.subtle}>{t('research.branch')}</div>
        <div className={css.branchRow} aria-label={t('research.branch')}>
          {Object.values(displayState.branches).map(item => (
            <button
              key={item.branchId}
              type="button"
              className={item.branchId === displayState.activeBranchId ? `${css.branch} ${css.branchActive}` : css.branch}
              onClick={() => { selectBranch(item.branchId) }}
              disabled={busy || item.branchId === displayState.activeBranchId}
            >
              <IconBranchOutlineRegular size={13} /> {item.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className={css.subtle}>{t('research.history')}</div>
        <div className={css.timeline} aria-label={t('research.history')}>
          {branchNodes.map(node => (
            <button
              key={node.nodeId}
              type="button"
              className={node.nodeId === displayState.selectedNodeId ? `${css.node} ${css.nodeSelected}` : css.node}
              onClick={() => { selectNode(node.nodeId) }}
              disabled={busy || node.nodeId === displayState.selectedNodeId}
            >
              <span className={css.nodeStage}>{stageText(node.stage, t)}</span>
              <span className={css.nodeStatus}>{statusText(node.status, t)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={css.card}>
        <div className={css.cardTitle}>{artifact?.title ?? stageText(selected.stage, t)}</div>
        <pre className={css.content}>{artifact?.content || t('research.emptyArtifact')}</pre>
        {artifact?.evaluation !== undefined && (
          <div className={artifact.evaluation.overlap || artifact.evaluation.score < artifact.evaluation.threshold
            ? css.notice
            : css.successNotice}>
            {t('research.evaluation', { score: artifact.evaluation.score, threshold: artifact.evaluation.threshold })}
            {' '}{artifact.evaluation.overlap ? t('research.overlap') : t('research.noOverlap')}
            <div>{artifact.evaluation.rationale}</div>
          </div>
        )}
        {artifact?.kind === 'plan' && artifact.source !== undefined && (
          <div className={css.successNotice}>{t('research.planWritten', { path: artifact.source })}</div>
        )}
        {error !== undefined && <div className={css.notice} role="alert">{error}</div>}
        {canMutate && selected.stage === 'problem-summary' && (
          <div className={css.directionControls}>
            <div className={css.subtle}>{t('research.directionTitle')}</div>
            {([
              ['novelty', 'research.direction.novelty'],
              ['impact', 'research.direction.impact'],
              ['feasibility', 'research.direction.feasibility'],
              ['reproducibility', 'research.direction.reproducibility'],
            ] as const).map(([key, labelKey]) => (
              <label key={key} className={css.weightRow}>
                <span>{t(labelKey)}</span>
                <input type="range" min="0" max="100" step="1" value={directionWeights[key]} aria-label={t(labelKey)} onChange={(event) => { setDirectionWeights(current => ({ ...current, [key]: Number(event.target.value) })) }} />
                <output>{directionWeights[key]}</output>
              </label>
            ))}
            <div className={css.subtle}>{t('research.literatureSources')}</div>
            <div className={css.reviewerRow}>
              {([
                ['web', 'research.source.web'],
                ['arxiv', 'research.source.arxiv'],
              ] as const).map(([source, labelKey]) => (
                <label key={source} className={css.reviewer}>
                  <input type="checkbox" checked={literatureSources.includes(source)} onChange={(event) => { setLiteratureSources(current => event.target.checked ? [...new Set([...current, source])] : current.filter(item => item !== source)) }} />
                  {t(labelKey)}
                </label>
              ))}
            </div>
          </div>
        )}
        {selected.stage === 'paper-upload' && (
          <>
            <input ref={inputRef} className={css.fileInput} type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={upload} />
            <button type="button" className={css.primaryButton} disabled={busy || loading} onClick={() => inputRef.current?.click()}>
              {t('research.upload')}
            </button>
            <span className={css.subtle}>{t('research.uploadHint')}</span>
          </>
        )}
        {canMutate && ((selected.status === 'awaiting-confirmation' || selected.status === 'confirmed')
          || (selected.status === 'active' && selected.stage !== 'paper-upload')) && (
          <button type="button" className={css.primaryButton} disabled={busy || loading} onClick={confirm}>
            <IconCheckOutlineRegular size={14} /> {t('research.confirm')}
          </button>
        )}
        {canMutate && ideaNeedsReview && (
          <>
            <div className={css.subtle}>{t('research.innovation')}</div>
            <textarea className={css.feedback} value={feedback} placeholder={t('research.feedbackPlaceholder')} onChange={(event) => { setFeedback(event.target.value) }} />
            <div className={css.actionRow}>
              <button type="button" className={css.button} disabled={busy || loading} onClick={submitFeedback}>{t('research.feedback')}</button>
              <button type="button" className={css.dangerButton} disabled={busy || loading} onClick={reject}>{t('research.reject')}</button>
            </div>
            {selected.stage === 'idea-generation' && (
              <span className={css.subtle}>{t('research.innovationCheck')}{innovationClaimPasses(artifact) ? t('research.pass') : t('research.needsWork')}</span>
            )}
          </>
        )}
        {canMutate && selected.stage === 'targeted-literature-search' && (
          <>
            <div className={css.subtle}>{t('research.roles')}</div>
            <div className={css.reviewerRow}>
              {REVIEWER_ROLES.map(({ key, role }) => {
                const label = t(key)
                return <label key={key} className={css.reviewer}><input type="checkbox" disabled={busy || loading} checked={reviewers.includes(role)} onChange={(event) => { setReviewers(current => event.target.checked ? [...current, role] : current.filter(item => item !== role)) }} />{label}</label>
              })}
            </div>
          </>
        )}
        {canMutate && selected.stage === 'simulation-or-final-plan' && (
          <div className={css.choiceRow}>
            <button type="button" disabled={busy || loading} className={choice === 'simulation' ? `${css.button} ${css.branchActive}` : css.button} onClick={() => { setChoice('simulation') }}><IconPlayOutlineRegular size={13} /> {t('research.simulate')}</button>
            <button type="button" disabled={busy || loading} className={choice === 'plan' ? `${css.button} ${css.branchActive}` : css.button} onClick={() => { setChoice('plan') }}>{t('research.plan')}</button>
          </div>
        )}
        {(canContinue || canRestore) && (
          <div className={css.actionRow}>
            {canRestore && (
              <button type="button" disabled={busy || loading} className={css.primaryButton} onClick={restoreNode}>{t('research.restore')}</button>
            )}
            {canContinue && (
              <button type="button" disabled={busy || loading} className={css.button} onClick={() => { continueFromNode(selected.nodeId) }}>{t('research.continue')}</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
