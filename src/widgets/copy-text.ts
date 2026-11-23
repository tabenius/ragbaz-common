/** The smallest clipboard surface a widget needs, injectable for tests and SSR. */
export type ClipboardWriter = Pick<Clipboard, 'writeText'>

export type CopyTextResult = { ok: true } | { ok: false; reason: 'unavailable' | 'denied' }

/**
 * Copy an exact string to the clipboard. The value is never executed, parsed or
 * logged; failure is reported so a host can offer manual selection instead.
 */
export async function copyText(value: string, clipboard?: ClipboardWriter | null): Promise<CopyTextResult> {
  const target = clipboard === undefined ? (globalThis.navigator?.clipboard as ClipboardWriter | undefined) : clipboard
  if (!target || typeof target.writeText !== 'function') return { ok: false, reason: 'unavailable' }
  try {
    await target.writeText(value)
    return { ok: true }
  } catch {
    return { ok: false, reason: 'denied' }
  }
}
