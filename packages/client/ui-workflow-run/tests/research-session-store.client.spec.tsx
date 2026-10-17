// @vitest-environment jsdom
import { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ResearchRemote } from '@deepseek-ai/dsh-api-research-controller/client'
import { appendResearchOutput, createResearchState } from '@deepseek-ai/dsh-workflow'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh } from '../src/client/locales.ts'
import { ResearchTranscriptMain } from '../src/client/ResearchTranscriptMain.tsx'
import {
  loadResearchSession,
  publishResearchSession,
  researchSessionSnapshot,
  subscribeResearchSession,
} from '../src/client/research-session-store.ts'

afterEach(cleanup)

function state(content: string) {
  return appendResearchOutput(createResearchState(), {
    stage: 'paper-read', kind: 'summary', title: '摘要', content,
  })
}

describe('research session store', () => {
  it('keeps the newest revision when an older read completes later', () => {
    const sessionId = SessionId('research-store-revision')
    const listener = vi.fn()
    const dispose = subscribeResearchSession(sessionId, listener)

    publishResearchSession(sessionId, { sessionId, revision: 2, state: state('new') })
    publishResearchSession(sessionId, { sessionId, revision: 1, state: state('old') })

    expect(researchSessionSnapshot(sessionId)?.revision).toBe(2)
    expect(researchSessionSnapshot(sessionId)?.state.artifacts['artifact-1']?.content).toBe('new')
    expect(listener).toHaveBeenCalledOnce()
    dispose()
  })

  it('publishes a remote read to every projection and returns the shared snapshot', async () => {
    const sessionId = SessionId('research-store-load')
    const listener = vi.fn()
    const dispose = subscribeResearchSession(sessionId, listener)
    const remote: Pick<ResearchRemote, 'read'> = {
      read: async () => ({ ok: true, value: { sessionId, revision: 3, state: state('loaded') } }),
    }

    const result = await loadResearchSession(remote, sessionId)

    expect(result).toEqual({ ok: true, value: researchSessionSnapshot(sessionId) })
    expect(researchSessionSnapshot(sessionId)?.state.artifacts['artifact-1']?.content).toBe('loaded')
    expect(listener).toHaveBeenCalledOnce()
    dispose()
  })

  it('keeps completed ancestors visible while viewing a historical node', async () => {
    const sessionId = SessionId('research-store-history-view')
    let historical = appendResearchOutput(createResearchState(), {
      stage: 'paper-read', kind: 'summary', title: '第一阶段', content: 'first',
    })
    historical = appendResearchOutput(historical, {
      stage: 'problem-summary', kind: 'problem', title: '第二阶段', content: 'second',
    })
    historical = appendResearchOutput(historical, {
      stage: 'literature-search', kind: 'literature', title: '第三阶段', content: 'third',
    })
    historical = { ...historical, selectedNodeId: 'node-2' }
    const remote: Pick<ResearchRemote, 'read' | 'selectNode'> = {
      read: async () => ({ ok: true, value: { sessionId, revision: 3, state: historical } }),
      selectNode: vi.fn(),
    }

    const view = render(<ResearchTranscriptMain sessionId={sessionId} research={remote} t={makeTranslate(zh)} />)
    await waitFor(() => {
      expect(view.container.querySelectorAll('[data-research-main-node]')).toHaveLength(2)
    })
    expect(view.container.querySelector('[data-research-main-node="node-1"]')).toBeTruthy()
    expect(view.container.querySelector('[data-research-main-node="node-2"]')).toBeTruthy()
    expect(view.container.querySelector('[data-research-main-node="node-3"]')).toBeNull()
  })
})
