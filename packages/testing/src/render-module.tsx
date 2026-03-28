import { render } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import {
  createMemoryHistory,
  createRouter,
  createRootRoute,
} from '@tanstack/react-router'
import { SharedDependenciesContext } from '@reactive/core'
import type { ReactiveModuleDescriptor } from '@reactive/core'
import { RouterProvider } from '@tanstack/react-router'
import type { StoreApi } from 'zustand'

export interface RenderModuleOptions<
  TSharedDependencies extends Record<string, any>,
> {
  /** Initial route to navigate to */
  route?: string

  /**
   * Shared dependencies to provide.
   * Keys that are StoreApi instances go into stores, others into services.
   */
  deps: Partial<{
    [K in keyof TSharedDependencies]:
      | StoreApi<TSharedDependencies[K]>
      | TSharedDependencies[K]
  }>

}

function isStoreApi(value: unknown): value is StoreApi<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'getState' in value &&
    'setState' in value &&
    'subscribe' in value
  )
}

/**
 * Renders a reactive module in isolation for testing.
 *
 * @example
 * const result = await renderModule(billingModule, {
 *   route: '/billing',
 *   deps: {
 *     auth: createMockStore<AuthStore>({ user: testUser, isAuthenticated: true }),
 *     api: { get: vi.fn(), post: vi.fn() },
 *   },
 * })
 */
export async function renderModule<
  TSharedDependencies extends Record<string, any>,
>(
  module: ReactiveModuleDescriptor<TSharedDependencies>,
  options: RenderModuleOptions<TSharedDependencies>,
): Promise<RenderResult> {
  const stores: Record<string, StoreApi<unknown>> = {}
  const services: Record<string, unknown> = {}

  // Separate stores from plain services
  for (const [key, value] of Object.entries(options.deps)) {
    if (isStoreApi(value)) {
      stores[key] = value
    } else {
      services[key] = value
    }
  }

  // Build route tree for this module
  const rootRoute = createRootRoute({})
  const moduleRoutes = module.createRoutes(rootRoute)
  const routeTree = rootRoute.addChildren([moduleRoutes])

  const memoryHistory = createMemoryHistory({
    initialEntries: [options.route ?? '/'],
  })

  const router = createRouter({
    routeTree,
    history: memoryHistory,
  })

  // Wait for the router to be ready
  await router.load()

  const result = render(
    <SharedDependenciesContext value={{ stores, services }}>
      <RouterProvider router={router} />
    </SharedDependenciesContext>,
  )

  return result
}
