export type ClipboardWriter = Pick<Clipboard, 'writeText'>;
export type CopyTextResult = { ok: true } | { ok: false; reason: 'unavailable' | 'denied' };
export type StateTone = 'neutral' | 'active' | 'warning' | 'danger' | 'success';

export function copyText(value: string, clipboard?: ClipboardWriter | null): Promise<CopyTextResult>;
export function stateTone(state: string): StateTone;
export function restoreFocus(
  target: HTMLElement | { current: HTMLElement | null } | null | undefined,
  fallback?: HTMLElement | null,
): boolean;
export function focusAndReveal(selector: string, root?: ParentNode | Document | null): boolean;
export function shouldAutoHideChrome(args: {
  current: number;
  previous: number;
  threshold?: number;
  grace?: number;
  minScroll?: number;
  pointerInside?: boolean;
  focusInside?: boolean;
  menusOpen?: number;
}): boolean | undefined;

export type TabItem = {
  id: string;
  tab: HTMLElement;
  panel?: HTMLElement | null;
  disabled?: boolean;
  hidden?: () => boolean;
};
export type TabsController = {
  readonly value: string | undefined;
  select(id: string, focus?: boolean): void;
  destroy(): void;
};
export function createTabs(options: {
  items: TabItem[];
  initial?: string;
  onSelect?: (id: string) => void;
  setPanel?: (item: TabItem, selected: boolean) => void;
  vim?: boolean;
}): TabsController;

export type PopoverControllerOptions = {
  trigger: HTMLElement;
  panel: HTMLElement;
  label?: string;
  closeOnSelect?: boolean | ((el: HTMLElement) => boolean);
  restoreFocus?: boolean | HTMLElement | { current: HTMLElement | null };
  onOpenChange?: (open: boolean) => void;
};
export type PopoverController = {
  readonly isOpen: boolean;
  open(): void;
  close(): void;
  toggle(): void;
  destroy(): void;
};
export function createPopoverController(options: PopoverControllerOptions): PopoverController;
