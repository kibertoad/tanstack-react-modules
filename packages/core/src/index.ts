// Types
export type {
  ReactiveModuleDescriptor,
  LazyModuleDescriptor,
  NavigationItem,
  ModuleLifecycle,
} from './types.js'

// Module definition
export { defineModule } from './define-module.js'

// Shared dependencies context + hooks
export {
  SharedDependenciesContext,
  createSharedHooks,
} from './context.js'

