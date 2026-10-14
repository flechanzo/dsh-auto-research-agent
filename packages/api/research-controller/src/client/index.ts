/** Client entry for the generated Session-scoped research Remote namespace. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-research-controller/remote'

export type { ResearchRemote } from './remote-types.ts'
export type {
  ResearchArtifact,
  ResearchBranch,
  ResearchCommandValue,
  ResearchMemorySnapshot,
  ResearchNode,
  ResearchNodeStatus,
  ResearchPlanFile,
  ResearchSnapshot,
  ResearchStage,
  ResearchState,
} from '../types.ts'

/** Required Client Remote services. */
export const inject = ['remote', 'remote.research']

/** The generated namespace is consumed directly by feature UI packages. */
export function apply(_ctx: Context): void {}
