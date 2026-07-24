<div align="center">

# ✦ Nova

### The AI-native browser. The AI *is* the browser.

Nova is not a browser with an AI assistant bolted on. It's a Chromium browser whose primary
interface is natural language. Type — or say — what you want, and Nova either navigates,
answers, or dispatches an autonomous agent that clicks, types, and browses on your behalf.

`Electron` · `React` · `TypeScript` · `Chromium (WebContentsView)` · `Tailwind` · `Framer Motion` · `sql.js`

</div>

---

## What Nova does today (v0.1 "Genesis")

Nova v0.1 is a **fully-wired, compiling foundation** — not a mockup. Every feature below is
implemented end-to-end across the main process, the IPC bridge, and the React UI.

| Capability | Status | Where |
|---|---|---|
| **Real Chromium tabs** (process-isolated, `WebContentsView`) | ✅ | `main/core/tab-manager.ts` |
| **Natural-language omnibox** — routes URL / search / question / task | ✅ | `shared/omnibox.ts`, `components/Omnibox.tsx` |
| **Autonomous browsing agent** — ReAct loop, real clicks/typing | ✅ | `main/ai/agent/*` |
| **Human-in-the-loop confirmation** for sensitive actions | ✅ | `AgentRunner` + `AgentTrace.tsx` |
| **Multi-provider AI** — OpenAI, Claude, Gemini, Grok, DeepSeek, Ollama | ✅ | `main/ai/providers/*` |
| **Streaming chat sidebar** grounded in the current page | ✅ | `main/ai/chat-service.ts`, `AIPanel.tsx` |
| **Page understanding** — reader-mode extraction for summarize/translate/explain | ✅ | `services/page-context-service.ts` |
| **History, Bookmarks, Downloads** | ✅ | `services/*`, `components/internal/*` |
| **Password vault** — encrypted via OS keychain (`safeStorage`) | ✅ | `services/vault-service.ts` |
| **Long-term memory** of the user (facts, habits, style, prompts) | ✅ | `services/memory-service.ts` |
| **Profiles** — isolated session partitions | ✅ | `services/profile-service.ts` |
| **Arc-inspired glassmorphic UI** with smooth motion | ✅ | `renderer/**` |

Voice mode, scheduled automations, the specialized multi-agent fleet, split view, PiP, reading
mode, PDF viewer, and extensions are designed-for and tracked in [`docs/ROADMAP.md`](docs/ROADMAP.md).

---

## Architecture in one minute

Nova is three TypeScript targets sharing one contract layer, built by `electron-vite`:

```
┌───────────────────────────── OS Window (BaseWindow) ─────────────────────────────┐
│  ┌────────────┐  ┌──────────────────────────────────────────────────────────┐   │
│  │  Chrome UI │  │  Active tab (WebContentsView) — real Chromium, sandboxed   │   │
│  │  (React)   │  │  painted into the rectangle the renderer reports           │   │
│  │  sidebar   │  │                                                            │   │
│  │  toolbar   │  │      the AI agent drives THIS view, same as the user       │   │
│  │  AI panel  │  │                                                            │   │
│  └────────────┘  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────────────┘
        renderer  ⇅  window.nova (preload contextBridge)  ⇅  main process services
```

- **`src/shared`** — the single source of truth for types, IPC channel names, the `window.nova`
  API contract, the provider catalog, and the omnibox classifier. Both processes import it, so
  the contract is compiler-enforced on both ends.
- **`src/main`** — privileged Node/Electron process. Owns tabs, storage (sql.js), the AI provider
  layer, the autonomous agent, and every IPC handler. Wired once in the composition root
  (`core/app-context.ts`) via constructor injection.
- **`src/preload`** — the *only* code that touches raw `ipcRenderer`. Exposes a clean, typed,
  promise-based `window.nova` and nothing else.
- **`src/renderer`** — the React chrome shell (Zustand store, controller, components).

Clean Architecture throughout: dependencies point inward, and the agent depends on a `PageBridge`
*interface* that `TabManager` implements — so the agent never knows about Electron.

Full detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · Agent internals: [`docs/AGENTS.md`](docs/AGENTS.md)

---

## How the pieces talk

**Omnibox → intent.** Every keystroke is classified locally (zero latency, no tokens):
a URL opens a page, a query searches, a question opens the AI panel, and an imperative
("find the cheapest iPhone and compare") launches the agent.

**Chat turn.** `controller.sendChat` → `AI_CHAT` IPC → `ChatService` assembles a system prompt
(Nova persona + your memory + optional live page text) → `ProviderRegistry.adapterFor()` returns
the right adapter → tokens stream back over `AI_CHAT_DELTA` and render live.

