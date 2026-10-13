import { describe, expect, it } from 'vitest'
import {
  addResearchFeedback,
  appendResearchOutput,
  assertInnovationClaim,
  confirmResearchNode,
  continueFromResearchNode,
  createResearchState,
  rejectIdea,
  selectResearchNode,
} from '../src/research.ts'

describe('research workflow state', () => {
  it('keeps stage outputs visible and confirms them before continuation', () => {
    let state = createResearchState()
    state = appendResearchOutput(state, {
      stage: 'paper-read', kind: 'summary', title: '论文摘要', content: '摘要内容',
    })
    expect(state.nodes[state.selectedNodeId]?.status).toBe('awaiting-confirmation')
    state = confirmResearchNode(state)
    expect(state.nodes[state.selectedNodeId]?.userDecision).toBe('confirm')
  })

  it('rejects an idea into a new branch while preserving the original branch', () => {
    let state = createResearchState()
    state = appendResearchOutput(state, {
      stage: 'problem-summary', kind: 'problem', title: '问题', content: '问题内容',
    })
    state = appendResearchOutput(state, {
      stage: 'idea-generation', kind: 'idea', title: '方案 A', content: '创新点：A',
    })
    const oldBranch = state.activeBranchId
    state = rejectIdea(state, '缺少消融实验')
    expect(state.activeBranchId).not.toBe(oldBranch)
    expect(state.branches[oldBranch]?.nodeIds).toHaveLength(3)
    expect(state.nodes[state.selectedNodeId]?.stage).toBe('idea-generation')
    expect(state.nodes[state.selectedNodeId]?.userNote).toBe('缺少消融实验')
  })

  it('continues from history without mutating the source node', () => {
    let state = appendResearchOutput(createResearchState(), {
      stage: 'problem-summary', kind: 'problem', title: '问题', content: '问题内容',
    })
    const source = state.selectedNodeId
    state = continueFromResearchNode(state, source)
    expect(state.activeBranchId).toBe('branch-2')
    expect(state.nodes[source]?.branchId).toBe('branch-1')
    expect(state.nodes[state.selectedNodeId]?.parentNodeId).toBe(source)
  })

  it('records feedback and enforces an explicit innovation claim', () => {
    let state = appendResearchOutput(createResearchState(), {
      stage: 'idea-generation', kind: 'idea', title: '方案', content: 'innovation: gated retrieval',
    })
    state = addResearchFeedback(state, '加入基线比较')
    expect(state.nodes[state.selectedNodeId]?.memorySnapshot.feedback).toEqual(['加入基线比较'])
    expect(() => assertInnovationClaim({
      artifactId: 'a', kind: 'idea', title: 'bad', content: '没有声明', createdAt: 0,
    })).toThrow('innovation claim')
    expect(() => assertInnovationClaim({
      artifactId: 'a', kind: 'idea', title: 'good', content: '创新点：动态检索', createdAt: 0,
    })).not.toThrow()
  })

  it('selects a historical node without changing the active branch', () => {
    const state = appendResearchOutput(createResearchState(), {
      stage: 'paper-read', kind: 'summary', title: '摘要', content: '内容',
    })
    const selected = selectResearchNode(state, 'node-1')
    expect(selected.selectedNodeId).toBe('node-1')
    expect(selected.activeBranchId).toBe(state.activeBranchId)
  })
})
