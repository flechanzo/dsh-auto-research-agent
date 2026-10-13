import type { TranslateNS } from '@deepseek-ai/dsh-client-locale/client'
import type { SidebarRightTabDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'

/** Page kind used by the research workflow right-sidebar tab. */
export const RESEARCH_KIND = 'research-workflow'
/** Stable registration identity for the research workflow tab. */
export const RESEARCH_ID = '@deepseek-ai/dsh-client-ui-workflow-run/research'

/** Define the page tab and expose it in the Sidebar guide.
 * @param t - Translator for the workflow UI namespace.
 * @returns A right-Sidebar page definition.
 */
export function researchDefinition(t: TranslateNS<'workflowRun'>): SidebarRightTabDefinition {
  return {
    id: RESEARCH_ID,
    kind: RESEARCH_KIND,
    priority: 'builtin',
    keepMounted: true,
    title: () => t('research.title'),
    guide: [{ id: RESEARCH_ID, order: 20, title: () => t('research.title'), description: () => t('research.open') }],
  }
}
