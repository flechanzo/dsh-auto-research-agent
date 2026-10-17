import type { ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ResearchRemote } from '@deepseek-ai/dsh-api-research-controller/client'
import { publishResearchSession, useResearchSession } from './research-session-store.ts'
import css from './ResearchPanel.module.css'

/** Host service used by the conversation-header branch selector. */
export interface ResearchBranchSelectorInjected {
  readonly research: Pick<ResearchRemote, 'read' | 'selectBranch'>
}

type ResearchBranchSelectorProps = Pick<PropsRuntime<'conversation.session.header.tabs'>, 'sessionId' | 'viewId'>
  & PropsLocale<'workflowRun'>
  & ResearchBranchSelectorInjected

/** Select a research branch without opening another application conversation. */
export function ResearchBranchSelector({ sessionId, viewId, research, t }: ResearchBranchSelectorProps): ReactNode {
  const snapshot = useResearchSession(research, sessionId)
  if (viewId !== 'chat') return null
  if (snapshot === undefined) return null
  const branches = Object.values(snapshot.state.branches)
  if (branches.length < 2) return null
  const select = (branchId: string): void => {
    void research.selectBranch({ sessionId, expectedRevision: snapshot.revision, branchId })
      .then((result) => {
        if (result.ok) publishResearchSession(sessionId, result.value.snapshot)
      })
  }
  return (
    <label className={css.branchSelector}>
      <span className={css.branchSelectorLabel}>{t('research.branch')}</span>
      <select
        value={snapshot.state.activeBranchId}
        onChange={(event) => { select(event.currentTarget.value) }}
        aria-label={t('research.branch')}
      >
        {branches.map(branch => <option key={branch.branchId} value={branch.branchId}>{branch.label}</option>)}
      </select>
    </label>
  )
}
