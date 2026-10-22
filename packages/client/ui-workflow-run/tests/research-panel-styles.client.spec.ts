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
const dockkitCss = readFileSync(
  fileURLToPath(new URL('../../ui-dockkit/src/components/dockkit.module.css', import.meta.url)),
  'utf8',
)
const declarationText = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
const sidebarDeclarationText = sidebarCss.replace(/\/\*[\s\S]*?\*\//g, ' ')
const dockkitDeclarationText = dockkitCss.replace(/\/\*[\s\S]*?\*\//g, ' ')

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
      'min-height: auto',
      'height: auto',
      'max-height: none',
      'overflow: visible',
    ]))
  })

  it('makes only the research tab body content-sized so confirmation stays reachable', () => {
    expect(declarations(sidebarDeclarationText, ".tabBody[data-sidebar-right-tab-kind='research-workflow']")).toEqual(expect.arrayContaining([
      'position: absolute',
      'inset: 0',
      'display: block',
      'height: auto',
      'min-height: 0',
      'overflow-x: hidden',
      'overflow-y: auto',
      'overscroll-behavior: contain',
    ]))
  })

  it('gives tab bodies a definite vertical flex track inside DockKit', () => {
    expect(declarations(dockkitDeclarationText, '.tabHost')).toEqual(expect.arrayContaining([
      'display: flex',
      'flex: 1 1 auto',
      'flex-direction: column',
      'min-height: 0',
    ]))
    expect(declarations(dockkitDeclarationText, '.paneBody')).toEqual(expect.arrayContaining([
      'display: flex',
      'flex-direction: column',
      'min-height: 0',
      'overflow: auto',
    ]))
    expect(declarations(dockkitDeclarationText, '.floatBody')).toEqual(expect.arrayContaining([
      'position: relative',
      'min-height: 0',
      'overflow: auto',
    ]))
  })

  it('keeps the relationship view readable inside the narrow sidebar', () => {
    expect(declarations(declarationText, '.branchMap')).toEqual(expect.arrayContaining([
      'display: flex',
      'max-height: 320px',
      'overflow-x: hidden',
      'overflow-y: auto',
    ]))
    expect(declarations(declarationText, '.branchMapLane')).toEqual(expect.arrayContaining([
      'width: 100%',
      'min-width: 0',
      'border-radius: var(--dsw-radius-md)',
      'background: var(--dsw-alias-bg-layer-1)',
    ]))
    expect(declarations(declarationText, '.branchMapLaneSteps')).toEqual(expect.arrayContaining([
      'margin-left: 5px',
      'padding-left: 8px',
      'border-left: 0.5px solid var(--dsw-alias-border-l2)',
    ]))
  })

  it('uses full-width step controls with a readable marker and copy column', () => {
    expect(declarations(declarationText, '.branchMapNode')).toEqual(expect.arrayContaining([
      'display: grid',
      'grid-template-columns: 22px minmax(0, 1fr) auto',
      'width: 100%',
      'min-width: 0',
    ]))
    expect(declarations(declarationText, '.branchMapNodeMarker')).toEqual(expect.arrayContaining([
      'width: 18px',
      'height: 18px',
      'border-radius: 50%',
    ]))
  })

  it('renders the alternate view as a connected node tree', () => {
    expect(declarations(declarationText, '.branchTreeCanvas')).toEqual(expect.arrayContaining([
      'display: flex',
      'width: 100%',
      'height: clamp(520px, 68vh, 760px)',
      'min-height: 520px',
      'overflow: auto',
    ]))
    expect(declarations(declarationText, '.branchTreeSection')).toEqual(expect.arrayContaining([
      'min-height: 600px',
    ]))
    expect(declarations(declarationText, '.branchTreeCanvas .branchTree')).toEqual(expect.arrayContaining([
      'display: flex',
      'min-height: 100%',
      'max-height: none',
      'overflow: visible',
    ]))
    expect(declarations(declarationText, '.branchTreeHeader')).toEqual(expect.arrayContaining([
      'display: grid',
      'grid-template-columns: 24px minmax(0, 1fr) auto',
      'width: 100%',
      'min-width: 0',
    ]))
    expect(declarations(declarationText, '.treeNode')).toEqual(expect.arrayContaining([
      'display: grid',
      'grid-template-columns: 20px minmax(0, 1fr) auto',
      'width: 100%',
    ]))
    expect(declarations(declarationText, '.branchTreeChildren')).toEqual(expect.arrayContaining([
      'display: flex',
      'flex-direction: row',
    ]))
    expect(declarations(declarationText, '.branchTreeNodes')).toEqual(expect.arrayContaining([
      'display: flex',
      'flex-direction: column',
    ]))
    expect(declarations(declarationText, '.branchTreePathNode')).toEqual(expect.arrayContaining([
      'display: flex',
      'flex-direction: column',
      'align-items: center',
    ]))
  })
})
