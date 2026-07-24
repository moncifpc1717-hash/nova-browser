# Nova Roadmap

This roadmap is grounded in the actual state of the codebase as of v0.1
(`package.json` version `0.1.0`), not the eventual product vision. Phase 0.1
lists only features that are implemented and working today, cited against
real files. Everything after it is future work, sequenced by dependency
and risk rather than by a fixed calendar — features that unlock or
de-risk later ones come first.

## Phase 0.1 — "Genesis" (current)

Everything in this phase exists in `src/` today and is exercised by the app
as shipped:

**Multi-provider streaming chat.** `ChatService` (`src/main/ai/chat-service.ts`)
streams responses from six provider configurations —
OpenAI, Anthropic, Google Gemini, xAI Grok, DeepSeek, and local Ollama — via a
single `ChatAdapter` interface (`src/main/ai/providers/types.ts`) with four
concrete implementations (`OpenAIAdapter` doubling for Grok/DeepSeek since
they share the OpenAI wire format, plus `AnthropicAdapter`, `GeminiAdapter`,
`OllamaAdapter`). Streaming is delta-by-delta over `IPC.AI_CHAT_DELTA`, with
persona and injected context (page content + long-term memory) assembled in
`ChatService.buildSystem()`.

**An autonomous agent with a confirmation gate.** `AgentRunner`
(`src/main/ai/agent/agent-runner.ts`) runs a bounded (24-step) ReAct loop
against real page state, using the injected `window.__nova` controller
(`src/main/ai/agent/page-controller.ts`) for snapshot/click/type/select/scroll,
a strict JSON action schema validated by `parseAction()`
(`src/main/ai/agent/action-parser.ts`), and a genuine human-in-the-loop
confirmation gate for anything flagged `sensitive` (both by the model and by
a deterministic keyword backstop). Full detail in `docs/AGENTS.md`.

**Real Chromium tabs, not embedded webviews.** `TabManager`
(`src/main/core/tab-manager.ts`) manages one `WebContentsView` per tab under
a `BaseWindow`, each sandboxed (`sandbox: true, contextIsolation: true,
nodeIntegration: false`, no preload) so untrusted web content never touches
Node. Bounds are measured live in the renderer (`useViewportBounds.ts`) and
synced to the correct tab.

**sql.js-backed persistence** for history, bookmarks, vault, memory, and
settings. `Database` (`src/main/services/database.ts`) wraps SQLite-via-WASM
with debounced disk flushing; six services
(`HistoryService`, `BookmarkService`, `VaultService`, `MemoryService`,
`ProfileService`, `SettingsService`) sit on top with typed CRUD. Vault
secrets and provider API keys are encrypted at rest via Electron's
`safeStorage` (OS keychain/DPAPI/libsecret).

**Downloads.** `DownloadManager` (`src/main/core/download-manager.ts`) hooks
`will-download` on the active session, tracks progress, and pushes live
updates to `DownloadsPage.tsx` over `IPC.DOWNLOAD_CHANGED`.

**Internal pages** rendered as first-class chrome (not remote content):
New Tab (`NewTabPage.tsx`), Settings (`SettingsPage.tsx`), History
(`HistoryPage.tsx`), Bookmarks (`BookmarksPage.tsx`), Downloads
(`DownloadsPage.tsx`), routed by `InternalRouter.tsx` off `nova://` URLs
parsed in `TabManager.internalPageOf()`.

**An Arc-style UI**: a vertical `TabSidebar.tsx` rail, a unified `Omnibox.tsx`
with live intent classification (`classifyOmni()` from `src/shared/omnibox.ts`,
run identically in main and renderer), a collapsible `AIPanel.tsx` sidebar
with framer-motion transitions, and a glassmorphic design system
(`tailwind.config.js`, `styles/index.css`).

**Browsing profiles (backend only).** `ProfileService` maps profiles to
isolated Electron session partitions (`persist:profile-<id>`) consumed by
`TabManager.create()`; a single "Personal" profile is auto-created. This is
listed here because the isolation mechanism is real and working — the
missing piece (a profile-switcher UI) is called out explicitly in Phase 0.3.

---

## Phase 0.2 — "Reliability & everyday parity"

Rationale: before adding new AI surfaces, close the gaps that make Nova feel
incomplete as a *daily-driver browser*, and fix the rough edges already
visible in the v0.1 code. This phase is intentionally light on new AI
capability and heavy on making what exists solid, because every later phase
(especially Automation and multi-agent) becomes harder to debug on top of an
unreliable base.

