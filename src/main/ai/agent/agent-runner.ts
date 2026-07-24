/**
 * AgentRunner — Nova's autonomous browsing agent.
 *
 * It runs a ReAct loop: observe the page → ask the LLM for one JSON action →
 * validate → (optionally pause for user confirmation) → execute → repeat, until
 * the model emits `finish`/`ask` or a step budget is hit. Every state change is
 * streamed to the renderer so the UI can render a live action trace.
 *
 * The runner is deliberately decoupled from the TabManager via `PageBridge`, so
 * it can be unit-reasoned about and the concrete Electron plumbing stays in the
 * tab layer.
 */
import type { WebContents } from 'electron'
import type {
  AgentAction,
  AgentActionRecord,
  AgentRunState,
  AgentRunStatus,
  LlmMessage
} from '@shared/types'
import { id, sleep } from '../../core/util'
import type { ProviderRegistry } from '../provider-registry'
import type { SettingsService } from '../../services/settings-service'
import { AGENT_SYSTEM, describeAction } from '../prompts'
import { parseAction } from './action-parser'
import {
  INSTALL_SCRIPT,
  META_EXPR,
  READABLE_EXPR,
  SNAPSHOT_EXPR,
  clickExpr,
  scrollExpr,
  selectExpr,
  typeExpr
} from './page-controller'

/** The capabilities the runner needs from the tab layer. */
export interface PageBridge {
  /** WebContents for an existing tab, or null if it's gone. */
  getWebContents(tabId: string): WebContents | null
  /** Open a new tab (used when the agent starts with no target tab). */
  createTab(url: string): Promise<string>
  /** Navigate a tab and resolve once loaded. */
  navigate(tabId: string, url: string): Promise<void>
  /** Flag a tab as agent-controlled so the UI can show the takeover banner. */
  setAgentControlled(tabId: string, controlled: boolean): void
}

const MAX_STEPS = 24

export class AgentRunner {
  private runs = new Map<string, AgentRunState>()
  private aborts = new Map<string, boolean>()
  /** Resolvers for steps parked awaiting user confirmation. */
  private pendingConfirm = new Map<string, (approved: boolean) => void>()

  constructor(
    private bridge: PageBridge,
    private registry: ProviderRegistry,
    private settings: SettingsService,
    private emit: (state: AgentRunState) => void
  ) {}

  /** Kick off a run for `goal`, optionally bound to an existing tab. */
  async run(goal: string, tabId: string | null): Promise<string> {
    const runId = id('run_')
    const state: AgentRunState = {
      id: runId,
      goal,
      status: 'planning',
      tabId,
      steps: [],
      finalAnswer: null
    }
    this.runs.set(runId, state)
    this.publish(state)
    // Execute asynchronously; the caller just needs the run id to subscribe.
    void this.loop(state).catch((err) => {
      state.status = 'error'
      state.finalAnswer = err instanceof Error ? err.message : String(err)
      this.publish(state)
    })
    return runId
  }

  /** Resolve a parked confirmation from the renderer. */
  confirm(runId: string, _actionId: string, approved: boolean): void {
    const resolver = this.pendingConfirm.get(runId)
    if (resolver) {
      this.pendingConfirm.delete(runId)
      resolver(approved)
    }
  }

