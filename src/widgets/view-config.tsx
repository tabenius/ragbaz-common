/**
 * ViewConfig — Hierarchical view configuration for admin UI widgets.
 * 
 * Provides context-based inheritance for detail levels and aspect visibility
 * across nested React Flow nodes and container components.
 * 
 * Used by: rebekah, dash, shambala, kanban projections
 */

import React, { createContext, useContext, useMemo, ReactNode } from 'react';

export type DetailLevel = 'terse' | 'normal' | 'verbose';

export type AspectKey = 
  | 'transport' 
  | 'schemas' 
  | 'security' 
  | 'git' 
  | 'observability'
  | 'evidence'
  | 'review'
  | 'handoff';

export interface ViewConfig {
  detail: DetailLevel;
  aspects: AspectKey[];
  /** True when neither detail nor aspects is locally overridden; not authority. */
  inherited?: boolean;
}

export interface ViewConfigOverride {
  detail?: DetailLevel;
  aspects?: AspectKey[];
}

/** Default configuration for root-level contexts */
export const DEFAULT_VIEW_CONFIG: ViewConfig = {
  detail: 'terse',
  aspects: ['transport'],
  inherited: true,
};

/** Context for ViewConfig propagation through the component tree */
export const ViewConfigContext = createContext<ViewConfig>(DEFAULT_VIEW_CONFIG);

/**
 * Hook to consume the current ViewConfig from context.
 * Returns the effective config (inherited or explicit).
 */
export function useViewConfig(): ViewConfig {
  return useContext(ViewConfigContext);
}

/**
 * Hook to get a derived ViewConfig with optional overrides.
 * Merges overrides with the current context config.
 */
export function useDerivedViewConfig(overrides: ViewConfigOverride = {}): ViewConfig {
  const parentConfig = useViewConfig();
  return useMemo(() => ({
    detail: overrides.detail ?? parentConfig.detail,
    aspects: overrides.aspects ?? parentConfig.aspects,
    inherited: 'inherited' in overrides ? Boolean(overrides.inherited) : overrides.detail === undefined && overrides.aspects === undefined,
  }), [parentConfig, overrides.detail, overrides.aspects]);
}

/**
 * Provider component that sets a new ViewConfig context.
 * Merges with parent context unless `force` is true.
 */
export function ViewConfigProvider({
  children,
  config,
  merge = true,
}: {
  children: ReactNode;
  config: Partial<ViewConfig>;
  merge?: boolean;
}) {
  const parentConfig = useViewConfig();
  
  const effectiveConfig = useMemo(() => {
    if (!merge) {
      return { ...DEFAULT_VIEW_CONFIG, ...config, inherited: false };
    }
    return {
      detail: config.detail ?? parentConfig.detail,
      aspects: config.aspects ?? parentConfig.aspects,
      inherited: config.inherited ?? false,
    };
  }, [parentConfig, config, merge]);

  return (
    <ViewConfigContext.Provider value={effectiveConfig}>
      {children}
    </ViewConfigContext.Provider>
  );
}

/**
 * Helper to create a ViewConfig with only the specified aspects enabled.
 */
export function withAspects(config: ViewConfig, aspects: AspectKey[]): ViewConfig {
  return { ...config, aspects, inherited: false };
}

/**
 * Helper to create a ViewConfig with a specific detail level.
 */
export function withDetail(config: ViewConfig, detail: DetailLevel): ViewConfig {
  return { ...config, detail, inherited: false };
}

/**
 * Check if an aspect is enabled in the current view config.
 */
export function hasAspect(config: ViewConfig, aspect: AspectKey): boolean {
  return config.aspects.includes(aspect);
}

/**
 * Get CSS class suffix based on detail level.
 */
export function detailClass(config: ViewConfig): string {
  switch (config.detail) {
    case 'terse': return 'detail-terse';
    case 'normal': return 'detail-normal';
    case 'verbose': return 'detail-verbose';
  }
}

/**
 * Get width class based on detail level.
 */
export function detailWidth(config: ViewConfig): string {
  switch (config.detail) {
    case 'terse': return 'w-48';
    case 'normal': return 'w-64';
    case 'verbose': return 'w-96';
  }
}