**Agent run.** `AgentRunner` loops: inject the page controller → snapshot the interactive
elements → ask the model for **one** strict-JSON action → validate it → if it's sensitive
(login, purchase, submit) **pause for your approval** → execute against the real page → repeat
until `finish`. The whole trace renders live in the sidebar.

---

## Project layout

```
nova/
├── electron.vite.config.ts      # 3-target build (main / preload / renderer)
├── electron-builder.yml         # Windows / macOS / Linux packaging
├── src/
│   ├── shared/                  # contracts shared by all processes
│   │   ├── types.ts             # every cross-process data shape
│   │   ├── ipc.ts               # the complete IPC channel registry
│   │   ├── api.ts               # the window.nova contract
│   │   ├── providers.ts         # AI provider catalog
│   │   └── omnibox.ts           # intent classifier + URL/search helpers
│   ├── main/
│   │   ├── index.ts             # bootstrap: window, chrome view, first tab
│   │   ├── core/                # app-context, tab-manager, download-manager, menu, util
│   │   ├── services/            # database (sql.js), settings, history, bookmarks,
│   │   │                        #   vault, memory, profiles, page-context
│   │   ├── ai/
│   │   │   ├── provider-registry.ts   # keys (encrypted), model, adapter factory
│   │   │   ├── chat-service.ts         # streaming chat orchestration
│   │   │   ├── prompts.ts              # persona + agent system prompt
│   │   │   ├── providers/              # openai / anthropic / gemini / ollama adapters
│   │   │   └── agent/                  # page-controller, action-parser, agent-runner
│   │   └── ipc/register-ipc.ts  # binds every channel to a service
│   ├── preload/index.ts         # contextBridge → window.nova
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── App.tsx          # the 3-column chrome layout
│           ├── state/store.ts   # Zustand store
│           ├── lib/             # controller, markdown, viewport bounds, describe
│           └── components/      # TabSidebar, Toolbar, Omnibox, AIPanel, AgentTrace,
│                                #   AgentOverlay, ChatComposer, internal/ pages
└── docs/                        # ARCHITECTURE.md · AGENTS.md · ROADMAP.md
```

---

## Getting started

> **Prerequisites:** Node 18+ and npm. First run downloads the Electron binary.

```bash
npm install            # install dependencies
npm run dev            # launch Nova in development (hot-reloaded renderer)
```

Then open **Settings** (bottom of the tab rail) and paste an API key for any provider — or
point Nova at a local **Ollama** server for fully offline, private AI. Switch the active
provider anytime from the picker in the AI panel header.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Launch with hot reload |
| `npm run typecheck` | `tsc` over both the node and web project references |
| `npm run build` | Production bundle via electron-vite (`out/`) |
| `npm run dist` | Build **and** package installers via electron-builder (`dist/`) |
| `npm run dist:win` / `dist:mac` / `dist:linux` | Platform-specific installers |

---

## Configuring AI providers

Nova speaks to six provider families through four normalized adapters:

| Provider | Adapter | Key needed | Notes |
|---|---|---|---|
| OpenAI | OpenAI-compatible | ✅ | `gpt-4o`, `o4-mini`, … |
| Claude (Anthropic) | Anthropic Messages | ✅ | `claude-sonnet-4-5`, … |
| Google Gemini | Gemini | ✅ | `gemini-2.5-pro`, … |
| Grok (xAI) | OpenAI-compatible | ✅ | OpenAI-shaped surface |
| DeepSeek | OpenAI-compatible | ✅ | `deepseek-chat`, `deepseek-reasoner` |
| Ollama | Ollama | ❌ | 100% local, no key |

Keys are sent once to the main process, encrypted with your OS keychain (`safeStorage`), and
stored as ciphertext in a local SQLite file. **They are never returned to the UI and never leave
your machine except in the API calls you make.**

---

## Security model

- **Untrusted web content is sandboxed** — web tabs run with `nodeIntegration: false`,
  `contextIsolation: true`, `sandbox: true`. Remote pages get zero Node access.
- **One narrow bridge.** The renderer reaches the main process only through the typed
  `window.nova` surface defined in the preload — never raw IPC.
- **Confirmation gate.** The agent must pause for explicit approval before any action it marks
  sensitive; a safety backstop also force-flags logins/purchases the model forgets to mark.
- **Secrets at rest** are encrypted via the OS keychain, never written in plaintext.

---

## Status & validation notes

This is a green-field v0.1 authored as a cohesive, strictly-typed codebase (TypeScript `strict`,
`noUnusedLocals`/`noUnusedParameters` on). Run `npm run typecheck` and `npm run build` after
`npm install` to validate the toolchain end-to-end in your environment.

*Nova is a technology foundation intended to grow into a commercial product. See the roadmap for
the path from Genesis to 1.0.*