  abort(runId: string): void {
    this.aborts.set(runId, true)
    // Unblock any parked confirmation as a rejection.
    this.pendingConfirm.get(runId)?.(false)
    this.pendingConfirm.delete(runId)
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private publish(state: AgentRunState): void {
    this.emit({ ...state, steps: [...state.steps] })
  }

  private setStatus(state: AgentRunState, status: AgentRunStatus): void {
    state.status = status
    this.publish(state)
  }

  /** Ensure the run has a live tab and the controller is installed. */
  private async ensureTab(state: AgentRunState): Promise<WebContents> {
    if (!state.tabId) {
      state.tabId = await this.bridge.createTab('about:blank')
    }
    let wc = this.bridge.getWebContents(state.tabId)
    if (!wc) {
      state.tabId = await this.bridge.createTab('about:blank')
      wc = this.bridge.getWebContents(state.tabId)
    }
    if (!wc) throw new Error('Unable to acquire a browser tab for the agent.')
    this.bridge.setAgentControlled(state.tabId, true)
    await wc.executeJavaScript(INSTALL_SCRIPT, true).catch(() => undefined)
    return wc
  }

  /** Build the observation message handed to the model each step. */
  private async observe(wc: WebContents, state: AgentRunState): Promise<string> {
    await wc.executeJavaScript(INSTALL_SCRIPT, true).catch(() => undefined)
    const meta = (await wc
      .executeJavaScript(META_EXPR, true)
      .catch(() => ({ url: '', title: '' }))) as { url: string; title: string }
    const elements = (await wc.executeJavaScript(SNAPSHOT_EXPR, true).catch(() => '')) as string
    const history = state.steps
      .slice(-6)
      .map((s, i) => `${i + 1}. ${describeAction(s.action)}${s.error ? ` (error: ${s.error})` : ''}`)
      .join('\n')

    return [
      `GOAL: ${state.goal}`,
      `URL: ${meta.url}`,
      `PAGE TITLE: ${meta.title}`,
      history ? `RECENT STEPS:\n${history}` : 'RECENT STEPS: (none yet)',
      `ELEMENTS:\n${elements || '(no interactive elements detected — try scrolling or navigating)'}`,
      'Respond with exactly one JSON action.'
    ].join('\n\n')
  }

  private async loop(state: AgentRunState): Promise<void> {
    const wc = await this.ensureTab(state)
    const transcript: LlmMessage[] = [{ role: 'system', content: AGENT_SYSTEM }]

    for (let step = 0; step < MAX_STEPS; step++) {
      if (this.aborts.get(state.id)) {
        state.status = 'done'
        state.finalAnswer = state.finalAnswer ?? 'Stopped by user.'
        this.publish(state)
        break
      }

      this.setStatus(state, 'planning')
      const observation = await this.observe(wc, state)
      transcript.push({ role: 'user', content: observation })

      // Ask the model for the next action (non-streaming, single JSON object).
      const { adapter, model } = this.registry.adapterFor()
      const rawReply = await adapter.complete({
        model,
        messages: transcript,
        temperature: 0,
        maxTokens: 700
      })
      transcript.push({ role: 'assistant', content: rawReply })

      const parsed = parseAction(rawReply)
      if (!parsed.ok || !parsed.action) {
        // Feed the error back so the model can self-correct on the next turn.
        transcript.push({
          role: 'user',
          content: `Your last reply was not a valid action (${parsed.error}). Reply with exactly one JSON action.`
        })
        continue
      }

      const action = parsed.action
      const record: AgentActionRecord = {
        id: id('act_'),
        action,
        status: 'pending',
        at: Date.now()
      }
      state.steps.push(record)

      // Terminal actions.
      if (action.type === 'finish') {
        record.status = 'done'
        state.finalAnswer = action.message ?? 'Done.'
        this.setStatus(state, 'done')
        this.finishTab(state)
        return
      }
      if (action.type === 'ask') {
        record.status = 'done'
        state.finalAnswer = action.message ?? ''
        this.setStatus(state, 'paused')
        // The renderer surfaces the question; the user's reply arrives as a new run.
        return
      }

      // Confirmation gate for sensitive steps.
      const needsConfirm = action.sensitive && this.settings.get().confirmSensitiveActions
      if (needsConfirm) {
        record.status = 'awaiting-confirmation'
        this.setStatus(state, 'paused')
        const approved = await this.awaitConfirmation(state.id)
        if (!approved) {
          record.status = 'rejected'
          record.error = 'User declined this action.'
          transcript.push({
            role: 'user',
            content: 'The user declined that action. Choose a safe alternative or finish.'
          })
          this.publish(state)
          continue
        }
      }

      // Execute.
      record.status = 'running'
      this.setStatus(state, 'acting')
      try {
        record.result = await this.execute(wc, action, state)
        record.status = 'done'
      } catch (err) {
        record.status = 'error'
        record.error = err instanceof Error ? err.message : String(err)
        transcript.push({
          role: 'user',
          content: `That action failed: ${record.error}. Re-observe and try a different approach.`
        })
      }
      this.publish(state)
      await sleep(350) // let the page settle / SPA transitions finish
    }

    if (state.status !== 'done' && state.status !== 'paused') {
      state.status = 'done'
      state.finalAnswer = state.finalAnswer ?? 'Reached the step limit before completing the goal.'
      this.publish(state)
      this.finishTab(state)
    }
  }

  private awaitConfirmation(runId: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.pendingConfirm.set(runId, resolve)
    })
  }

  private finishTab(state: AgentRunState): void {
    if (state.tabId) this.bridge.setAgentControlled(state.tabId, false)
  }

  /** Perform a validated, approved action against the page. */
  private async execute(wc: WebContents, action: AgentAction, state: AgentRunState): Promise<string> {
    switch (action.type) {
      case 'navigate':
        await this.bridge.navigate(state.tabId!, action.url!)
        await wc.executeJavaScript(INSTALL_SCRIPT, true).catch(() => undefined)
        return `Navigated to ${action.url}`
      case 'click':
        return (await wc.executeJavaScript(clickExpr(action.target!), true)) as string
      case 'type':
        return (await wc.executeJavaScript(typeExpr(action.target!, action.value!), true)) as string
      case 'select':
        return (await wc.executeJavaScript(selectExpr(action.target!, action.value!), true)) as string
      case 'scroll':
        return (await wc.executeJavaScript(scrollExpr(action.direction ?? 'down'), true)) as string
      case 'wait':
        await sleep(action.ms ?? 1000)
        return `Waited ${action.ms ?? 1000}ms`
      case 'extract': {
        const text = (await wc.executeJavaScript(READABLE_EXPR, true)) as string
        return `Extracted ${text.split(/\s+/).length} words of page content.`
      }
      default:
        return 'noop'
    }
  }
}
