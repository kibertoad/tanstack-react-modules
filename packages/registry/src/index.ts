// Registry
export { createRegistry } from './registry.js'
export type { ReactiveRegistry, ResolveOptions } from './registry.js'

// Types
export type {
  RegistryConfig,
  NavigationGroup,
  NavigationManifest,
  ApplicationManifest,
} from './types.js'

// Navigation
export { useNavigation } from './navigation-context.js'

// Slots
export { useSlots, SlotsContext } from './slots-context.js'

// Error boundary (for custom usage)
export { ModuleErrorBoundary } from './error-boundary.js'
