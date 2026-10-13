import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconBranchOutlineRegular, IconCheckOutlineRegular, IconPlayOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ResearchStage, ResearchState } from '@deepseek-ai/dsh-workflow/research'
import {
  addResearchFeedback,
  appendResearchOutput,
  assertInnovationClaim,
  confirmResearchNode,
  continueFromResearchNode,
  createResearchState,
  rejectIdea,
  selectResearchNode,
  selectedResearchNode,
} from './research-client-state.ts'
import type { WorkflowRunKey } from './locales.ts'
import css from './ResearchPanel.module.css'

/** Props for the session-scoped right-sidebar page. */
export type ResearchPanelProps = PropsRuntime<'sidebar.right.pane.tab'> & PropsLocale<'workflowRun'>

const REVIEWER_KEYS = [
  'research.reviewer.method', 'research.reviewer.novelty', 'research.reviewer.repro',
] as const satisfies readonly WorkflowRunKey[]

const STAGE_KEYS = {
  'paper-upload': 'research.paper-upload',
  'paper-read': 'research.paper-read',
  'problem-summary': 'research.problem-summary',
  'literature-search': 'research.literature-search',
  'idea-generation': 'research.idea-generation',
  'idea-refinement': 'research.idea-refinement',
  'multi-agent-review': 'research.multi-agent-review',
  'simulation-or-final-plan': 'research.simulation-or-final-plan',
  'final-plan': 'research.final-plan',
} as const satisfies Record<ResearchStage, WorkflowRunKey>

const NEXT_STAGE: Partial<Record<ResearchStage, ResearchStage>> = {
  'paper-read': 'problem-summary',
  'problem-summary': 'literature-search',
  'literature-search': 'idea-generation',
  'idea-generation': 'idea-refinement',
  'idea-refinement': 'multi-agent-review',
  'multi-agent-review': 'simulation-or-final-plan',
  'simulation-or-final-plan': 'final-plan',
}

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

function placeholder(stage: ResearchStage, title: string, source: string | undefined, t: ResearchPanelProps['t']): { title: string; content: string; kind: 'summary' | 'problem' | 'literature' | 'idea' | 'review' | 'simulation' | 'plan' } {
  switch (stage) {
    case 'paper-read': return { title, kind: 'summary', content: t('research.placeholder.paperRead', { source: source ?? t('research.paper') }) }
    case 'problem-summary': return { title, kind: 'problem', content: t('research.placeholder.problem') }
    case 'literature-search': return { title, kind: 'literature', content: t('research.placeholder.literature') }
    case 'idea-generation': return { title, kind: 'idea', content: t('research.placeholder.idea') }
    case 'idea-refinement': return { title, kind: 'idea', content: t('research.placeholder.refinement') }
    case 'multi-agent-review': return { title, kind: 'review', content: t('research.placeholder.review') }
    case 'simulation-or-final-plan': return { title, kind: 'simulation', content: t('research.placeholder.choice') }
    case 'final-plan': return { title, kind: 'plan', content: t('research.placeholder.plan') }
    case 'paper-upload': return { title, kind: 'summary', content: '' }
    default: throw new Error(`unsupported research stage ${stage satisfies never}`)
  }
}

