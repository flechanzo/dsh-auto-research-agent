/** Execution-time authority checks for the model-facing goal tools. */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { GoalView } from '@deepseek-ai/dsh-goal'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import type { SessionEvent, SessionSeq } from '@deepseek-ai/dsh-session'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-session-projection'

/** The calling agent plus the immutable event cut and open-turn start seq used for authority checks. */
export interface GoalToolExecution {
  readonly agent: Agent
  readonly events: readonly SessionEvent[]
  readonly openTurnStartSeq: SessionSeq
}

/** Goal controls that may fail while the model is correcting its own request. */
const GOAL_CONTROL_TOOLS = new Set(['create_goal', 'get_goal', 'update_goal'])

/** Hard authority granted to one state-changing call. */
export type GoalToolAuthority =
  | { readonly kind: 'direct-human' }
  | { readonly kind: 'goal-round'; readonly goal: GoalView }

/** Throw one structured tool-policy failure. */
function reject(message: string, code = 'GOAL_TOOL_AUTHORITY_REQUIRED'): never {
  throw new HarnessError(message, code)
}

/** Resolve the immutable event cut and open-turn boundary without copying the turn suffix. */
function openTurnEvents(
  ctx: Context,
  agent: Agent,
): Pick<GoalToolExecution, 'events' | 'openTurnStartSeq'> {
  // oxlint-disable-next-line typescript/no-deprecated -- Existing Session history read; migration deferred.
  const events = agent.session.snapshotEvents()
  const boundary = ctx.sessionProjections.stateOf(agent.session, 'turnBoundary')
  if (boundary === undefined || boundary.openTurnStartSeq === null) {
    reject('goal tools require an open model turn', 'GOAL_TOOL_DRIVER_REQUIRED')
  }
  return { events, openTurnStartSeq: boundary.openTurnStartSeq }
}

/**
 * Resolve and authenticate the calling agent and its driver boundary.
 * @param ctx - Context carrying the live agent registry.
 * @param exec - Tool execution metadata supplied by the registry.
 * @returns The authenticated agent, immutable event cut, and open-turn boundary.
 */
export function goalToolExecution(ctx: Context, exec: ToolRunContext): GoalToolExecution {
  const agent = exec.agent
  if (agent === undefined) {
    return reject('goal tools require a calling agent', 'GOAL_TOOL_AGENT_REQUIRED')
  }
  if (ctx.agents.get(agent.id) !== agent || agent.status !== 'running'
    || ctx.agents.currentInitiator() !== agent) {
    return reject(
      'goal tools require the exact live calling agent inside its active driver',
      'GOAL_TOOL_DRIVER_REQUIRED',
    )
  }
  return { agent, ...openTurnEvents(ctx, agent) }
}

/** Whether the captured open turn contains an event accepted by `predicate`. */
function someOpenTurnEvent(
  execution: GoalToolExecution,
  predicate: (event: SessionEvent) => boolean,
): boolean {
  for (let seq = execution.openTurnStartSeq + 1; seq < execution.events.length; seq += 1) {
    const event = execution.events[seq]
    if (event !== undefined && predicate(event)) return true
  }
  return false
}

/**
 * Whether host-attested human input appears in the current root-agent turn.
 * An omitted `Agent.followup()` / `steer()` source resolves to `user`, so non-human
 * producers must supply their own source rather than inheriting this authority.
 */
function hasDirectHumanInput(ctx: Context, execution: GoalToolExecution): boolean {
  if (!ctx.agents.roots().includes(execution.agent)) return false
  return someOpenTurnEvent(execution, event =>
    event.type === 'user/message' && event.data.source.kind === 'user')
}

/** Whether this turn is the current goal's exact admitted round. */
function isMatchingGoalRound(execution: GoalToolExecution, goal: GoalView): boolean {
  return someOpenTurnEvent(execution, event => event.type === 'user/message'
    && event.data.source.kind === 'goal'
    && event.data.source.goalId === goal.id
    && event.data.source.revision === goal.revision
    && event.data.source.round === goal.roundsStarted)
}

/**
 * Require authority originating in a human message accepted by a runtime root.
 * @param ctx - Context carrying the live agent graph.
 * @param execution - Authenticated current tool execution.
 */
export function requireDirectHuman(ctx: Context, execution: GoalToolExecution): void {
  if (hasDirectHumanInput(ctx, execution)) return
  reject('this goal operation requires a direct human turn on a top-level agent')
}

/**
 * Resolve completion authority from either direct human input or the exact goal round.
 * @param ctx - Context carrying live agents and goal state.
 * @param execution - Authenticated current tool execution.
 * @returns The direct-human or exact-goal-round authority grant.
 */
export function completionAuthority(ctx: Context, execution: GoalToolExecution): GoalToolAuthority {
  if (hasDirectHumanInput(ctx, execution)) return { kind: 'direct-human' }
  const goal = ctx.goals.get(execution.agent)
  if (goal !== undefined && isMatchingGoalRound(execution, goal)) {
    return { kind: 'goal-round', goal }
  }
  return reject('complete and blocked require a direct human turn or the current goal round')
}

/**
 * Explain why an autonomous round cannot close while work is still incomplete.
 *
 * A continuable delegation returns as soon as its child accepts the prompt, so
 * a parent can otherwise call `complete` while that child is still running.
 * Tool failures in the same round have the same risk: the model may produce a
 * plausible summary after an unsuccessful fetch or file operation. Goal-tool
 * argument corrections are excluded because the model is expected to retry
 * those calls in the same turn.
 *
 * @param ctx - Context carrying the live Agent registry.
 * @param execution - Authenticated goal-tool execution and its event cut.
 * @returns A user/model-facing reason when completion must be rejected.
 */
export function completionBlockReason(ctx: Context, execution: GoalToolExecution): string | undefined {
  const calls = new Map<string, string>()
  for (let seq = execution.openTurnStartSeq + 1; seq < execution.events.length; seq += 1) {
    const event = execution.events[seq]
    if (event === undefined) continue
    if (event.type === 'tool/call') {
      calls.set(event.data.callId, event.data.name)
      continue
    }
    if (event.type !== 'tool/result' || event.data.message.isError !== true) continue
    const name = calls.get(event.data.message.toolCallId)
    if (name !== undefined && !GOAL_CONTROL_TOOLS.has(name)) {
      return `tool "${name}" failed in this round; resolve or retry it before marking the goal complete`
    }
  }

  const runningChild = ctx.agents.list().find(candidate => candidate !== execution.agent
    && candidate.status === 'running'
    && candidate.session.header.parentSession === execution.agent.session.id)
  if (runningChild !== undefined) {
    return `subagent "${runningChild.id}" is still running; wait for its result before marking the goal complete`
  }
  return undefined
}
