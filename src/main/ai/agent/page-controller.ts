/**
 * PageController — the agent's hands and eyes inside a live web page.
 *
 * The functions here return JavaScript source strings that the AgentRunner
 * evaluates inside the target tab via `webContents.executeJavaScript`. We ship
 * one install script that defines a `window.__nova` helper (element indexing,
 * readable-text extraction, action primitives), then call small expressions
 * against it each step.
 *
 * Design notes:
 *   - Elements are assigned stable numeric labels for the current snapshot and
 *     tracked in a Weak-ish registry (an array) so the model can say "click 12".
 *   - We surface only *interactive, visible* elements to keep the model's
 *     context small and its choices unambiguous.
 *   - Everything is defensive: pages are hostile, scripts get re-injected on
 *     navigation, and we never assume an element still exists.
 */

/**
 * The install script. Idempotent: re-running it refreshes the helper without
 * clobbering state. Injected after every navigation/step.
 */
export const INSTALL_SCRIPT = `
(function () {
  if (window.__nova && window.__nova.__v === 1) return 'already';
  const nova = {
    __v: 1,
    registry: [],

    isVisible(el) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') return false;
      // Must intersect the viewport (with a small margin).
      return r.bottom > -50 && r.top < (innerHeight + 50) && r.right > 0 && r.left < innerWidth;
    },

    label(el) {
      const tag = el.tagName.toLowerCase();
      const aria = el.getAttribute('aria-label');
      const text = (el.innerText || el.value || el.placeholder || aria || el.getAttribute('title') || '').trim().replace(/\\s+/g, ' ').slice(0, 80);
      const role = el.getAttribute('role') || '';
      let kind = tag;
      if (tag === 'input') kind = 'input:' + (el.getAttribute('type') || 'text');
      else if (tag === 'a') kind = 'link';
      else if (role) kind = role;
      return { kind, text };
    },

    /** Re-scan the DOM, assign numeric labels, return a compact element list. */
    snapshot() {
      this.registry = [];
      const sel = 'a, button, input, textarea, select, [role=button], [role=link], [role=tab], [role=menuitem], [onclick], [contenteditable=true]';
      const nodes = Array.from(document.querySelectorAll(sel));
      const out = [];
      for (const el of nodes) {
        if (!this.isVisible(el)) continue;
        if (el.disabled) continue;
        const idx = this.registry.length;
        this.registry.push(el);
        const { kind, text } = this.label(el);
        out.push('[' + idx + '] ' + kind + (text ? ' "' + text + '"' : ''));
        if (out.length >= 120) break; // cap context size
      }
      return out.join('\\n');
    },

    /** Extract readable text, reader-mode style: strip nav/script/style noise. */
    readable() {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('script,style,noscript,svg,nav,footer,header,aside,[aria-hidden=true]').forEach(n => n.remove());
      const text = (clone.innerText || '').replace(/\\n{3,}/g, '\\n\\n').trim();
      return text.slice(0, 20000);
    },

    _el(i) {
      const el = this.registry[i];
      if (!el) throw new Error('No element #' + i + ' (page may have changed; re-snapshot)');
      return el;
    },

    click(i) {
      const el = this._el(i);
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      el.click();
      return 'clicked [' + i + ']';
    },

    type(i, value) {
      const el = this._el(i);
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      el.focus();
      if (el.isContentEditable) {
        el.textContent = value;
      } else {
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, value);
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return 'typed into [' + i + ']';
    },

    select(i, value) {
      const el = this._el(i);
      el.focus();
      const opts = Array.from(el.options || []);
      const match = opts.find(o => o.value === value || o.text.trim() === value) || opts.find(o => o.text.toLowerCase().includes(String(value).toLowerCase()));
      if (!match) throw new Error('No option "' + value + '" in [' + i + ']');
      el.value = match.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return 'selected "' + match.text.trim() + '"';
    },

    scroll(dir) {
      const step = Math.round(innerHeight * 0.85);
      if (dir === 'top') scrollTo({ top: 0 });
      else if (dir === 'bottom') scrollTo({ top: document.body.scrollHeight });
      else if (dir === 'up') scrollBy({ top: -step });
      else scrollBy({ top: step });
      return 'scrolled ' + dir;
    },

    meta() {
      return { url: location.href, title: document.title, selection: String(getSelection() || '') };
    }
  };
  window.__nova = nova;
  return 'installed';
})();
`

/** JS expression that returns a fresh element snapshot string. */
export const SNAPSHOT_EXPR = 'window.__nova.snapshot()'

/** JS expression that returns readable page text. */
export const READABLE_EXPR = 'window.__nova.readable()'

/** JS expression that returns { url, title, selection }. */
export const META_EXPR = 'window.__nova.meta()'

/** Build the JS expression for a click action. */
export function clickExpr(index: number): string {
  return `window.__nova.click(${JSON.stringify(index)})`
}

/** Build the JS expression for a type action. */
export function typeExpr(index: number, value: string): string {
  return `window.__nova.type(${JSON.stringify(index)}, ${JSON.stringify(value)})`
}

/** Build the JS expression for a select action. */
export function selectExpr(index: number, value: string): string {
  return `window.__nova.select(${JSON.stringify(index)}, ${JSON.stringify(value)})`
}

/** Build the JS expression for a scroll action. */
export function scrollExpr(direction: string): string {
  return `window.__nova.scroll(${JSON.stringify(direction)})`
}
