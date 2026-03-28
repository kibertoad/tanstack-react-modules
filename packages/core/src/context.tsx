import { createContext, useContext } from 'react'
import { useStore as useZustandStore } from 'zustand'
import type { StoreApi } from 'zustand'

/**
 * Internal context that holds the resolved shared dependencies.
 * The registry's App component provides this at the root.
 */

interface SharedDependenciesContextValue {
  stores: Record<string, StoreApi<unknown>>
  services: Record<string, unknown>
}

export const SharedDependenciesContext =
  createContext<SharedDependenciesContextValue | null>(null)

function useSharedDependencies(): SharedDependenciesContextValue {
  const ctx = useContext(SharedDependenciesContext)
  if (!ctx) {
    throw new Error(
      '[@tanstack-react-modules/core] useStore/useService must be used within a <ReactiveApp />. ' +
        'Make sure your component is rendered inside the App returned by registry.resolve().',
    )
  }
  return ctx
}

/**
 * Creates typed hooks for accessing shared dependencies.
 * Call this once in your app-shared package, then use the returned hooks everywhere.
 *
 * @example
 * // In @myorg/app-shared:
 * import { createSharedHooks } from '@tanstack-react-modules/core'
 * import type { AppDependencies } from '@myorg/app-shared'
 *
 * export const { useStore, useService } = createSharedHooks<AppDependencies>()
 *
 * // In any module component:
 * import { useStore, useService } from '@myorg/app-shared'
 *
 * const user = useStore('auth', (s) => s.user)   // fully typed!
 * const api = useService('api')                    // fully typed!
 */
export function createSharedHooks<TSharedDependencies extends Record<string, any>>() {
  function useStore<K extends keyof TSharedDependencies & string>(
    key: K,
  ): TSharedDependencies[K]
  function useStore<K extends keyof TSharedDependencies & string, U>(
    key: K,
    selector: (state: TSharedDependencies[K]) => U,
  ): U
  function useStore<K extends keyof TSharedDependencies & string>(
    key: K,
    selector?: (state: any) => unknown,
  ): unknown {
    const { stores } = useSharedDependencies()
    const store = stores[key]
    if (!store) {
      throw new Error(
        `[@tanstack-react-modules/core] Store "${key}" is not registered. ` +
          `Available stores: ${Object.keys(stores).join(', ') || '(none)'}`,
      )
    }

    if (selector) {
      return useZustandStore(store, selector)
    }
    return useZustandStore(store)
  }

  function useService<K extends keyof TSharedDependencies & string>(
    key: K,
  ): TSharedDependencies[K] {
    const { services } = useSharedDependencies()
    const service = services[key]
    if (!service) {
      throw new Error(
        `[@tanstack-react-modules/core] Service "${key}" is not registered. ` +
          `Available services: ${Object.keys(services).join(', ') || '(none)'}`,
      )
    }
    return service as TSharedDependencies[K]
  }

  return { useStore, useService }
}
