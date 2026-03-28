import type { StoreApi } from 'zustand'
import type { Router } from '@tanstack/react-router'
import type { NavigationItem, SlotMap, SlotMapOf } from '@tanstack-react-modules/core'

/**
 * Configuration for creating a registry.
 * Separates zustand stores (reactive) from plain services (non-reactive).
 */
export interface RegistryConfig<
  TSharedDependencies extends Record<string, any>,
  TSlots extends SlotMapOf<TSlots> = SlotMap,
> {
  /** Zustand stores — keys must match TSharedDependencies keys */
  stores?: {
    [K in keyof TSharedDependencies]?: StoreApi<TSharedDependencies[K]>
  }

  /** Plain services (non-reactive) — keys must match TSharedDependencies keys */
  services?: {
    [K in keyof TSharedDependencies]?: TSharedDependencies[K]
  }

  /**
   * Default slot values. Every key defined here is guaranteed to exist
   * in the resolved slots manifest, even if no module contributes to it.
   * Module contributions are appended to these defaults.
   */
  slots?: { [K in keyof TSlots]?: TSlots[K] }
}

export interface NavigationGroup {
  readonly group: string
  readonly items: readonly NavigationItem[]
}

export interface NavigationManifest {
  /** All navigation items flat */
  readonly items: readonly NavigationItem[]
  /** Items grouped by their group key, sorted by order within each group */
  readonly groups: readonly NavigationGroup[]
  /** Ungrouped items (no group key) */
  readonly ungrouped: readonly NavigationItem[]
}

/**
 * A summary of a registered module exposed to the shell.
 * Includes the module's identity, metadata, and optional component.
 */
export interface ModuleEntry {
  /** Unique module identifier */
  readonly id: string
  /** SemVer version string */
  readonly version: string
  /** Catalog metadata (description, icon, category, etc.) */
  readonly meta?: Readonly<Record<string, unknown>>
  /** A React component the shell can render outside of routes */
  readonly component?: React.ComponentType<any>
  /** Zone components contributed when this module is active in a workspace tab */
  readonly zones?: Readonly<Record<string, React.ComponentType<any>>>
}

export interface ApplicationManifest<
  TSharedDependencies extends Record<string, any> = Record<string, any>,
  TSlots extends SlotMapOf<TSlots> = SlotMap,
> {
  /** The root React component with all providers wired */
  readonly App: React.ComponentType
  /** The TanStack Router instance */
  readonly router: Router<any, any, any>
  /** Auto-generated navigation manifest from all modules */
  readonly navigation: NavigationManifest
  /** Collected slot contributions from all modules */
  readonly slots: TSlots
  /** Registered module summaries — use useModules() to access in components */
  readonly modules: readonly ModuleEntry[]
}
