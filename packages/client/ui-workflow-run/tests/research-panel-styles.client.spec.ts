/** Research Sidebar layout contracts that keep checkpoint actions reachable in short windows. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  fileURLToPath(new URL('../src/client/ResearchPanel.module.css', import.meta.url)),
  'utf8',
)
const declarationText = css.replace(/\/\*[\s\S]*?\*\//g, ' ')

function rootDeclarations(): string[] {
  const rule = /(?:^|\})\s*\.root\s*\{([^{}]*)\}/.exec(declarationText)
  if (rule === null) throw new Error('ResearchPanel.module.css has no `.root` rule')
  return (rule[1] ?? '').split(';').map(part => part.trim()).filter(Boolean)
}

describe('ResearchPanel Sidebar scrolling', () => {
  it('makes the panel root the bounded vertical scroll container', () => {
    expect(rootDeclarations()).toEqual(expect.arrayContaining([
      'flex: 1 1 auto',
      'min-height: 0',
      'height: 100%',
      'max-height: 100%',
      'overflow-x: hidden',
      'overflow-y: auto',
      'overscroll-behavior: contain',
    ]))
  })
})
