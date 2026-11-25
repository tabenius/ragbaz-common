export type WebScope = 'native' | 'tabs' | 'records' | 'shortcut';
export type WebBinding = {
  keys: readonly string[];
  action: string;
  scope: WebScope;
  description: string;
};
export const WEB_BINDINGS: readonly WebBinding[];
export function resolveWebKey(key: string, scope: 'tabs' | 'shortcut' | 'records'): string | undefined;
export function webTabIndex(key: string, index: number, count: number, vim?: boolean): number | null;
export function webRecordIndex(key: string, index: number, count: number, vim?: boolean): number | null;
export interface RecordBounds { left: number; top: number; width: number; height: number }
export function spatialRecordIndex(key: string, index: number, boxes: RecordBounds[], vim?: boolean): number | null;
export function isEditingTarget(target: EventTarget | null): boolean;
