import { describe, expect, it } from 'vitest'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import {
  appendResearchOutput,
  confirmResearchNode,
  createAttachmentPaperReader,
  createHostResearchCoordinator,
  createWebLiteratureSearcher,
  createResearchState,
  rejectIdea,
  ResearchCoordinator,
  type ResearchCoordinatorAdapters,
} from '../src/index.ts'
import { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import { FileSystem, FsTargetKey, FsVersion, type FsTarget, type FsWriteIntent } from '@deepseek-ai/dsh-fs'
import { SubagentRuntime } from '@deepseek-ai/dsh-subagent'
import { WebRuntime } from '@deepseek-ai/dsh-web'
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox'

const parent = {} as Agent

function adapters(searchQueries: string[] = [], planWriter?: ResearchCoordinatorAdapters['planWriter']): ResearchCoordinatorAdapters {
  return {
    papers: {
      async read(paper) {
        return {
          fileName: paper.name,
          text: 'A paper about retrieval under distribution shift.',
          byteLength: 48,
          extractionMethod: 'plain-text',
        }
      },
    },
    literature: {
      async search(query) {
        searchQueries.push(query)
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
          case 'innovation-reviewer': return '{"score": 88, "overlap": false, "rationale": "候选方法与给定基线有明确机制差异。"}'
          default: return `${role}：通过；阻塞问题：补充跨域消融；修订：增加三个数据域。`
        }
      },
    },
    ...(planWriter === undefined ? {} : { planWriter }),
  }
}

function confirm(state: Parameters<typeof confirmResearchNode>[0]) {
  return confirmResearchNode(state)
}

