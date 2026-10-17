import { useEffect, useSyncExternalStore } from 'react'
import type {
  ResearchCommandValue,
  ResearchRemote,
  ResearchState,
} from '@deepseek-ai/dsh-api-research-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'

/** One client snapshot shared by the center transcript and the right panel. */
export interface ResearchSessionSnapshot {
  readonly revision: number
  readonly state: ResearchState
}

interface Entry {
  snapshot?: ResearchSessionSnapshot
  listeners: Set<() => void>
}

const entries = new Map<string, Entry>()

function entryOf(sessionId: SessionId): Entry {
  const key = String(sessionId)
  let entry = entries.get(key)
  if (entry === undefined) {
    entry = { listeners: new Set() }
    entries.set(key, entry)
  }
  return entry
}

function notify(entry: Entry): void {
  for (const listener of entry.listeners) listener()
}

function publish(entry: Entry, snapshot: ResearchSessionSnapshot): boolean {
  if (entry.snapshot !== undefined && entry.snapshot.revision > snapshot.revision) return false
  entry.snapshot = snapshot
  notify(entry)
  return true
}

/** Read the latest locally published snapshot for one Session. */
export function researchSessionSnapshot(sessionId: SessionId): ResearchSessionSnapshot | undefined {
  return entryOf(sessionId).snapshot
}

/** Publish a command result to every visible projection of the same Session. */
export function publishResearchSession(sessionId: SessionId, snapshot: ResearchCommandValue['snapshot']): void {
  const entry = entryOf(sessionId)
  publish(entry, { revision: snapshot.revision, state: snapshot.state })
}

/** Subscribe to updates for one Session and return an idempotent disposer. */
export function subscribeResearchSession(sessionId: SessionId, listener: () => void): () => void {
  const entry = entryOf(sessionId)
  entry.listeners.add(listener)
  return () => { entry.listeners.delete(listener) }
}

/** Read the remote snapshot and publish it for every mounted projection. */
export async function loadResearchSession(
  research: Pick<ResearchRemote, 'read'>,
  sessionId: SessionId,
  _signal?: AbortSignal,
): Promise<RemoteResult<ResearchSessionSnapshot>> {
  const result = await research.read({ sessionId })
  if (!result.ok || _signal?.aborted) return result
  const snapshot: ResearchSessionSnapshot = {
    revision: result.value.revision,
    state: result.value.state,
  }
  const entry = entryOf(sessionId)
  publish(entry, snapshot)
  return { ok: true, value: entry.snapshot ?? snapshot }
}

/** Bind a component to the shared research snapshot and load it on mount. */
export function useResearchSession(
  research: ResearchRemote,
  sessionId: SessionId,
  signal?: AbortSignal,
): ResearchSessionSnapshot | undefined {
  const snapshot = useSyncExternalStore(
    listener => subscribeResearchSession(sessionId, listener),
    () => researchSessionSnapshot(sessionId),
    () => researchSessionSnapshot(sessionId),
  )
  useEffect(() => {
    void loadResearchSession(research, sessionId, signal)
  }, [research, sessionId, signal])
  return snapshot
}
