import React, { useCallback, useEffect, useRef, useState } from 'react';
import { WidgetIcon } from './visual-language';

/** A steady visual bell; optional quiet audio only following a handled user key. */
export function useNavigationFeedback(audible = false) {
  const [failure, setFailure] = useState<{ message: string; count: number } | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const lastSound = useRef(0);
  useEffect(() => {
    if (!audible && audio.current) { const previous = audio.current; audio.current = null; void previous.close().catch(() => {}); }
  }, [audible]);
  useEffect(() => () => { void audio.current?.close().catch(() => {}); }, []);
  const notify = useCallback((message: string) => {
    setFailure(previous => ({ message, count: (previous?.count ?? 0) + 1 }));
    if (!audible || Date.now() - lastSound.current < 250) return;
    lastSound.current = Date.now();
    try {
      audio.current ??= new AudioContext();
      const context = audio.current;
      void context.resume().then(() => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 440;
        gain.gain.setValueAtTime(.025, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .07);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(); oscillator.stop(context.currentTime + .08);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      }).catch(() => {});
    } catch { /* Audio unsupported or blocked: visual feedback remains authoritative. */ }
  }, [audible]);
  return { failure, notify, clear: () => setFailure(null) };
}

export function NavigationFeedback({ failure, onDismiss }: { failure: { message: string; count: number } | null; onDismiss: () => void }) {
  return <div role="status" aria-live="polite" aria-atomic="true">{failure && <div className="ragbaz-navigation-feedback"><WidgetIcon name="issue" /><span>Navigation unavailable: {failure.message}<span className="ragbaz-feedback-count"> · attempt {failure.count}</span></span><button type="button" onClick={onDismiss}>Dismiss</button></div>}</div>;
}