- **Reading mode.** A distraction-free article view. Low-risk and high-value
  to build now because the extraction primitive already exists —
  `window.__nova.readable()` in `page-controller.ts` already produces clean,
  script/nav/footer-stripped text (used today for chat page-context and the
  agent's `extract` action). This phase turns that into a dedicated reader UI
  surface instead of only an internal data source.
- **PDF viewer.** Chromium ships a PDF renderer; Nova doesn't yet wire it in
  as a tab content type, so PDFs currently fall through to a download or an
  external viewer. Needed before "browser" claims full parity with
  Chrome/Edge/Arc.
- **Chat correctness fixes.** The "Stop generating" button in `AIPanel.tsx`
  currently only clears the UI's local `isStreaming` flag — it does not call
  `window.nova.ai.abort()`, so the underlying provider stream keeps running
  in the main process even though the UI looks stopped. `ChatService.abort()`
  and `IPC.AI_ABORT` already exist and are wired for exactly this; the fix is
  purely on the renderer side (`ChatComposer`/`AIPanel`'s stop handler should
  call `window.nova.ai.abort(requestId)`).
- **Vault autofill.** `VaultService.findForOrigin()` already exists in
  `src/main/services/vault-service.ts` but is not wired to any IPC channel or
  UI — there is no actual autofill feature yet, just a dormant lookup method.
  Wiring it up (new IPC channel, a form-detection hook in the page controller,
  a UI prompt) turns the vault from "a password list you copy from" into
  "a password manager that fills forms."
- **Agent robustness.** Today, `ask` doesn't truly pause-and-resume a run —
  the code comment in `agent-runner.ts` says the user's answer starts a *new*
  `agent.run()` call rather than continuing the paused one. Before building
  more agent capability on top, decide whether that's acceptable long-term or
  needs a real resume mechanism (a `resumeRun(runId, answer)` path that
  re-enters `loop()` with the answer folded into the transcript).

## Phase 0.3 — "Personalization & tab power features"

Rationale: with the base solid, invest in the surfaces power users expect
from a modern browser, and finish the multi-profile story that Phase 0.1
half-built.

- **Profiles UI.** The isolation mechanism (`ProfileService.activePartition()`)
  already works; what's missing is a profile switcher, an "add profile" flow
  in the UI, and per-profile visual identity in the sidebar. This is
  sequenced early in this phase specifically because the hard (session
  isolation) part is done — it's a UI-only task now.
- **Split view.** Two tabs side by side in one window. This needs new layout
  math in `TabManager`/`useViewportBounds` (more than one active, visible,
  bounded `WebContentsView` at once, each occupying half the content rect)
  rather than the current single-active-view model — a real architectural
  extension, not a UI-only change.
- **Picture-in-picture.** A floating always-on-top mini-view for one tab
  (typically video). Builds on the same "more than one visible WebContentsView"
  primitive split view needs, so sequencing it alongside/after split view
  lets both features share the underlying `TabManager` changes.
- **Tab organization by AI.** Automatic grouping/naming of tabs by topic,
  using the agent's existing page-reading primitives
  (`window.__nova.readable()`/`meta()`) as the input signal rather than
  inventing a new extraction path. This is a genuinely new AI feature (not
  just an infra change), so it's placed after the split-view/PiP
  infrastructure work rather than competing with it for the same phase.

## Phase 0.4 — "Voice & automation"

Rationale: these are the two biggest *new capability* investments in the
brief, and both are substantial enough to warrant their own phase rather than
being squeezed alongside UI work. Both are currently pure placeholders —
`NovaSettings.voiceEnabled`/`wakeWord` exist as schema fields with zero
supporting implementation, and there is no scheduler or workflow concept
anywhere in `src/main`.

- **Voice mode.** "Hey Nova" wake-word detection, speech-to-text for input,
  text-to-speech for responses, built on WebRTC audio capture. This is a
  ground-up build: no microphone access, no STT/TTS pipeline, and no
  wake-word engine exist in the codebase today. Sequencing notes:
  - Wake-word detection should run locally (on-device) for both latency and
    privacy — always-listening audio should not require a network round trip
    per wake attempt.
  - STT/TTS can start provider-backed (reusing the existing
    `ProviderRegistry`/adapter pattern where providers expose speech
    endpoints) before investing in a fully local pipeline, consistent with
    how chat already treats "provider" as a pluggable backend.
  - The settings scaffold is already in place (`voiceEnabled`, `wakeWord` in
    `NovaSettings`) — implementation should honor those existing fields
    rather than introducing parallel config.
- **Automation workflows.** Scheduled, multi-step routines ("every morning,
  check my inbox and summarize anything urgent") that run without a human
  present to click through an omnibox command. This requires, in order:
  1. A persistence model for a saved "workflow" (currently every
     `agent.run()` is one-shot and ephemeral — nothing about a run is
     designed to be saved and replayed).
  2. A scheduler/trigger service (time-based at minimum; event-based
     as a stretch) — nothing like this exists in `src/main` today.
  3. Revisiting the confirmation gate's UX for unattended execution: today,
     `confirmSensitiveActions` is a single global on/off toggle
     (`SettingsPage.tsx`) that pauses the loop until a human clicks a button
     in the live UI. An unattended, scheduled run cannot rely on a human being
     present to click Approve — this needs either a pre-authorization model
     (the user approves a class of actions when creating the workflow) or a
     hard rule that automations simply cannot perform anything the safety
     backstop or model flags as sensitive.

## Phase 1.0 — "Multi-agent system & platform maturity"

Rationale: the specialized multi-agent roster (Planner, Research, Coding,
Writing, Shopping, Travel, Email, Automation-as-an-agent) is the most
architecturally ambitious item in the brief, and it's placed last because it
depends on infrastructure from every earlier phase — Automation's scheduler,
Voice's hands-free interaction model, and the Browser agent's proven
confirmation-gate pattern all need to exist first as reference
implementations before generalizing them into a coordinated multi-agent
framework. This phase also bundles the packaging/distribution work needed to
call the product "1.0."

- **The Planner agent and specialist agents.** A component that decomposes a
  high-level goal into sub-tasks and routes them to the right specialist
  (today, `AgentRunner` only ever plans its own next single step — there is
  no task-graph or delegation concept anywhere in `src/main/ai`). Each
  specialist (Research, Coding, Writing, Shopping, Travel, Email) needs its
  own system prompt, and likely its own narrower action vocabulary, following
  the pattern `AGENT_SYSTEM`/`AgentActionType` already establish for the
  Browser agent — the extension recipe in `docs/AGENTS.md` §7 is the template
  for how each of these would plug into the existing action-parser/execute
  machinery, or a parallel structure modeled on it.
  - **Memory agent.** `MemoryService` already provides durable, typed storage
    with prompt injection (`buildContextBlock()`) — turning it into an
    *agent* means adding a reasoning loop that decides what's worth
    remembering and proactively curates/summarizes stored memories, rather
    than only accepting explicit `memory.add()` calls.
- **Chrome extension support.** Substantial due to Nova's process model:
  extensions expect Chromium's extension APIs against a `BrowserWindow`/tab
  content model, and Nova's tabs are `WebContentsView`s under a `BaseWindow`
  with sandboxed, preload-less web content by design. Supporting extensions
  means deciding how much of the extension API surface to expose without
  compromising the sandboxing model that currently keeps untrusted page code
  away from Node entirely (see `docs/ARCHITECTURE.md` §6).
- **Packaging, signing, and auto-update for Windows/macOS/Linux.**
  `electron-builder.yml` already defines targets for all three platforms
  (macOS dmg/zip with hardened runtime, Windows nsis/portable, Linux
  AppImage/deb), but this is unexecuted configuration — there is no evidence
  in the repo of actual code-signing certificates, macOS notarization, or a
  tested release pipeline, and `electron-updater` is not a dependency in
  `package.json`. Reaching a genuine 1.0 requires: acquiring and wiring
  signing certificates per platform, notarizing macOS builds, and adding
  `electron-updater` (or equivalent) with a real update feed — none of which
  is a code change to Nova's own architecture, but all of which gates
  calling any build "shippable."

---

## Sequencing notes

- Phases 0.2 and 0.3 deliberately avoid new LLM-driven surfaces — they either
  fix existing gaps (stop button, vault autofill, agent resume semantics) or
  add browser features that don't need a model at all (split view, PiP,
  profiles UI). This keeps the AI surface area (chat + one agent) stable and
  well-understood while the non-AI parts of the browser mature.
- Voice and Automation are grouped together in Phase 0.4 because both require
  building genuinely new infrastructure from zero (no partial implementation
  exists for either), and both raise the same open question — what happens
  to the confirmation gate when no human is watching — so it's more efficient
  to resolve that question once, for both features, than twice.
- The multi-agent system is deliberately last: it is a generalization of a
  pattern (system prompt + closed action schema + parser + confirmation gate)
  that Nova has only proven once, for one domain (browsing). Generalizing a
  pattern that's been validated once is a much smaller risk than designing a
  multi-agent framework speculatively before any second agent exists to test
  the abstraction against.
