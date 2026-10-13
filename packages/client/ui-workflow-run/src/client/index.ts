/** Browser plugin for durable workflow-run Conversation Nodes. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionTarget } from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { WorkflowRunPanel, type WorkflowRunInjected } from './WorkflowRunPanel.tsx'
import { ResearchPanel } from './ResearchPanel.tsx'
import { ResearchTitle } from './ResearchTitle.tsx'
import { ResearchAction, type ResearchActionInjected } from './ResearchAction.tsx'
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
export const inject = ['uiConversation', 'uiWorkspace', 'slots', 'sessions', 'locale']

/** Register the workflow Definition, dictionary, and keyed Chat renderer. */
export function apply(ctx: ClientContext): void {
  ctx.uiConversation.events.register(workflowRunDefinition)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-workflow-run: dictionaries')
  const t = ctx.locale.bind(NS)
  const sidebarTabs = ctx.get('sidebarRightTabs')
  const sidebar = ctx.get('sidebarRight')
  if (sidebarTabs !== undefined && sidebar !== undefined) {
    ctx.effect(() => sidebarTabs.register(researchDefinition(t)), 'ui-workflow-run: research tab type')
    ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
      name: 'sidebar.right.pane.tab', key: RESEARCH_ID, locale: NS,
    }, ResearchPanel))
    ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
      name: 'sidebar.right.pane.tab.title', key: RESEARCH_ID, locale: NS,
    }, ResearchTitle))
    ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
      name: 'conversation.session.header.actions', id: 'research-workflow', order: 30, locale: NS,
      inject: (): ResearchActionInjected => ({ open: () => { sidebar.openTab(RESEARCH_KIND) } }),
    }, ResearchAction))
  }
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node',
    key: 'workflow-run',
    locale: NS,
    inject: (): WorkflowRunInjected => ({
      openSession: (target: SessionTarget) => { ctx.uiWorkspace.openSession(target) },
    }),
  }, WorkflowRunPanel))
}
