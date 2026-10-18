/** The research preset exposes fetch-only web access for indexed literature. */
import { fileURLToPath } from 'node:url'
import { loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import { expect, it } from 'vitest'

it('does not expose the native web_search tool to research Sessions', () => {
  const rows = loadOverlayPatches(
    'research-preset',
    fileURLToPath(new URL('../presets/research.patch.yml', import.meta.url)),
  ).flatMap(patch => patch.insert ?? [])
  const preset = rows.find(row => row.id === 'preset-research')
  expect(preset).toBeDefined()
  const config = preset?.config as {
    plugins?: readonly {
      id?: string
      config?: { search?: boolean; fetch?: boolean }
    }[]
  } | undefined
  const webTool = config?.plugins?.find(plugin => plugin.id === 'tool-web')
  expect(webTool?.config).toMatchObject({ search: false, fetch: true })
})
