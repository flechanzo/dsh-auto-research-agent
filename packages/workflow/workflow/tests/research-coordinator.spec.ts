import { describe, expect, it } from 'vitest'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import {
  appendResearchOutput,
  confirmResearchNode,
  createResearchState,
  rejectIdea,
  ResearchCoordinator,
  type ResearchCoordinatorAdapters,
} from '../src/index.ts'

const parent = {} as Agent

function adapters(): ResearchCoordinatorAdapters {
  return {
    papers: {
      async read(paper) {
        return { fileName: paper.name, text: 'A paper about retrieval under distribution shift.', byteLength: 48 }
      },
    },
    literature: {
      async search() {
        return [{ url: 'https://example.test/paper', title: 'Related paper', snippet: 'A useful baseline.' }]
      },
    },
    agents: {
      async run(role) {
        switch (role) {
          case 'paper-summarizer': return '问题：检索在分布偏移下退化。方法：固定检索器。限制：缺少自适应评估。'
          case 'problem-extractor': return '研究缺口：分布偏移时检索器无法识别证据失效，需可测量的自适应机制。'
          case 'idea-generator': return '创新点：引入不确定性门控检索；方法是按证据一致性选择检索深度；基线为固定深度检索。'
          case 'idea-refiner': return '创新点：引入可校准的不确定性门控检索，并以跨域校准误差作为失败标准。'
          default: return `${role}：通过；阻塞问题：补充跨域消融；修订：增加三个数据域。`
        }
      },
    },
  }
}

function confirm(state: Parameters<typeof confirmResearchNode>[0]) {
  return confirmResearchNode(state)
}

describe('ResearchCoordinator', () => {
  it('executes every confirmed stage and renders a final plan', async () => {
    const coordinator = new ResearchCoordinator(adapters())
    const paper = { attachmentId: AttachmentId('sha256:paper'), name: 'paper.txt', bytes: 48 } as const
    let state = createResearchState()

    state = (await coordinator.advance({ state, parent, paper })).state
    expect(state.nodes[state.selectedNodeId]?.stage).toBe('paper-read')
    state = confirm(state)
    state = (await coordinator.advance({ state, parent })).state
    state = confirm(state)
    state = (await coordinator.advance({ state, parent })).state
    expect(state.nodes[state.selectedNodeId]?.stage).toBe('literature-search')
    state = confirm(state)
    state = (await coordinator.advance({ state, parent })).state
    expect(state.artifacts[state.nodes[state.selectedNodeId]?.artifactRefs[0] ?? '']?.content).toContain('创新点')
    state = confirm(state)
    state = (await coordinator.advance({ state, parent, reviewerRoles: ['method', 'novelty', 'reproducibility'] })).state
    state = confirm(state)
    state = (await coordinator.advance({ state, parent })).state
    state = confirm(state)
    state = (await coordinator.advance({ state, parent })).state
    expect(state.nodes[state.selectedNodeId]?.stage).toBe('simulation-or-final-plan')
    state = confirm(state)
    const final = await coordinator.advance({ state, parent, finalChoice: 'plan' })
    expect(final.planFile?.fileName).toBe('research-plan.md')
    expect(final.planFile?.content).toContain('# 自动科研方案')
    expect(final.state.nodes[final.state.selectedNodeId]?.stage).toBe('final-plan')
  })

  it('refuses to run a stage whose output is still awaiting confirmation', async () => {
    const coordinator = new ResearchCoordinator(adapters())
    const state = appendResearchOutput(createResearchState(), {
      stage: 'paper-read', kind: 'summary', title: '摘要', content: '内容',
    })
    await expect(coordinator.advance({ state, parent })).rejects.toThrow('requires user confirmation')
  })

  it('requires an innovation claim before multi-agent review', async () => {
    const badAdapters: ResearchCoordinatorAdapters = {
      ...adapters(),
      agents: {
        async run(role) {
          if (role === 'idea-generator') return '没有可验证的新意。'
          return '创新点：占位审查。'
        },
      },
    }
    const coordinator = new ResearchCoordinator(badAdapters)
    let state = createResearchState()
    const paper = { attachmentId: AttachmentId('sha256:paper'), name: 'paper.txt', bytes: 48 } as const
    state = (await coordinator.advance({ state, parent, paper })).state
    state = confirm(state)
    state = (await coordinator.advance({ state, parent })).state
    state = confirm(state)
    state = (await coordinator.advance({ state, parent })).state
    state = confirm(state)
    await expect(coordinator.advance({ state, parent })).rejects.toThrow('innovation claim')
  })

  it('generates a new idea from a rejected branch while retaining literature evidence', async () => {
    const coordinator = new ResearchCoordinator(adapters())
    let state = createResearchState()
    state = appendResearchOutput(state, { stage: 'problem-summary', kind: 'problem', title: '问题', content: '缺口' })
    state = confirm(state)
    state = appendResearchOutput(state, { stage: 'literature-search', kind: 'literature', title: '文献', content: '证据' })
    state = confirm(state)
    state = appendResearchOutput(state, { stage: 'idea-generation', kind: 'idea', title: '旧想法', content: '创新点：旧方案' })
    const oldBranch = state.activeBranchId
    state = rejectIdea(state, '证据不足')
    expect(state.activeBranchId).not.toBe(oldBranch)
    state = (await coordinator.advance({ state, parent })).state
    const node = state.nodes[state.selectedNodeId]
    expect(node?.stage).toBe('idea-generation')
    expect(node?.status).toBe('awaiting-confirmation')
    expect(node?.memorySnapshot.artifactIds.some(id => state.artifacts[id]?.kind === 'literature')).toBe(true)
  })
})
