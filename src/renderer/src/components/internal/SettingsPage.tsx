/**
 * SettingsPage — configure AI providers (keys, model, active), general browser
 * preferences, and safety. This is where the "multi-AI support" promise is made
 * concrete: every provider is listed with a key field and model picker, and the
 * active one is switched with a click. Keys are sent to the main process, which
 * encrypts them via the OS keychain — they never round-trip back to the UI.
 */
import { useEffect, useState } from 'react'
import { Check, Key, ExternalLink } from 'lucide-react'
import type { NovaSettings, ProviderConfig, ProviderId } from '@shared/types'
import { PROVIDER_CATALOG } from '@shared/providers'
import { useStore } from '../../state/store'
import { PageShell } from './PageShell'

function ProviderCard({
  provider,
  isActive,
  onChanged
}: {
  provider: ProviderConfig
  isActive: boolean
  onChanged: () => void
}): JSX.Element {
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState(false)
  const catalog = PROVIDER_CATALOG[provider.id]

  const saveKey = async () => {
    if (!key.trim()) return
    await window.nova.ai.setKey(provider.id, key.trim())
    setKey('')
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    onChanged()
  }

  const setModel = async (model: string) => {
    await window.nova.ai.setModel(provider.id, model)
    onChanged()
  }

  const makeActive = async () => {
    await window.nova.ai.setActiveProvider(provider.id)
    onChanged()
  }

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        isActive ? 'border-nova/40 bg-nova/[0.06]' : 'border-white/6 bg-white/[0.02]'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={`h-2 w-2 rounded-full ${provider.configured ? 'bg-accent-mint' : 'bg-accent-amber'}`}
          />
          <span className="text-sm font-semibold text-ink">{provider.label}</span>
          {isActive && (
            <span className="rounded-md bg-nova/25 px-1.5 py-0.5 text-[10px] font-medium text-nova-soft">
              Active
            </span>
          )}
        </div>
        {!isActive && (
          <button
            onClick={makeActive}
            disabled={!provider.configured}
            className="rounded-lg bg-white/8 px-2.5 py-1 text-xs text-ink-soft transition-colors hover:bg-white/12 hover:text-ink disabled:opacity-30"
          >
            Use
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {provider.requiresKey ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-surface-2/60 px-2.5">
            <Key size={13} className="text-ink-faint" />
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void saveKey()}
              placeholder={provider.configured ? '•••••••• (saved)' : 'Paste API key'}
              className="min-w-0 flex-1 bg-transparent py-2 text-xs text-ink placeholder:text-ink-faint focus:outline-none"
            />
            <button
              onClick={saveKey}
              className="shrink-0 text-ink-faint transition-colors hover:text-ink"
              title="Save key"
            >
              {saved ? <Check size={14} className="text-accent-mint" /> : 'Save'}
            </button>
          </div>
        ) : (
          <div className="flex items-center rounded-lg border border-white/8 bg-surface-2/40 px-2.5 py-2 text-xs text-ink-faint">
            Local — no API key needed
          </div>
        )}

        <select
          value={provider.activeModel}
          onChange={(e) => void setModel(e.target.value)}
          className="rounded-lg border border-white/8 bg-surface-2/60 px-2.5 py-2 text-xs text-ink focus:outline-none focus-ring"
        >
          {provider.models.map((m) => (
            <option key={m} value={m} className="bg-surface-2">
              {m}
            </option>
          ))}
        </select>
      </div>

      <a
        href={catalog.docsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-[11px] text-ink-faint hover:text-nova-soft"
      >
        Get a key <ExternalLink size={10} />
      </a>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  description
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description: string
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3">
      <div>
        <div className="text-sm text-ink">{label}</div>
        <div className="text-xs text-ink-soft">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-nova' : 'bg-white/12'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

export function SettingsPage(): JSX.Element {
  const providers = useStore((s) => s.providers)
  const settings = useStore((s) => s.settings)
  const setProviders = useStore((s) => s.setProviders)
  const setSettings = useStore((s) => s.setSettings)

  const refresh = async () => {
    const [p, s] = await Promise.all([window.nova.ai.listProviders(), window.nova.settings.get()])
    setProviders(p)
    setSettings(s)
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patch = async (p: Partial<NovaSettings>) => {
    const next = await window.nova.settings.set(p)
    setSettings(next)
  }

  if (!settings) return <PageShell title="Settings">{null}</PageShell>

  return (
    <PageShell title="Settings" description="Providers, preferences, and safety.">
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">
          AI Providers
        </h2>
        <div className="space-y-2.5">
          {providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              isActive={settings.activeProvider === (p.id as ProviderId)}
              onChanged={refresh}
            />
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">General</h2>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3">
            <div className="mb-1 text-xs text-ink-soft">Default search engine</div>
            <select
              value={settings.searchEngine}
              onChange={(e) => void patch({ searchEngine: e.target.value as NovaSettings['searchEngine'] })}
              className="w-full bg-transparent text-sm text-ink focus:outline-none"
            >
              <option value="google" className="bg-surface-2">Google</option>
              <option value="bing" className="bg-surface-2">Bing</option>
              <option value="duckduckgo" className="bg-surface-2">DuckDuckGo</option>
            </select>
          </label>
          <label className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3">
            <div className="mb-1 text-xs text-ink-soft">Language</div>
            <input
              value={settings.language}
              onChange={(e) => void patch({ language: e.target.value })}
              className="w-full bg-transparent text-sm text-ink focus:outline-none"
            />
          </label>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">Safety</h2>
        <Toggle
          checked={settings.confirmSensitiveActions}
          onChange={(v) => void patch({ confirmSensitiveActions: v })}
          label="Confirm sensitive actions"
          description="Require approval before the agent logs in, submits forms, or makes purchases."
        />
      </section>
    </PageShell>
  )
}
