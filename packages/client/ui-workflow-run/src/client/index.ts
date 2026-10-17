/** Browser plugin for durable workflow-run Conversation Nodes. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionTarget } from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-research-controller/client'
import type {} from '@deepseek-ai/dsh-client-file-upload/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { WorkflowRunPanel, type WorkflowRunInjected } from './WorkflowRunPanel.tsx'
import { ResearchPanel, type ResearchPanelInjected } from './ResearchPanel.tsx'
import { ResearchTranscriptMain, type ResearchTranscriptMainInjected } from './ResearchTranscriptMain.tsx'
import { ResearchBranchSelector, type ResearchBranchSelectorInjected } from './ResearchBranchSelector.tsx'
import { ResearchTitle } from './ResearchTitle.tsx'
import { ResearchAction, type ResearchActionInjected } from './ResearchAction.tsx'
import { ResearchBranchAction, type ResearchBranchActionInjected } from './ResearchBranchAction.tsx'
import { researchDefinition, RESEARCH_ID, RESEARCH_KIND } from './research-definition.ts'
import { en, NS, type WorkflowRunKey, zh } from './locales.ts'
import { workflowRunDefinition } from './workflow-definition.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Durable workflow-run node copy. */
    workflowRun: WorkflowRunKey
  }
}

/** Required services for Definition, keyed renderer, navigation, and copy. */
export const inject = [
  'uiConversation', 'uiWorkspace', 'slots', 'sessions', 'locale',
  'sidebarRightTabs', 'sidebarRight', 'remote', 'remote.research', 'fileUpload',
]

/** Register the workflow Definition, dictionary, and keyed Chat renderer. */
export function apply(ctx: ClientContext): void {
  ctx.uiConversation.events.register(workflowRunDefinition)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-workflow-run: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.sidebarRightTabs.register(researchDefinition(t)), 'ui-workflow-run: research tab type')
  ctx.effect(
    () => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
      name: 'sidebar.right.pane.tab', key: RESEARCH_ID, locale: NS,
      inject: (): ResearchPanelInjected => ({
        research: ctx.remote.research,
        fileUpload: ctx.fileUpload,
      }),
    }, ResearchPanel)),
    'ui-workflow-run: research tab body',
  )
  ctx.effect(
    () => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
      name: 'sidebar.right.pane.tab.title', key: RESEARCH_ID, locale: NS,
    }, ResearchTitle)),
    'ui-workflow-run: research tab title',
  )
  ctx.effect(
    () => ctx.slots.inject('conversation.chat.research', () => ctx.slots.register({
      name: 'conversation.chat.research', locale: NS,
      inject: (_sessionId): ResearchTranscriptMainInjected => ({ research: ctx.remote.research }),
    }, ResearchTranscriptMain)),
    'ui-workflow-run: research conversation transcript',
  )
  ctx.effect(
    () => ctx.slots.inject('conversation.chat.branch', () => ctx.slots.register({
      name: 'conversation.chat.branch', locale: NS,
      inject: (_sessionId): ResearchBranchActionInjected => ({ research: ctx.remote.research }),
    }, ResearchBranchAction)),
    'ui-workflow-run: research same-session branch action',
  )
  ctx.effect(
    () => ctx.slots.inject('conversation.session.header.tabs', () => ctx.slots.register({
      name: 'conversation.session.header.tabs', id: 'research-branch-selector', order: 20, locale: NS,
      inject: (): ResearchBranchSelectorInjected => ({ research: ctx.remote.research }),
    }, ResearchBranchSelector)),
    'ui-workflow-run: research branch selector',
  )
  ctx.effect(
    () => ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
      name: 'conversation.session.header.actions', id: 'research-workflow', order: 30, locale: NS,
      inject: (sessionId): ResearchActionInjected => ({
        open: () => {
          ctx.sidebarRight.openTab(RESEARCH_KIND, { params: { sessionId } })
        },
      }),
    }, ResearchAction)),
    'ui-workflow-run: research header action',
  )
  ctx.effect(
    () => ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
      name: 'conversation.chat.node',
      key: 'workflow-run',
      locale: NS,
      inject: (): WorkflowRunInjected => ({
        openSession: (target: SessionTarget) => { ctx.uiWorkspace.openSession(target) },
      }),
    }, WorkflowRunPanel)),
    'ui-workflow-run: workflow node',
  )
}
