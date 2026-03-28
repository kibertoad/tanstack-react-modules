import { createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import type { StoreApi } from 'zustand'
import type { ReactiveModuleDescriptor, LazyModuleDescriptor } from '@reactive/core'
import type { RegistryConfig, ApplicationManifest, NavigationManifest } from './types.js'
import { validateNoDuplicateIds, validateDependencies } from './validation.js'
import { buildNavigationManifest } from './navigation.js'
import { buildRouteTree, type RouteBuilderOptions } from './route-builder.js'
import { createAppComponent } from './app.js'

export interface ReactiveRegistry<
  TSharedDependencies extends Record<string, any>,
> {
  /** Register an eager module */
  register(module: ReactiveModuleDescriptor<TSharedDependencies>): void

  /** Register a lazily-loaded module */
  registerLazy(descriptor: LazyModuleDescriptor<TSharedDependencies>): void

  /**
   * Resolve all modules and produce the application manifest.
   * Validates dependencies and builds the route tree.
   */
  resolve(options?: ResolveOptions): ApplicationManifest<TSharedDependencies>
}

export interface ResolveOptions {
  /** Root layout component (renders <Outlet /> for child routes) */
  rootComponent?: () => React.JSX.Element
  /** Component for the index route (/) */
  indexComponent?: () => React.JSX.Element
  /** Component for 404 / not-found */
  notFoundComponent?: () => React.JSX.Element
}

export function createRegistry<
  TSharedDependencies extends Record<string, any>,
>(
  config: RegistryConfig<TSharedDependencies>,
): ReactiveRegistry<TSharedDependencies> {
  const modules: ReactiveModuleDescriptor<TSharedDependencies>[] = []
  const lazyModules: LazyModuleDescriptor<TSharedDependencies>[] = []
  let resolved = false

  // Collect all available dependency keys from stores and services
  const availableKeys = new Set<string>([
    ...Object.keys(config.stores ?? {}),
    ...Object.keys(config.services ?? {}),
  ])

  return {
    register(module) {
      if (resolved) {
        throw new Error(
          '[@reactive/registry] Cannot register modules after resolve() has been called.',
        )
      }
      modules.push(module)
    },

    registerLazy(descriptor) {
      if (resolved) {
        throw new Error(
          '[@reactive/registry] Cannot register modules after resolve() has been called.',
        )
      }
      lazyModules.push(descriptor)
    },

    resolve(options?: ResolveOptions) {
      if (resolved) {
        throw new Error(
          '[@reactive/registry] resolve() can only be called once.',
        )
      }
      resolved = true

      // Validate (cast is safe — these functions only read structural properties)
      const mods = modules as ReactiveModuleDescriptor[]
      const lazyMods = lazyModules as LazyModuleDescriptor[]
      validateNoDuplicateIds(mods, lazyMods)
      validateDependencies(mods, availableKeys)

      // Run onRegister lifecycle hooks
      const deps = buildDepsObject(config)
      for (const mod of modules) {
        mod.lifecycle?.onRegister?.(deps)
      }

      // Build route tree
      const routeBuilderOptions: RouteBuilderOptions = {
        rootComponent: options?.rootComponent,
        indexComponent: options?.indexComponent,
        notFoundComponent: options?.notFoundComponent,
      }
      const routeTree = buildRouteTree(mods, lazyMods, routeBuilderOptions)

      // Create TanStack Router instance
      const router = createRouter({
        routeTree,
        defaultPreload: 'intent',
      })

      // Build navigation
      const navigation: NavigationManifest = buildNavigationManifest(mods)

      // Build stores and services maps for the context
      const stores: Record<string, StoreApi<unknown>> = {}
      const services: Record<string, unknown> = {}

      if (config.stores) {
        for (const [key, store] of Object.entries(config.stores)) {
          if (store) stores[key] = store as StoreApi<unknown>
        }
      }
      if (config.services) {
        for (const [key, service] of Object.entries(config.services)) {
          if (service !== undefined) services[key] = service
        }
      }

      // Create QueryClient
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
          },
        },
      })

      // Create App component
      const App = createAppComponent({ router, queryClient, stores, services, navigation })

      return { App, router, queryClient, navigation }
    },
  }
}

function buildDepsObject<TSharedDependencies extends Record<string, any>>(
  config: RegistryConfig<TSharedDependencies>,
): TSharedDependencies {
  const deps: Record<string, unknown> = {}

  // For stores, get current state as the deps value
  // (lifecycle hooks get a snapshot, components use useStore for reactivity)
  if (config.stores) {
    for (const [key, store] of Object.entries(config.stores)) {
      if (store) {
        deps[key] = (store as StoreApi<unknown>).getState()
      }
    }
  }
  if (config.services) {
    for (const [key, service] of Object.entries(config.services)) {
      if (service !== undefined) deps[key] = service
    }
  }

  return deps as TSharedDependencies
}
