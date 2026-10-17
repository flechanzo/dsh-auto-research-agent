import type { ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  ResearchArtifact,
  ResearchNode,
  ResearchRemote,
  ResearchState,
  ResearchStage,
} from '@deepseek-ai/dsh-api-research-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkflowRunKey } from './locales.ts'
import { useResearchSession } from './research-session-store.ts'
import css from './ResearchPanel.module.css'

/** Host services for the center transcript projection. */
export interface ResearchTranscriptInjected {
  readonly research: ResearchRemote
  readonly openPanel: (sessionId: SessionId) => void
}

type ResearchTranscriptProps = PropsRuntime<'conversation.composer.dock'>
  & PropsLocale<'workflowRun'>
  & ResearchTranscriptInjected

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

function stageText(stage: ResearchStage, t: ResearchTranscriptProps['t']): string {
  return t(STAGE_KEYS[stage])
}

function latestArtifact(state: ResearchState, node: ResearchNode): ResearchArtifact | undefined {
  const artifactId = node.artifactRefs.at(-1)
  return artifactId === undefined ? undefined : state?.artifacts[artifactId]
}

/** Render the same research snapshot below the center composer as the right panel displays. */
export function ResearchTranscriptDock({ sessionId, research, openPanel, t }: ResearchTranscriptProps): ReactNode {
  const snapshot = useResearchSession(research, sessionId)
  if (snapshot === undefined) return null
  const state = snapshot.state
  const selected = state.nodes[state.selectedNodeId]
  if (selected === undefined) return null
  const nodes = Object.values(state.nodes)
    .filter(node => node.branchId === state.activeBranchId)
    .sort((left, right) => (left.sessionSeq ?? Number.MAX_SAFE_INTEGER) - (right.sessionSeq ?? Number.MAX_SAFE_INTEGER))
  const artifact = latestArtifact(state, selected)
  return (
    <section className={css.transcript} data-research-center-transcript data-research-selected-node={selected.nodeId}>
      <div className={css.header}>
        <span className={css.cardTitle}>{t('research.title')}</span>
        <span className={css.subtle}>{stageText(selected.stage, t)}</span>
        <button type="button" className={css.button} onClick={() => { openPanel(sessionId) }}>
          {t('research.open')}
        </button>
      </div>
      <div className={css.timeline} aria-label={t('research.stageContents')}>
        {nodes.map(node => (
          <span key={node.nodeId} className={node.nodeId === selected.nodeId ? `${css.node} ${css.nodeSelected}` : css.node}>
            <span className={css.nodeStage}>{stageText(node.stage, t)}</span>
            <span className={css.nodeStatus}>{node.status}</span>
          </span>
        ))}
      </div>
      <details open={artifact !== undefined} className={css.transcriptItem}>
        <summary>{artifact?.title ?? stageText(selected.stage, t)}</summary>
        <pre className={css.content}>{artifact?.content || t('research.emptyArtifact')}</pre>
      </details>
    </section>
  )
}