describe('ResearchCoordinator', () => {
  it('reads several uploaded papers in one comparative stage', async () => {
    const prompts: string[] = []
    const base = adapters()
    const coordinator = new ResearchCoordinator({
      ...base,
      agents: {
        async run(role, prompt, owner, signal) {
          prompts.push(prompt)
          return base.agents.run(role, prompt, owner, signal)
        },
      },
    })
    const papers = [
      { attachmentId: AttachmentId('sha256:paper-a'), name: 'paper-a.txt', bytes: 12 },
      { attachmentId: AttachmentId('sha256:paper-b'), name: 'paper-b.txt', bytes: 13 },
    ] as const
    const result = await coordinator.advance({ state: createResearchState(), parent, papers })
    const artifact = result.artifact
    expect(artifact?.title).toBe('论文摘要（2 篇）')
    expect(artifact?.source).toContain('paper-a.txt')
    expect(artifact?.source).toContain('paper-b.txt')
    expect(prompts[0]).toContain('File: paper-a.txt')
    expect(prompts[0]).toContain('File: paper-b.txt')
  })

  it('asks the problem extractor to retain every distinct question', async () => {
    const prompts: string[] = []
    const base = adapters()
    const coordinator = new ResearchCoordinator({
      ...base,
      agents: {
        async run(role, prompt, owner, signal) {
          if (role === 'problem-extractor') prompts.push(prompt)
          return base.agents.run(role, prompt, owner, signal)
        },
      },
    })
    const paper = { attachmentId: AttachmentId('sha256:questions'), name: 'questions.txt', bytes: 48 } as const
    let state = (await coordinator.advance({ state: createResearchState(), parent, paper })).state
    state = confirm(state)
    await coordinator.advance({ state, parent })
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toContain('every distinct, testable research problem')
    expect(prompts[0]).toContain('Preserve separate answers for separate questions')
  })

  it('executes every confirmed stage and renders a final plan', async () => {
    const searchQueries: string[] = []
    const written: string[] = []
    const coordinator = new ResearchCoordinator(adapters(searchQueries, {
      async write(file) {
        written.push(file.content)
        return { fileName: 'workspace/research-plan.md', content: file.content }
      },
    }))
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
    state = (await coordinator.advance({ state, parent })).state
    expect(state.nodes[state.selectedNodeId]?.stage).toBe('idea-refinement')
    state = confirm(state)
    state = (await coordinator.advance({ state, parent })).state
    expect(state.nodes[state.selectedNodeId]?.stage).toBe('targeted-literature-search')
    state = confirm(state)
    state = (await coordinator.advance({ state, parent, reviewerRoles: ['method', 'novelty', 'reproducibility'] })).state
    expect(searchQueries).toHaveLength(2)
    expect(searchQueries[1]).toContain('Confirmed direction:')
    expect(searchQueries[1]).toContain('可校准的不确定性门控检索')
    state = confirm(state)
    state = (await coordinator.advance({ state, parent })).state
    expect(state.nodes[state.selectedNodeId]?.stage).toBe('simulation-or-final-plan')
    state = confirm(state)
    const preview = await coordinator.advance({ state, parent, finalChoice: 'plan' })
    expect(preview.planFile).toBeUndefined()
    expect(preview.artifact?.title).toBe('完整科研方案（待写入）')
    expect(preview.artifact?.content).toContain('# 自动科研方案')
    expect(preview.state.nodes[preview.state.selectedNodeId]?.status).toBe('awaiting-confirmation')
    expect(written).toHaveLength(0)
    const final = await coordinator.advance({ state: confirm(preview.state), parent })
    expect(final.planFile?.fileName).toBe('workspace/research-plan.md')
    expect(final.planFile?.content).toContain('# 自动科研方案')
    expect(written).toHaveLength(1)
    expect(written[0]).toBe(final.planFile?.content)
    expect(final.artifact?.source).toBe('workspace/research-plan.md')
    expect(final.state.nodes[final.state.selectedNodeId]?.stage).toBe('final-plan')
    expect(final.state.nodes[final.state.selectedNodeId]?.status).toBe('completed')
  })

  it('passes the resolved sandbox policy to the final plan writer', async () => {
    let received: SandboxExecutionPolicy | undefined
    const fs = Object.setPrototypeOf({
      async resolve(path: string) {
        return { targetKey: FsTargetKey(path), displayPath: path }
      },
      async writeText(
        _target: FsTarget,
        content: string,
        _expected?: FsWriteIntent,
        _signal?: AbortSignal,
        policy?: SandboxExecutionPolicy,
      ) {
        received = policy
        return { operation: 'create' as const, version: FsVersion('v1'), before: null, after: content }
      },
    }, FileSystem.prototype) as FileSystem
    const policy: SandboxExecutionPolicy = { mode: 'workspace-write', workspaceRoot: 'C:/research-workspace' }
    const coordinator = createHostResearchCoordinator({
      attachments: Object.setPrototypeOf({}, AttachmentStore.prototype) as AttachmentStore,
      web: Object.setPrototypeOf({}, WebRuntime.prototype) as WebRuntime,
      subagents: Object.setPrototypeOf({}, SubagentRuntime.prototype) as SubagentRuntime,
      fs,
    }, {
      subagentProvider: 'spawn', planPath: 'research-plan.md', maxPaperBytes: 1024,
      maxLiteratureResults: 4, maxPdfPages: 1, ocrScale: 1, maxOcrPixels: 100,
      sandboxPolicy: policy,
    })
    const state = appendResearchOutput(createResearchState(), {
      stage: 'final-plan', kind: 'plan', title: '完整科研方案', content: '# 方案', status: 'confirmed',
    })

    const result = await coordinator.advance({ state, parent })

    expect(received).toEqual(policy)
    expect(result.planFile?.content).toBe('# 方案')
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

  it('discards low-score or overlapping candidates before exposing a passing idea', async () => {
    let reviewCount = 0
    const base = adapters()
    const coordinator = new ResearchCoordinator({
      ...base,
      innovation: { scoreThreshold: 70, maxAttempts: 3 },
      agents: {
        async run(role, prompt, owner, signal) {
          if (role === 'innovation-reviewer') {
            reviewCount += 1
            return reviewCount === 1
              ? '{"score": 92, "overlap": true, "rationale": "与基线方法高度重合。"}'
              : '{"score": 84, "overlap": false, "rationale": "机制和验证标准均有清晰差异。"}'
          }
          return base.agents.run(role, prompt, owner, signal)
        },
      },
    })
    let state = createResearchState()
    state = appendResearchOutput(state, { stage: 'problem-summary', kind: 'problem', title: '问题', content: '缺口' })
    state = confirm(state)
    state = appendResearchOutput(state, { stage: 'literature-search', kind: 'literature', title: '文献', content: '证据' })
    state = confirm(state)
    const result = await coordinator.advance({ state, parent })
    expect(reviewCount).toBe(2)
    expect(result.artifact?.evaluation).toMatchObject({ score: 84, overlap: false, threshold: 70 })
  })

  it('reports the innovation threshold when every candidate is rejected', async () => {
    const base = adapters()
    const coordinator = new ResearchCoordinator({
      ...base,
      innovation: { scoreThreshold: 90, maxAttempts: 2 },
      agents: {
        async run(role, prompt, owner, signal) {
          if (role === 'innovation-reviewer') return '{"score": 40, "overlap": false, "rationale": "证据不足。"}'
          return base.agents.run(role, prompt, owner, signal)
        },
      },
    })
    let state = createResearchState()
    state = appendResearchOutput(state, { stage: 'problem-summary', kind: 'problem', title: '问题', content: '缺口' })
    state = confirm(state)
    state = appendResearchOutput(state, { stage: 'literature-search', kind: 'literature', title: '文献', content: '证据' })
    state = confirm(state)
    await expect(coordinator.advance({ state, parent })).rejects.toThrow('INNOVATION_SCORE_BELOW_THRESHOLD')
  })
})

describe('createWebLiteratureSearcher', () => {
  it('queries arXiv machine-learning categories and merges duplicate URLs', async () => {
    const fetchedUrls: string[] = []
    const xml = '<feed><entry><id>https://arxiv.org/abs/1234.5678</id><title> A ML paper </title><summary> A useful result </summary><published>2026-01-01T00:00:00Z</published></entry></feed>'
    const web = Object.setPrototypeOf({
      async search() { return { sources: [{ url: 'https://arxiv.org/abs/1234.5678', title: 'Duplicate' }], truncated: false } },
      async fetch(request: { readonly url: string }) {
        fetchedUrls.push(request.url)
        return { url: request.url, statusCode: 200, truncated: false, body: { kind: 'text' as const, content: xml } }
      },
    }, WebRuntime.prototype) as WebRuntime
    const searcher = createWebLiteratureSearcher(web, 4)
    const sources = await searcher.search('transformer', undefined, { sources: ['arxiv'] })
    expect(sources).toHaveLength(1)
    expect(sources[0]).toMatchObject({ provider: 'arxiv', title: 'A ML paper', url: 'https://arxiv.org/abs/1234.5678' })
    expect(fetchedUrls[0]).toContain('cat%3Acs.LG')
  })

  it('keeps primary web results when arXiv is blocked by the network policy', async () => {
    const web = Object.setPrototypeOf({
      async search() {
        return { sources: [{ url: 'https://example.test/paper', title: 'Web result', snippet: 'web detail' }], truncated: false }
      },
      async fetch(request: { readonly url: string }) {
        if (request.url.includes('arxiv.org/api')) throw new Error('URL resolves to a non-public IP')
        return { url: request.url, statusCode: 200, truncated: false, body: { kind: 'text' as const, content: 'web detail' } }
      },
    }, WebRuntime.prototype) as WebRuntime

    await expect(createWebLiteratureSearcher(web, 4).search('transformer', undefined, { sources: ['web', 'arxiv'] })).resolves.toEqual([
      { url: 'https://example.test/paper', provider: 'web', title: 'Web result', snippet: 'web detail' },
    ])
  })

  it('keeps arXiv results when the primary web search backend fails', async () => {
    const web = Object.setPrototypeOf({
      async search() { throw new Error('web search unavailable') },
      async fetch(request: { readonly url: string }) {
        return {
          url: request.url,
          statusCode: 200,
          truncated: false,
          body: { kind: 'text' as const, content: '<feed><entry><id>https://arxiv.org/abs/9876.5432</id><title>Fallback ML paper</title><summary>Evidence</summary></entry></feed>' },
        }
      },
    }, WebRuntime.prototype) as WebRuntime

    await expect(createWebLiteratureSearcher(web, 4).search('transformer', undefined, { sources: ['web', 'arxiv'] })).resolves.toEqual([
      { url: 'https://arxiv.org/abs/9876.5432', provider: 'arxiv', title: 'Fallback ML paper', snippet: 'Evidence' },
    ])
  })
})

describe('createAttachmentPaperReader', () => {
  it('extracts a PDF text layer with PDF.js', async () => {
    const bytes = testPdf('Selectable PDF text with enough words to avoid OCR fallback. This sentence keeps the embedded text layer above the OCR threshold.')
    const attachments = attachmentReader(bytes)
    const reader = createAttachmentPaperReader(attachments, bytes.byteLength)
    const document = await reader.read({ attachmentId: AttachmentId('sha256:pdf'), name: 'paper.pdf', bytes: bytes.byteLength })
    expect(document.extractionMethod).toBe('embedded-text')
    expect(document.pageCount).toBe(1)
    expect(document.text).toContain('Selectable PDF text')
  })

  it('renders a scanned PDF and delegates the pages to OCR', async () => {
    const bytes = testPdf()
    const pages: Uint8Array[] = []
    const attachments = attachmentReader(bytes)
    const reader = createAttachmentPaperReader(attachments, bytes.byteLength, {
      ocr: {
        async recognize(input) {
          pages.push(...input.pages.map(page => page.data))
          return 'Page 1\n扫描版论文内容'
        },
      },
    })
    const document = await reader.read(
      { attachmentId: AttachmentId('sha256:scan'), name: 'scan.pdf', bytes: bytes.byteLength },
      undefined,
      { parent },
    )
    expect(document.extractionMethod).toBe('ocr')
    expect(document.text).toContain('扫描版论文内容')
    expect(pages[0]?.byteLength).toBeGreaterThan(0)
  })

  it('OCRs sparse pages in a mixed PDF while retaining embedded page text order', async () => {
    const bytes = testPdfPages([
      'Selectable page with enough text to stay on the embedded text path.',
      '',
    ])
    const pages: number[] = []
    const reader = createAttachmentPaperReader(attachmentReader(bytes), bytes.byteLength, {
      ocr: {
        async recognize(input) {
          pages.push(...input.pages.map(page => page.pageNumber))
          return 'Page 2\nOCR recovered page content'
        },
      },
    })
    const document = await reader.read(
      { attachmentId: AttachmentId('sha256:mixed'), name: 'mixed.pdf', bytes: bytes.byteLength },
      undefined,
      { parent },
    )
    expect(document.extractionMethod).toBe('ocr')
    expect(pages).toEqual([2])
    expect(document.text.indexOf('Selectable page')).toBeLessThan(document.text.indexOf('OCR recovered page'))
  })

  it('reports a clear error when a scanned PDF has no OCR adapter', async () => {
    const bytes = testPdf()
    const reader = createAttachmentPaperReader(attachmentReader(bytes), bytes.byteLength)
    await expect(reader.read({ attachmentId: AttachmentId('sha256:no-ocr'), name: 'scan.pdf', bytes: bytes.byteLength }, undefined, { parent }))
      .rejects.toThrow('PDF_OCR_UNAVAILABLE')
  })
})

function attachmentReader(bytes: Uint8Array): AttachmentStore {
  return Object.setPrototypeOf({
    async *readFileStream() { yield bytes },
  }, AttachmentStore.prototype) as AttachmentStore
}

function testPdf(text = ''): Uint8Array {
  return testPdfPages([text])
}

function testPdfPages(texts: readonly string[]): Uint8Array {
  const pageObjects: string[] = []
  const contentObjects: string[] = []
  const pageRefs: string[] = []
  const firstPageObject = 3
  const firstContentObject = firstPageObject + texts.length
  texts.forEach((text, index) => {
    pageRefs.push(`${firstPageObject + index} 0 R`)
    const stream = text.length === 0 ? '0 0 0 rg 10 10 100 80 re f' : `BT /F1 8 Tf 10 50 Td (${text}) Tj ET`
    pageObjects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 120 100] /Resources << /Font << /F1 ${firstContentObject + texts.length} 0 R >> >> /Contents ${firstContentObject + index} 0 R >>`)
    contentObjects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  })
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${texts.length} >>`,
    ...pageObjects,
    ...contentObjects,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.7\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}
