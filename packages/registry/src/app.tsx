import { RouterProvider } from '@tanstack/react-router'
import type { Router } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { StoreApi } from 'zustand'
import { SharedDependenciesContext } from '@reactive/core'
import { NavigationContext } from './navigation-context.js'
import type { NavigationManifest } from './types.js'

interface AppProps {
  router: Router<any, any, any>
  queryClient: QueryClient
  stores: Record<string, StoreApi<unknown>>
  services: Record<string, unknown>
  navigation: NavigationManifest
}

export function createAppComponent({ router, queryClient, stores, services, navigation }: AppProps) {
  function App() {
    return (
      <QueryClientProvider client={queryClient}>
        <SharedDependenciesContext value={{ stores, services }}>
          <NavigationContext value={navigation}>
            <RouterProvider router={router} />
          </NavigationContext>
        </SharedDependenciesContext>
      </QueryClientProvider>
    )
  }

  App.displayName = 'ReactiveApp'
  return App
}
