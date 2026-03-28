// Types
export type {
  ReactiveModuleDescriptor,
  LazyModuleDescriptor,
  NavigationItem,
  ModuleLifecycle,
  SlotMap,
  SlotMapOf,
  ZoneMap,
  ZoneMapOf,
} from "./types.js";

// Module definition
export { defineModule } from "./define-module.js";

// Shared dependencies context + hooks
export { SharedDependenciesContext, createSharedHooks } from "./context.js";

// Scoped stores
export { createScopedStore } from "./scoped-store.js";
export type { ScopedStore } from "./scoped-store.js";
