/** Research Sidebar layout contracts that keep checkpoint actions reachable in short windows. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  fileURLToPath(new URL('../src/client/ResearchPanel.module.css', import.meta.url)),
  'utf8',
)
const sidebarCss = readFileSync(
  fileURLToPath(new URL('../../ui-sidebar-right/src/client/shell/SidebarRight.module.css', import.meta.url)),
  'utf8',
)
const declarationText = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
const sidebarDeclarationText = sidebarCss.replace(/\/\*[\s\S]*?\*\//g, ' ')

function declarations(source: string, selector: string): string[] {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rule = new RegExp(`(?:^|\\})\\s*${escapedSelector}\\s*\\{([^{}]*)\\}`).exec(source)
  if (rule === null) throw new Error(`${selector} has no matching rule`)
  return (rule[1] ?? '').split(';').map(part => part.trim()).filter(Boolean)
}

function rootDeclarations(): string[] {
  return declarations(declarationText, '.root')
}

describe('ResearchPanel Sidebar layout', () => {
  it('lets the DockKit pane body measure the full workflow before scrolling', () => {
    expect(rootDeclarations()).toEqual(expect.arrayContaining([
      'flex: 0 0 auto',
      'min-height: 100%',
      'height: auto',
      'max-height: none',
      'overflow: visible',
    ]))
  })

  it('makes only the research tab body content-sized so confirmation stays reachable', () => {
    expect(declarations(sidebarDeclarationText, ".tabBody[data-sidebar-right-tab-kind='research-workflow']")).toEqual(expect.arrayContaining([
      'height: auto',
      'min-height: 100%',
      'overflow: visible',
    ]))
  })
})
