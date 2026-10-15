/** Host-side execution coordinator for the human-confirmed research DAG. */

import type { Agent } from '@deepseek-ai/dsh-agent'
import { fileURLToPath } from 'node:url'
import type {
  AttachmentStore,
  FileAttachmentRef,
} from '@deepseek-ai/dsh-attachment'
import { createCanvas } from '@napi-rs/canvas'
import { getDocument, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type {
  ContentBlock,
} from '@deepseek-ai/dsh-llm'
import type {
  SubagentRuntime,
} from '@deepseek-ai/dsh-subagent'
import type {
  WebRuntime,
  WebSearchSource,
} from '@deepseek-ai/dsh-web'
import type { FileSystem } from '@deepseek-ai/dsh-fs'
import {
  appendResearchOutput,
  assertInnovationClaim,
  completeResearchNode,
  selectedResearchNode,
  setResearchReviewerRoles,
  type ResearchArtifact,
  type ResearchOutputInput,
  type ResearchStage,
  type ResearchState,
} from './research.ts'

/** A bounded, decoded representation of an uploaded paper. */
export interface ResearchPaperDocument {
  /** Sanitized display name from the durable file reference. */
  readonly fileName: string
  /** Extracted text passed to summarizer agents. */
  readonly text: string
  /** Number of bytes read from the attachment. */
  readonly byteLength: number
  /** Extraction path used for this document. */
  readonly extractionMethod: ResearchPaperExtractionMethod
  /** Number of PDF pages inspected, when the upload was a PDF. */
  readonly pageCount?: number
}

/** Extraction path reported to the user and research-session log. */
export type ResearchPaperExtractionMethod = 'plain-text' | 'embedded-text' | 'ocr'

/** One rendered page supplied to an OCR adapter. */
export interface ResearchPaperOcrPage {
  /** One-based page number in the source PDF. */
  readonly pageNumber: number
  /** PNG bytes for the rendered page. */
  readonly data: Uint8Array
}

/** OCR request for a bounded set of PDF pages. */
export interface ResearchPaperOcrInput {
  /** Original uploaded filename. */
  readonly fileName: string
  /** Rendered pages in source order. */
  readonly pages: readonly ResearchPaperOcrPage[]
}

/** OCR capability used when a PDF has no usable text layer. */
export interface ResearchPaperOcr {
  /**
   * Recognize all supplied pages.
   * @param input - Bounded rendered pages and source filename.
   * @param parent - Agent that owns the visual child-agent runs.
   * @param signal - Optional cancellation signal.
   * @returns OCR text with page markers.
   */
  recognize(input: ResearchPaperOcrInput, parent: Agent, signal?: AbortSignal): Promise<string>
}

/** Reads one durable paper attachment into bounded text. */
export interface ResearchPaperReader {
  /**
   * Read and extract a paper.
   * @param paper - Durable uploaded file reference.
   * @param signal - Optional cancellation signal.
   * @param context - Parent agent used by the OCR adapter when needed.
   * @returns Extracted paper text.
   */
  read(paper: FileAttachmentRef, signal?: AbortSignal, context?: ResearchPaperReadContext): Promise<ResearchPaperDocument>
}

/** Optional execution context for a paper read. */
export interface ResearchPaperReadContext {
  /** Parent Agent for visual OCR delegation. */
  readonly parent?: Agent
}

/** Host limits and OCR adapter for PDF extraction. */
export interface ResearchPaperReaderOptions {
  /** Maximum number of PDF pages inspected and rendered. */
  readonly maxPdfPages?: number
  /** Initial PDF rendering scale before pixel capping. */
  readonly ocrScale?: number
  /** Maximum width × height for each rendered OCR page. */
  readonly maxOcrPixels?: number
  /** Optional visual OCR implementation. */
  readonly ocr?: ResearchPaperOcr
}

/** One normalized source returned by a literature provider. */
export interface ResearchLiteratureSource {
  /** Citeable URL. */
  readonly url: string
  /** Provider title when available. */
  readonly title?: string
  /** Provider snippet when available. */
  readonly snippet?: string
  /** Provider publication date when available. */
  readonly publishedAt?: string
}

/** Searches external literature sources. */
export interface ResearchLiteratureSearcher {
  /**
   * Search for papers related to a problem statement.
   * @param query - Problem-derived search query.
   * @param signal - Optional cancellation signal.
   * @returns Normalized citeable sources.
   */
  search(query: string, signal?: AbortSignal): Promise<readonly ResearchLiteratureSource[]>
}

/** Roles used by the coordinator when delegating model work. */
export type ResearchAgentRole =
  | 'paper-summarizer'
  | 'problem-extractor'
  | 'idea-generator'
  | 'idea-refiner'
  | 'method-reviewer'
  | 'novelty-reviewer'
  | 'reproducibility-reviewer'

/** Runs one isolated model agent and returns its visible text. */
export interface ResearchAgentRunner {
  /**
   * Run one role with the branch memory supplied in the prompt.
   * @param role - Fixed role label used for tracing and provider policy.
   * @param prompt - Model-visible task prompt.
   * @param parent - Live parent Agent that owns the delegated child.
   * @param signal - Optional cancellation signal.
   * @returns Visible assistant text.
   */
  run(role: ResearchAgentRole, prompt: string, parent: Agent, signal?: AbortSignal): Promise<string>
}

/** Optional simple simulation capability selected by the user. */
export interface ResearchSimulationRunner {
  /**
   * Run a bounded simulation for a confirmed idea and review.
   * @param input - Immutable branch artifacts used by the simulation.
   * @param signal - Optional cancellation signal.
   * @returns Human-readable simulation evidence.
   */
  run(input: ResearchSimulationInput, signal?: AbortSignal): Promise<string>
}

/** Inputs supplied to a simple simulation runner. */
export interface ResearchSimulationInput {
  /** Confirmed idea artifact. */
  readonly idea: ResearchArtifact
  /** Optional review artifact. */
  readonly review?: ResearchArtifact
}

/** Final plan file produced by a writer adapter. */
export interface ResearchPlanFile {
  /** Safe display filename chosen by the writer. */
  readonly fileName: string
  /** UTF-8 Markdown file content. */
  readonly content: string
}

/** Optional durable writer for the final Markdown research plan. */
export interface ResearchPlanWriter {
  /**
   * Persist the final plan.
   * @param file - Rendered plan file.
   * @returns The persisted file descriptor.
   */
  write(file: ResearchPlanFile): Promise<ResearchPlanFile>
}

/** Capabilities required by the coordinator. */
export interface ResearchCoordinatorAdapters {
  readonly papers: ResearchPaperReader
  readonly literature: ResearchLiteratureSearcher
  readonly agents: ResearchAgentRunner
  readonly simulation?: ResearchSimulationRunner
  readonly planWriter?: ResearchPlanWriter
}

/** Request for one user-confirmed coordinator step. */
export interface ResearchAdvanceRequest {
  /** Current immutable DAG snapshot. */
  readonly state: ResearchState
  /** Parent Agent that owns child-agent runs. */
  readonly parent: Agent
  /** Required for the paper-upload root step. */
  readonly paper?: FileAttachmentRef
  /** Review roles selected by the user before the review step. */
  readonly reviewerRoles?: readonly string[]
  /** Required when the simulation-or-plan choice node is reached. */
  readonly finalChoice?: 'simulation' | 'plan'
  /** Optional cancellation signal. */
  readonly signal?: AbortSignal
}

/** Result of one completed coordinator step. */
export interface ResearchAdvanceResult {
  /** Updated immutable DAG state. */
  readonly state: ResearchState
  /** Newly visible output, when this step appended one. */
  readonly artifact?: ResearchArtifact
  /** Persisted final plan, when a writer was configured. */
  readonly planFile?: ResearchPlanFile
}

/**
 * Host coordinator that turns confirmed nodes into real paper, search, agent,
 * review, simulation, and plan operations. It never mutates a previous state.
 */
export class ResearchCoordinator {
  /**
   * @param adapters - Host capabilities used by each workflow stage.
   */
  constructor(private readonly adapters: ResearchCoordinatorAdapters) {}

  /**
   * Execute exactly one next stage. A node awaiting confirmation is rejected,
   * so callers must show its artifact and record the user's decision first.
   * @param request - Current branch, parent Agent, and stage options.
   * @returns The new state and the output visible to the user.
   */
  async advance(request: ResearchAdvanceRequest): Promise<ResearchAdvanceResult> {
    const signal = request.signal
    signal?.throwIfAborted()
    const state = request.state
    const node = selectedResearchNode(state)
    if (node.status === 'awaiting-confirmation') {
      throw new Error(`research stage "${node.stage}" requires user confirmation before it can continue`)
    }
    if (node.status === 'rejected') throw new Error('rejected research nodes cannot continue')

    switch (node.stage) {
      case 'paper-upload':
        return this.readAndSummarize(request)
      case 'paper-read':
        this.requireConfirmed(node.stage, node.status)
        return this.extractProblem(request)
      case 'problem-summary':
        this.requireConfirmed(node.stage, node.status)
        return this.searchLiterature(request)
      case 'literature-search':
        this.requireConfirmed(node.stage, node.status)
        return this.generateIdea(request)
      case 'idea-generation':
        this.requireConfirmed(node.stage, node.status)
        return node.artifactRefs.length === 0 ? this.generateIdea(request) : this.refineIdea(request)
      case 'idea-refinement':
        this.requireConfirmed(node.stage, node.status)
        return node.userDecision === 'feedback' ? this.refineIdea(request) : this.searchTargetedLiterature(request)
      case 'targeted-literature-search':
        this.requireConfirmed(node.stage, node.status)
        return this.reviewIdea(request)
      case 'multi-agent-review':
        this.requireConfirmed(node.stage, node.status)
        return this.createFinalChoice(request)
      case 'simulation-or-final-plan':
        this.requireConfirmed(node.stage, node.status)
        return this.chooseSimulationOrPlan(request)
      case 'final-plan':
        return { state: completeResearchNode(state) }
      default:
        return unreachableStage(node.stage)
    }
  }

  private async readAndSummarize(request: ResearchAdvanceRequest): Promise<ResearchAdvanceResult> {
    if (request.paper === undefined) throw new Error('paper attachment is required before paper reading')
    const paper = await this.adapters.papers.read(request.paper, request.signal, { parent: request.parent })
    const summary = await this.adapters.agents.run(
      'paper-summarizer',
      `Read the uploaded research paper below. Return a faithful structured summary with the question, method, data, results, limitations, and evidence. Do not invent facts. The extraction method was ${paper.extractionMethod}; the inspected page count was ${paper.pageCount ?? 'not applicable'}. If OCR was used, mark uncertain characters and avoid silently completing unreadable text.\n\nFile: ${paper.fileName}\n\n${paper.text}`,
      request.parent,
      request.signal,
    )
    const state = appendResearchOutput(request.state, {
      stage: 'paper-read',
      kind: 'summary',
      title: `论文摘要：${paper.fileName}`,
      content: `论文读取方式：${paper.extractionMethod}；检查页数：${paper.pageCount ?? '不适用'}。\n\n${summary}`,
      source: paper.fileName,
    }, Date.now())
    return this.withLatestArtifact(state)
  }

  private async extractProblem(request: ResearchAdvanceRequest): Promise<ResearchAdvanceResult> {
    const summary = this.latestArtifact(request.state, 'summary')
    const problem = await this.adapters.agents.run(
      'problem-extractor',
      `Extract the most important testable research problem and gap from this paper summary. State assumptions, measurable failure modes, constraints, and what evidence would falsify the claim.\n\n${summary.content}`,
      request.parent,
      request.signal,
    )
    const state = appendResearchOutput(request.state, {
      stage: 'problem-summary', kind: 'problem', title: '待确认的研究问题', content: problem,
    }, Date.now())
    return this.withLatestArtifact(state)
  }

  private async searchLiterature(request: ResearchAdvanceRequest): Promise<ResearchAdvanceResult> {
    const problem = this.latestArtifact(request.state, 'problem')
    const sources = await this.adapters.literature.search(problem.content, request.signal)
    const content = sources.length === 0
      ? '未找到可引用的相关论文；请修改问题描述或检索条件后重试。'
      : sources.map((source, index) => {
        const title = source.title ?? source.url
        const detail = source.snippet === undefined ? '' : `\n${source.snippet}`
        return `${index + 1}. [${title}](${source.url})${detail}`
      }).join('\n\n')
    const state = appendResearchOutput(request.state, {
      stage: 'literature-search', kind: 'literature', title: '相关论文与证据', content,
    }, Date.now())
    return this.withLatestArtifact(state)
  }

  private async generateIdea(request: ResearchAdvanceRequest): Promise<ResearchAdvanceResult> {
    const problem = this.latestArtifact(request.state, 'problem')
    const literature = this.latestArtifact(request.state, 'literature')
    const idea = await this.adapters.agents.run(
      'idea-generator',
      `Propose one falsifiable improvement grounded in the research problem and cited literature. Explicitly label the innovation, explain why it differs from prior work, give an implementable method, baselines, ablations, metrics, and risks.\n\nProblem:\n${problem.content}\n\nLiterature:\n${literature.content}`,
      request.parent,
      request.signal,
    )
    const artifact: ResearchOutputInput = {
      stage: 'idea-generation', kind: 'idea', title: '候选改进想法', content: idea,
    }
    const state = appendResearchOutput(request.state, artifact, Date.now())
    const latest = this.latestArtifact(state, 'idea')
    assertInnovationClaim(latest)
    return { state, artifact: latest }
  }

  private async refineIdea(request: ResearchAdvanceRequest): Promise<ResearchAdvanceResult> {
    const idea = this.latestArtifact(request.state, 'idea')
    const feedback = selectedResearchNode(request.state).memorySnapshot.feedback.join('\n') || '没有额外反馈；补齐可复现细节。'
    const refined = await this.adapters.agents.run(
      'idea-refiner',
      `Revise the proposed research idea using the user's feedback. Preserve supported claims, make the innovation explicit, and add concrete implementation, evaluation, ablation, and failure criteria.\n\nOriginal idea:\n${idea.content}\n\nUser feedback:\n${feedback}`,
      request.parent,
      request.signal,
    )
    const state = appendResearchOutput(request.state, {
      stage: 'idea-refinement', kind: 'idea', title: '根据反馈完善后的想法', content: refined,
    }, Date.now())
    const latest = this.latestArtifact(state, 'idea')
    assertInnovationClaim(latest)
    return { state, artifact: latest }
  }

  private async reviewIdea(request: ResearchAdvanceRequest): Promise<ResearchAdvanceResult> {
    let state = request.state
    if (request.reviewerRoles !== undefined) state = setResearchReviewerRoles(state, request.reviewerRoles)
    const idea = this.latestArtifact(state, 'idea')
    const roles = selectedResearchNode(state).memorySnapshot.reviewerRoles
    const selectedRoles = roles.length > 0 ? roles : ['method', 'novelty', 'reproducibility']
    const roleMap: Record<string, ResearchAgentRole> = {
      method: 'method-reviewer', novelty: 'novelty-reviewer', reproducibility: 'reproducibility-reviewer',
      '方法审查': 'method-reviewer', '创新性审查': 'novelty-reviewer', '可复现性审查': 'reproducibility-reviewer',
    }
    const reviews = await Promise.all(selectedRoles.map(async (label) => {
      const role = roleMap[label] ?? 'method-reviewer'
      const review = await this.adapters.agents.run(
        role,
        `Review this research idea as the ${label} reviewer. Identify one concrete strength, one blocking issue, and an exact revision or test. Check the explicit innovation claim.\n\n${idea.content}`,
        request.parent,
        request.signal,
      )
      return `### ${label}\n${review}`
    }))
    const stateWithReview = appendResearchOutput(state, {
      stage: 'multi-agent-review', kind: 'review', title: '多智能体协同审查', content: reviews.join('\n\n'),
    }, Date.now())
    return this.withLatestArtifact(stateWithReview)
  }

  private async searchTargetedLiterature(request: ResearchAdvanceRequest): Promise<ResearchAdvanceResult> {
    const problem = this.latestArtifact(request.state, 'problem')
    const idea = this.latestArtifact(request.state, 'idea')
    const sources = await this.adapters.literature.search(
      `Find recent and directly comparable research for this confirmed direction. Prioritize methods, baselines, and evidence that can challenge the proposed innovation.\n\nResearch problem:\n${problem.content}\n\nConfirmed direction:\n${idea.content}`,
      request.signal,
    )
    const content = sources.length === 0
      ? '确认研究方向后的针对性检索没有找到可引用的相关论文；请回到改进想法阶段调整方向。'
      : sources.map((source, index) => {
        const title = source.title ?? source.url
        const detail = source.snippet === undefined ? '' : `\n${source.snippet}`
        return `${index + 1}. [${title}](${source.url})${detail}`
      }).join('\n\n')
    const state = appendResearchOutput(request.state, {
      stage: 'targeted-literature-search', kind: 'literature', title: '确认方向后的针对性文献调研', content,
    }, Date.now())
    return this.withLatestArtifact(state)
  }

  private async chooseSimulationOrPlan(request: ResearchAdvanceRequest): Promise<ResearchAdvanceResult> {
    const current = this.latestArtifact(request.state, 'decision')
    if (current.title !== '仿真或直接输出选择') throw new Error('simulation-or-plan stage is missing its user choice checkpoint')
    if (request.finalChoice === undefined) throw new Error('finalChoice must be selected before the simulation-or-plan stage')
    const latestNodeArtifactId = selectedResearchNode(request.state).artifactRefs.at(-1)
    const latestNodeArtifact = latestNodeArtifactId === undefined ? undefined : request.state.artifacts[latestNodeArtifactId]
    if (latestNodeArtifact?.kind === 'simulation') {
      if (request.finalChoice !== 'plan') throw new Error('a completed simulation must be confirmed before generating the final plan')
      return this.finishPlan(request)
    }
    if (request.finalChoice === 'plan') return this.finishPlan(request)
    if (this.adapters.simulation === undefined) throw new Error('simulation was selected but no simulation adapter is configured')
    const idea = this.latestArtifact(request.state, 'idea')
    const review = this.latestArtifact(request.state, 'review')
    const simulation = await this.adapters.simulation.run({ idea, review }, request.signal)
    const state = appendResearchOutput(request.state, {
      stage: 'simulation-or-final-plan', kind: 'simulation', title: '简单仿真结果', content: simulation,
    }, Date.now())
    return this.withLatestArtifact(state)
  }

  private createFinalChoice(request: ResearchAdvanceRequest): ResearchAdvanceResult {
    const state = appendResearchOutput(request.state, {
      stage: 'simulation-or-final-plan', kind: 'decision', title: '仿真或直接输出选择',
      content: '请确认是否运行简单仿真；确认后可选择运行仿真或直接生成完整科研方案。',
    }, Date.now())
    return this.withLatestArtifact(state)
  }

  private async finishPlan(request: ResearchAdvanceRequest): Promise<ResearchAdvanceResult> {
    const node = selectedResearchNode(request.state)
    const artifacts = node.memorySnapshot.artifactIds
      .map(artifactId => request.state.artifacts[artifactId])
      .filter((artifact): artifact is ResearchArtifact => artifact !== undefined)
    const content = renderResearchPlan(artifacts)
    const file = { fileName: 'research-plan.md', content }
    const planFile = this.adapters.planWriter === undefined ? file : await this.adapters.planWriter.write(file)
    const state = appendResearchOutput(request.state, {
      stage: 'final-plan', kind: 'plan', title: '完整科研方案', content: planFile.content, source: planFile.fileName,
    }, Date.now())
    return { ...(this.withLatestArtifact(state)), planFile }
  }

  private latestArtifact(state: ResearchState, kind: ResearchArtifact['kind']): ResearchArtifact {
    const node = selectedResearchNode(state)
    for (const artifactId of [...node.memorySnapshot.artifactIds].reverse()) {
      const artifact = state.artifacts[artifactId]
      if (artifact?.kind === kind) return artifact
    }
    throw new Error(`research artifact of kind "${kind}" is missing from the selected branch`)
  }

  private withLatestArtifact(state: ResearchState): ResearchAdvanceResult {
    const node = selectedResearchNode(state)
    const artifactId = node.artifactRefs[node.artifactRefs.length - 1]
    const artifact = artifactId === undefined ? undefined : state.artifacts[artifactId]
    return artifact === undefined ? { state } : { state, artifact }
  }

  private requireConfirmed(stage: ResearchStage, status: ResearchState['nodes'][string]['status']): void {
    if (status !== 'confirmed' && status !== 'active') throw new Error(`research stage "${stage}" is not confirmed`)
  }
}

/**
 * Build a Host paper reader backed by the durable attachment service.
 * @param attachments - Durable attachment provider that owns the uploaded bytes.
 * @param maxBytes - Explicit extraction limit for one paper.
 * @param options - PDF page, raster, and OCR limits.
 * @returns A bounded paper reader adapter.
 */
export function createAttachmentPaperReader(
  attachments: AttachmentStore,
  maxBytes: number,
  options: ResearchPaperReaderOptions = {},
): ResearchPaperReader {
  const resolved = resolvePaperReaderOptions(options)
  return {
    async read(paper, signal, context) {
      const chunks: Uint8Array[] = []
      let byteLength = 0
      for await (const chunk of attachments.readFileStream(paper, signal)) {
        byteLength += chunk.byteLength
        if (byteLength > maxBytes) throw new Error(`paper exceeds the ${maxBytes} byte extraction limit`)
        chunks.push(chunk)
      }
      const bytes = new Uint8Array(byteLength)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      signal?.throwIfAborted()
      if (!isPdfUpload(bytes, paper.name)) {
        const text = new TextDecoder().decode(bytes)
        if (text.trim().length === 0) throw new Error(`paper "${paper.name}" produced no readable text`)
        return { fileName: paper.name, text, byteLength, extractionMethod: 'plain-text' }
      }

      const pdf = await openPdf(bytes, paper.name, resolved, signal)
      if (pdf.text.trim().length > 0) {
        return {
          fileName: paper.name,
          text: pdf.text,
          byteLength,
          extractionMethod: 'embedded-text',
          pageCount: pdf.pageCount,
        }
      }
      if (resolved.ocr === undefined) {
        throw new Error('PDF_OCR_UNAVAILABLE: this PDF has no usable text layer and no OCR adapter is configured')
      }
      if (context?.parent === undefined) {
        throw new Error('PDF_OCR_PARENT_REQUIRED: OCR requires the parent Agent used for visual delegation')
      }
      const text = await resolved.ocr.recognize(
        { fileName: paper.name, pages: pdf.pages },
        context.parent,
        signal,
      )
      if (text.trim().length === 0) throw new Error(`PDF_OCR_EMPTY: OCR produced no readable text for "${paper.name}"`)
      return {
        fileName: paper.name,
        text,
        byteLength,
        extractionMethod: 'ocr',
        pageCount: pdf.pageCount,
      }
    },
  }
}

/**
 * Build a literature search adapter backed by the configured web provider.
 * @param web - Configured Web runtime.
 * @param maxResults - Explicit source limit for one search.
 * @returns A literature search adapter that fetches missing snippets.
 */
export function createWebLiteratureSearcher(web: WebRuntime, maxResults: number): ResearchLiteratureSearcher {
  return {
    async search(query, signal) {
      const result = await web.search({ query, maxResults }, signal)
      const sources = result.sources.map((source: WebSearchSource) => ({
        url: source.url,
        ...source.title === undefined ? {} : { title: source.title },
        ...source.snippet === undefined ? {} : { snippet: source.snippet },
        ...source.publishedAt === undefined ? {} : { publishedAt: source.publishedAt },
      }))
      return Promise.all(sources.map(async (source) => {
        signal?.throwIfAborted()
        if (source.snippet !== undefined) return source
        try {
          const fetched = await web.fetch({ url: source.url }, signal)
          const snippet = fetched.body.content.slice(0, 1200)
          return snippet.length === 0 ? source : { ...source, snippet }
        } catch {
          signal?.throwIfAborted()
          return source
        }
      }))
    },
  }
}

/**
 * Build an agent adapter backed by the named subagent provider.
 * @param subagents - Subagent runtime that owns child lifecycle.
 * @param provider - Registered provider name.
 * @returns A role-aware research agent runner.
 */
export function createSubagentResearchRunner(subagents: SubagentRuntime, provider: string): ResearchAgentRunner {
  return {
    async run(role, prompt, parent, signal) {
      const run = await subagents.start(provider, {
        parent,
        label: `research:${role}`,
        prompt: [{ type: 'text', text: prompt }],
        signal: signal ?? new AbortController().signal,
      })
      try {
        const result = await run.result
        if (result.stopReason !== 'completed') {
          throw new Error(`research agent ${role} stopped with ${result.stopReason}`)
        }
        const text = result.output.filter((block: ContentBlock) => block.type === 'text').map(block => block.text).join('\n')
        if (text.trim().length === 0) throw new Error(`research agent ${role} returned no visible text`)
        return text
      } finally {
        await run.dispose()
      }
    },
  }
}

/**
 * Build a page-by-page visual OCR adapter backed by the named subagent provider.
 * @param attachments - Durable image store used to make rendered pages model-visible.
 * @param subagents - Subagent runtime that owns visual child lifecycle.
 * @param provider - Registered provider name.
 * @returns OCR adapter that preserves page order and visible uncertainty.
 */
export function createSubagentResearchOcr(
  attachments: AttachmentStore,
  subagents: SubagentRuntime,
  provider: string,
): ResearchPaperOcr {
  return {
    async recognize(input, parent, signal) {
      const pages: string[] = []
      for (const page of input.pages) {
        signal?.throwIfAborted()
        let run: Awaited<ReturnType<SubagentRuntime['start']>> | undefined
        try {
          const image = await attachments.saveImage({
            data: page.data,
            mediaType: 'image/png',
            name: `${input.fileName}.page-${page.pageNumber}.png`,
          })
          run = await subagents.start(provider, {
            parent,
            label: 'research:paper-ocr',
            prompt: [
              {
                type: 'text',
                text: `Perform faithful OCR for page ${page.pageNumber} of ${input.fileName}. Transcribe every readable word, equation, table label, and footnote in reading order. Preserve line breaks where they carry meaning. Mark uncertain characters as [?] and never summarize or invent missing text. Return only the transcription.`,
              },
              { type: 'image', attachment: image },
            ],
            signal: signal ?? new AbortController().signal,
          })
          const result = await run.result
          if (result.stopReason !== 'completed') {
            throw new Error(`OCR agent stopped with ${result.stopReason}`)
          }
          const text = result.output
            .filter((block: ContentBlock): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
            .map(block => block.text)
            .join('\n')
            .trim()
          if (text.length === 0) throw new Error('OCR agent returned no visible text')
          pages.push(`Page ${page.pageNumber}\n${text}`)
        } catch (error) {
          signal?.throwIfAborted()
          const detail = error instanceof Error ? error.message : String(error)
          throw new Error(`PDF_OCR_FAILED: page ${page.pageNumber}: ${detail}`, { cause: error })
        } finally {
          if (run !== undefined) await run.dispose()
        }
      }
      const text = pages.join('\n\n')
      if (text.trim().length === 0) throw new Error('PDF_OCR_EMPTY: OCR produced no readable text')
      return text
    },
  }
}

/** Options used when assembling all configured Host capabilities. */
export interface HostResearchCoordinatorOptions {
  /** Named subagent provider used for every research role. */
  readonly subagentProvider: string
  /** Explicit path in the caller's Session filesystem for the Markdown plan. */
  readonly planPath: string
  /** Maximum paper bytes admitted to extraction. */
  readonly maxPaperBytes: number
  /** Maximum literature sources returned from the configured provider. */
  readonly maxLiteratureResults: number
  /** Maximum PDF pages inspected and rendered for OCR. */
  readonly maxPdfPages: number
  /** Initial PDF rendering scale before pixel capping. */
  readonly ocrScale: number
  /** Maximum pixels in one rendered OCR page. */
  readonly maxOcrPixels: number
}

/** Host capabilities needed to assemble a coordinator from the DSH services. */
export interface HostResearchCoordinatorServices {
  readonly attachments: AttachmentStore
  readonly web: WebRuntime
  readonly subagents: SubagentRuntime
  readonly fs: FileSystem
}

/**
 * Assemble the real attachment, web, subagent, and Session-filesystem adapters.
 * The parent Agent remains an explicit per-run input to {@link ResearchCoordinator.advance}.
 * @param services - DSH Host services selected by the active profile.
 * @param options - Explicit provider route, plan path, and result bounds.
 * @returns A coordinator with durable paper reads, network search, delegated agents, and file output.
 */
export function createHostResearchCoordinator(
  services: HostResearchCoordinatorServices,
  options: HostResearchCoordinatorOptions,
): ResearchCoordinator {
  const planWriter: ResearchPlanWriter = {
    async write(file) {
      const target = await services.fs.resolve(options.planPath)
      await services.fs.writeText(target, file.content)
      return { fileName: target.displayPath, content: file.content }
    },
  }
  return new ResearchCoordinator({
    papers: createAttachmentPaperReader(services.attachments, options.maxPaperBytes, {
      maxPdfPages: options.maxPdfPages,
      ocrScale: options.ocrScale,
      maxOcrPixels: options.maxOcrPixels,
      ocr: createSubagentResearchOcr(services.attachments, services.subagents, options.subagentProvider),
    }),
    literature: createWebLiteratureSearcher(services.web, options.maxLiteratureResults),
    agents: createSubagentResearchRunner(services.subagents, options.subagentProvider),
    planWriter,
  })
}

/**
 * Render all confirmed branch evidence as the final Markdown plan.
 * @param artifacts - Artifacts visible in one selected branch.
 * @returns UTF-8 Markdown content for the final plan file.
 */
export function renderResearchPlan(artifacts: readonly ResearchArtifact[]): string {
  const section = (kind: ResearchArtifact['kind'], heading: string): string => {
    const artifact = [...artifacts].reverse().find(item => item.kind === kind)
    return artifact === undefined ? `## ${heading}\n\n待补充。` : `## ${heading}\n\n${artifact.content}`
  }
  const literature = artifacts.filter(item => item.kind === 'literature')
  const literatureSection = literature.length === 0
    ? '## 相关工作与证据\n\n待补充。'
    : `## 相关工作与证据\n\n${literature.map(item => `### ${item.title}\n\n${item.content}`).join('\n\n')}`
  return [
    '# 自动科研方案',
    section('summary', '论文摘要'),
    section('problem', '研究问题与缺口'),
    literatureSection,
    section('idea', '改进方法与创新点'),
    section('review', '多智能体审查与修订'),
    section('simulation', '简单仿真证据'),
    '## 实验设计\n\n请依据审查意见补齐数据、基线、指标、消融、风险和复现步骤。',
  ].join('\n\n') + '\n'
}

interface PdfExtraction {
  readonly text: string
  readonly pageCount: number
  readonly pages: readonly ResearchPaperOcrPage[]
}

interface ResolvedPaperReaderOptions {
  readonly maxPdfPages: number
  readonly ocrScale: number
  readonly maxOcrPixels: number
  readonly ocr?: ResearchPaperOcr
}

const DEFAULT_PDF_PAGES = 12
const DEFAULT_OCR_SCALE = 1.5
const DEFAULT_MAX_OCR_PIXELS = 4_000_000
const MIN_EMBEDDED_TEXT = 24

function resolvePaperReaderOptions(options: ResearchPaperReaderOptions): ResolvedPaperReaderOptions {
  const maxPdfPages = options.maxPdfPages ?? DEFAULT_PDF_PAGES
  const ocrScale = options.ocrScale ?? DEFAULT_OCR_SCALE
  const maxOcrPixels = options.maxOcrPixels ?? DEFAULT_MAX_OCR_PIXELS
  if (!Number.isSafeInteger(maxPdfPages) || maxPdfPages < 1) throw new Error('maxPdfPages must be a positive integer')
  if (!Number.isFinite(ocrScale) || ocrScale <= 0) throw new Error('ocrScale must be a positive number')
  if (!Number.isSafeInteger(maxOcrPixels) || maxOcrPixels < 1) throw new Error('maxOcrPixels must be a positive integer')
  return { maxPdfPages, ocrScale, maxOcrPixels, ...(options.ocr === undefined ? {} : { ocr: options.ocr }) }
}

function isPdfUpload(bytes: Uint8Array, fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.pdf')
    || bytes.length >= 5 && new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-'
}

async function openPdf(
  bytes: Uint8Array,
  fileName: string,
  options: ResolvedPaperReaderOptions,
  signal?: AbortSignal,
): Promise<PdfExtraction> {
  signal?.throwIfAborted()
  let document: PDFDocumentProxy | undefined
  let loadingTask: ReturnType<typeof getDocument> | undefined
  try {
    loadingTask = getDocument({
      data: bytes,
      useWorkerFetch: false,
      stopAtErrors: false,
      disableFontFace: true,
      standardFontDataUrl: `${fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url))}/`,
    })
    document = await loadingTask.promise
    const pageCount = document.numPages
    const pagesToRead = Math.min(pageCount, options.maxPdfPages)
    const textPages: string[] = []
    for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
      signal?.throwIfAborted()
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const pageText = content.items
        .map(item => 'str' in item ? item.str : '')
        .filter(text => text.trim().length > 0)
        .join(' ')
      if (pageText.trim().length > 0) textPages.push(`Page ${pageNumber}\n${pageText}`)
    }
    const text = textPages.join('\n\n').trim()
    if (text.length >= MIN_EMBEDDED_TEXT) return { text, pageCount, pages: [] }

    const pages: ResearchPaperOcrPage[] = []
    for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
      signal?.throwIfAborted()
      const page = await document.getPage(pageNumber)
      const initialViewport = page.getViewport({ scale: options.ocrScale })
      const requestedPixels = initialViewport.width * initialViewport.height
      const capScale = requestedPixels > options.maxOcrPixels
        ? Math.sqrt(options.maxOcrPixels / requestedPixels)
        : 1
      const viewport = capScale === 1
        ? initialViewport
        : page.getViewport({ scale: options.ocrScale * capScale })
      const width = Math.max(1, Math.ceil(viewport.width))
      const height = Math.max(1, Math.ceil(viewport.height))
      const canvas = createCanvas(width, height)
      const context = canvas.getContext('2d')
      await page.render({ canvas: null, canvasContext: context as never, viewport }).promise
      pages.push({ pageNumber, data: canvas.toBuffer('image/png') })
    }
    return { text: '', pageCount, pages }
  } catch (error) {
    signal?.throwIfAborted()
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`PDF_TEXT_EXTRACTION_FAILED: ${fileName}: ${detail}`, { cause: error })
  } finally {
    if (loadingTask !== undefined) await loadingTask.destroy()
  }
}

function unreachableStage(stage: never): never {
  throw new Error(`unsupported research stage ${String(stage)}`)
}
