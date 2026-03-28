import { RouterProvider } from '@tanstack/react-router'
import type { Router } from '@tanstack/react-router'
import type { StoreApi } from 'zustand'
import { SharedDependenciesContext } from '@tanstack-react-modules/core'
import { NavigationContext } from './navigation-context.js'
import { SlotsContext } from './slots-context.js'
import { ModulesContext } from './modules-context.js'
import type { NavigationManifest, ModuleEntry } from './types.js'

interface AppProps {
  router: Router<any, any, any>
  stores: Record<string, StoreApi<unknown>>
  services: Record<string, unknown>
  navigation: NavigationManifest
  slots: object
  modules: readonly ModuleEntry[]
  providers?: React.ComponentType<{ children: React.ReactNode }>[]
}

export function createAppComponent({
  router,
  stores,
  services,
  navigation,
  slots,
  modules,
  providers,
}: AppProps) {
  function App() {
    let tree: React.ReactNode = (
      <SharedDependenciesContext value={{ stores, services }}>
        <NavigationContext value={navigation}>
          <SlotsContext value={slots}>
            <ModulesContext value={modules}>
              <RouterProvider router={router} />
            </ModulesContext>
          </SlotsContext>
        </NavigationContext>
      </SharedDependenciesContext>
    )

    // Wrap with user-supplied providers (first element = outermost wrapper)
    if (providers) {
      for (const Provider of [...providers].reverse()) {
        tree = <Provider>{tree}</Provider>
      }
    }

    return tree
  }

  App.displayName = 'ReactiveApp'
  return App
}
