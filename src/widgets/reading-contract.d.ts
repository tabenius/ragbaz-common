export type ReadingBinding = {
  readonly keys: readonly string[];
  readonly label: string;
  readonly action: string;
};
export const READING_BINDINGS: readonly ReadingBinding[];
export function readingKeyLabel(key: string): string;
export function resolveReadingAction(key: string): string | undefined;