/** Render the staged research workflow, its branches, artifacts, and checkpoints. */
export function ResearchPanel({ useTabInfo, t }: ResearchPanelProps): ReactNode {
  const { tab } = useTabInfo()
  const [state, setState] = useState<ResearchState>(() => createResearchState())
  const [feedback, setFeedback] = useState('')
  const [source, setSource] = useState<string>()
  const [choice, setChoice] = useState<'simulation' | 'plan'>('plan')
  const [reviewers, setReviewers] = useState<readonly string[]>(REVIEWER_KEYS.map(key => t(key)))
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = selectedResearchNode(state)
  const branch = state.branches[state.activeBranchId]
  const branchNodes = useMemo(
    () => branch?.nodeIds.map(id => state.nodes[id]).filter(node => node !== undefined) ?? [],
    [branch, state.nodes],
  )
  const artifactId = selected.artifactRefs[selected.artifactRefs.length - 1]
  const artifact = artifactId === undefined ? undefined : state.artifacts[artifactId]
  const ideaNeedsReview = selected.stage === 'idea-generation' || selected.stage === 'idea-refinement'

  const produce = (next: ResearchStage, paper?: string): void => {
    const output = placeholder(next, stageText(next, t), paper, t)
    setState(current => appendResearchOutput(current, {
      stage: next,
      title: output.title,
      content: output.content,
      kind: output.kind,
      ...(paper === undefined ? {} : { source: paper }),
    }))
  }

  const upload = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    if (file === undefined) return
    setSource(file.name)
    produce('paper-read', file.name)
    event.target.value = ''
  }

  const confirm = (): void => {
    setState(current => confirmResearchNode(current))
    const next = NEXT_STAGE[selected.stage]
    if (next !== undefined) produce(next, source)
    else if (selected.stage === 'final-plan') setState((current) => {
      const currentNode = selectedResearchNode(current)
      return { ...current, nodes: { ...current.nodes, [current.selectedNodeId]: { ...currentNode, status: 'completed' } } }
    })
  }

  const submitFeedback = (): void => {
    if (feedback.trim() === '') return
    setState(current => addResearchFeedback(current, feedback))
    setFeedback('')
  }

  return (
    <div className={css.root} data-research-panel data-tab-id={tab.id}>
      <div className={css.header}>
        <span className={css.title}>{t('research.title')}</span>
        <span className={css.subtle}>{stageText(selected.stage, t)}</span>
      </div>

      <div>
        <div className={css.subtle}>{t('research.branch')}</div>
        <div className={css.branchRow} aria-label={t('research.branch')}>
          {Object.values(state.branches).map(item => (
            <button
              key={item.branchId}
              type="button"
              className={item.branchId === state.activeBranchId ? `${css.branch} ${css.branchActive}` : css.branch}
              onClick={() => {
                const last = item.nodeIds[item.nodeIds.length - 1]
                if (last !== undefined) setState(current => ({ ...selectResearchNode(current, last), activeBranchId: item.branchId }))
              }}
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
              className={node.nodeId === state.selectedNodeId ? `${css.node} ${css.nodeSelected}` : css.node}
              onClick={() => setState(current => selectResearchNode(current, node.nodeId))}
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
        {selected.stage === 'paper-upload' && (
          <>
            <input ref={inputRef} className={css.fileInput} type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={upload} />
            <button type="button" className={css.primaryButton} onClick={() => inputRef.current?.click()}>
              {t('research.upload')}
            </button>
            <span className={css.subtle}>{t('research.uploadHint')}</span>
          </>
        )}
        {selected.status === 'awaiting-confirmation' && (
          <button type="button" className={css.primaryButton} onClick={confirm}>
            <IconCheckOutlineRegular size={14} /> {t('research.confirm')}
          </button>
        )}
        {ideaNeedsReview && (
          <>
            <div className={css.subtle}>{t('research.innovation')}</div>
            <textarea className={css.feedback} value={feedback} placeholder={t('research.feedbackPlaceholder')} onChange={event => setFeedback(event.target.value)} />
            <div className={css.actionRow}>
              <button type="button" className={css.button} onClick={submitFeedback}>{t('research.feedback')}</button>
              <button type="button" className={css.dangerButton} onClick={() => setState(current => rejectIdea(current, feedback))}>{t('research.reject')}</button>
            </div>
            {selected.stage === 'idea-generation' && (
              <span className={css.subtle}>{t('research.innovationCheck')}{(() => { try { if (artifact !== undefined) assertInnovationClaim(artifact); return t('research.pass') } catch { return t('research.needsWork') } })()}</span>
            )}
          </>
        )}
        {selected.stage === 'multi-agent-review' && (
          <>
            <div className={css.subtle}>{t('research.roles')}</div>
            <div className={css.reviewerRow}>
              {REVIEWER_KEYS.map((key) => {
                const label = t(key)
                return <label key={key} className={css.reviewer}><input type="checkbox" checked={reviewers.includes(label)} onChange={event => setReviewers(current => event.target.checked ? [...current, label] : current.filter(item => item !== label))} />{label}</label>
              })}
            </div>
          </>
        )}
        {selected.stage === 'simulation-or-final-plan' && (
          <div className={css.choiceRow}>
            <button type="button" className={choice === 'simulation' ? `${css.button} ${css.branchActive}` : css.button} onClick={() => setChoice('simulation')}><IconPlayOutlineRegular size={13} /> {t('research.simulate')}</button>
            <button type="button" className={choice === 'plan' ? `${css.button} ${css.branchActive}` : css.button} onClick={() => setChoice('plan')}>{t('research.plan')}</button>
          </div>
        )}
        {selected.nodeId !== branch?.nodeIds[branch.nodeIds.length - 1] && (
          <button type="button" className={css.button} onClick={() => setState(current => continueFromResearchNode(current, selected.nodeId))}>{t('research.continue')}</button>
        )}
      </div>
    </div>
  )
}
