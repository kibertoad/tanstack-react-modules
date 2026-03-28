# Reactive

Plug-and-play modular framework for React. Build frontend features as independent npm packages, compose them into a running application via a typed module registry.

**Stack:** React 19 (React Compiler) + TanStack Router + Vite 8 + Zustand + React Query + Lokalise HTTP Client

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
- [The App-Shared Package](#the-app-shared-package)
- [Creating a Module](#creating-a-module)
- [Defining API Contracts](#defining-api-contracts)
- [Fetching Data with React Query](#fetching-data-with-react-query)
- [Shared Dependencies (DI)](#shared-dependencies-di)
- [The Shell (Host App)](#the-shell-host-app)
- [Navigation](#navigation)
- [Cross-Module Communication](#cross-module-communication)
- [React Compiler](#react-compiler)
- [Testing Modules](#testing-modules)
- [Lazy Loading Modules](#lazy-loading-modules)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Shell (Host App)                                       │
│  - Creates zustand stores (auth, config)                │
│  - Creates wretch HTTP client                           │
│  - Registers modules                                    │
│  - Provides root layout                                 │
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │  @reactive/registry                                │ │
│  │  - Validates dependencies                          │ │
│  │  - Composes TanStack Router route tree             │ │
│  │  - Builds navigation manifest                      │ │
│  │  - Wires provider tree:                            │ │
│  │    QueryClientProvider                             │ │
│  │      → SharedDependenciesContext                   │ │
│  │        → NavigationContext                         │ │
│  │          → RouterProvider                          │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Billing      │  │ Users        │  │ Settings     │  │
│  │ Module       │  │ Module       │  │ Module       │  │
│  │              │  │              │  │              │  │
│  │ Routes       │  │ Routes       │  │ Routes       │  │
│  │ Pages        │  │ Pages        │  │ Pages        │  │
│  │ Navigation   │  │ Navigation   │  │ Navigation   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │  @example/app-shared                             │ │
│  │  - AppDependencies type (auth, config, httpClient) │ │
│  │  - Typed hooks: useStore(), useService()           │ │
│  │  - API contracts (zod schemas)                     │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Key principles:**

- Modules are standard npm packages. They can live in the same monorepo or be published to a registry.
- The **host app** defines what shared dependencies exist (auth, config, HTTP client). Modules consume them via typed hooks.
- The framework does not reinvent routing, state management, or data fetching. It wires together TanStack Router, Zustand, React Query, and the Lokalise HTTP client.
- **Zustand** owns client state (auth, UI, preferences). **React Query** owns server state (API data, caching, refetching).

---

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+
- pnpm

### Install and run

```bash
pnpm install
pnpm build        # Build all framework packages
pnpm dev           # Start the example shell app
```

Open http://localhost:5173. Click "Login as Demo User" to see the modules in action.

---

## The App-Shared Package

The app-shared package is the **single source of truth** for the types shared between the shell and all modules. It is a standalone npm package (e.g., `@myorg/app-shared`) that:

- Defines `AppDependencies` — the interface describing every zustand store and service the shell provides.
- Exports typed hooks (`useStore`, `useService`) created via `createSharedHooks<AppDependencies>()`.
- Contains API contracts (zod schemas) for all backend endpoints.
- Contains shared domain types (`User`, `Invoice`, etc.).

Both the shell and every module list this package as a dependency. The shell **implements** the shared interface (creates the actual stores and services). Modules **consume** it (import the types and hooks). This is what keeps everything type-safe across package boundaries.

### Distribution

The app-shared package can live in the same monorepo during development (`workspace:*`) or be published to any npm registry (npm, GitHub Packages, Artifactory) for cross-repo consumption. When published, pin a version to coordinate breaking changes:

```json
// In a module's package.json (monorepo)
"@myorg/app-shared": "workspace:*"

// In a module's package.json (published)
"@myorg/app-shared": "^2.0.0"
```

When the shell team adds a new shared dependency or changes a store shape, they bump the app-shared package version. Module teams update their dependency to pick up the new types.

### Structure

```
app-shared/
├── src/
│   ├── index.ts           # AppDependencies type + typed hooks + re-exports
│   ├── types.ts           # Shared domain types (User, Invoice, etc.)
│   └── contracts/
│       ├── invoices.ts    # Invoice API contracts (zod schemas)
│       └── users.ts       # User API contracts
└── package.json
```

### Defining AppDependencies

```typescript
// app-shared/src/index.ts
import { createSharedHooks } from '@reactive/core'
import type { Wretch } from 'wretch'

export interface AuthStore {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
}

export interface ConfigStore {
  apiBaseUrl: string
  environment: 'dev' | 'staging' | 'prod'
  appName: string
}

export interface AppDependencies {
  auth: AuthStore       // Zustand store — reactive
  config: ConfigStore   // Zustand store — reactive
  httpClient: Wretch    // Plain service — non-reactive
}

// These hooks are used by every module
export const { useStore, useService } = createSharedHooks<AppDependencies>()
```

**Rules:**

- The app-shared package is the **only** package that both the shell and modules depend on. It is the boundary between them.
- Modules import `useStore` and `useService` from this package — never from `@reactive/core` directly.
- Zustand store types go in `AppDependencies` for reactive state. Non-reactive services (HTTP client, loggers) also go in `AppDependencies`.
- The shell must provide implementations for every key in `AppDependencies`. The registry validates this at `resolve()` time against each module's `requires` list.
- Keep this package lightweight. It should contain only types, hooks, zod schemas, and domain types — no React components, no business logic.

---

## Creating a Module

A module is an npm package that exports a `ReactiveModuleDescriptor` via `defineModule()`.

### Package structure

```
modules/billing/
├── src/
│   ├── index.ts              # Module descriptor (entry point)
│   └── pages/
│       ├── BillingDashboard.tsx
│       ├── InvoiceList.tsx
│       └── InvoiceDetail.tsx
├── package.json
└── tsconfig.json
```

### Module descriptor

```typescript
// modules/billing/src/index.ts
import { defineModule } from '@reactive/core'
import { createRoute, lazyRouteComponent } from '@tanstack/react-router'
import type { AppDependencies } from '@example/app-shared'

export default defineModule<AppDependencies>({
  id: 'billing',
  version: '0.1.0',

  createRoutes: (parentRoute) => {
    const billingRoot = createRoute({
      getParentRoute: () => parentRoute,
      path: 'billing',
    })

    const billingIndex = createRoute({
      getParentRoute: () => billingRoot,
      path: '/',
      component: lazyRouteComponent(() => import('./pages/BillingDashboard.js')),
    })

    const invoiceList = createRoute({
      getParentRoute: () => billingRoot,
      path: 'invoices',
      component: lazyRouteComponent(() => import('./pages/InvoiceList.js')),
    })

    const invoiceDetail = createRoute({
      getParentRoute: () => billingRoot,
      path: 'invoices/$invoiceId',
      component: lazyRouteComponent(() => import('./pages/InvoiceDetail.js')),
    })

    return billingRoot.addChildren([billingIndex, invoiceList, invoiceDetail])
  },

  navigation: [
    { label: 'Billing', to: '/billing', icon: 'credit-card', group: 'finance', order: 10 },
    { label: 'Invoices', to: '/billing/invoices', group: 'finance', order: 11 },
  ],

  requires: ['auth', 'httpClient'],
})
```

### Module descriptor fields

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique string identifier. Must be unique across all registered modules. |
| `version` | Yes | SemVer version string. |
| `createRoutes` | Yes | Receives the root route as parent, returns a TanStack Router route subtree. Use `lazyRouteComponent()` for code splitting. |
| `navigation` | No | Array of `NavigationItem` entries contributed to the shell's sidebar/nav. |
| `requires` | No | Array of `AppDependencies` keys this module needs. Validated at registry resolution. |
| `lifecycle` | No | `{ onRegister, onMount, onUnmount }` hooks. |

### Writing page components

```typescript
// modules/billing/src/pages/InvoiceList.tsx
import { useStore, useService, listInvoicesContract } from '@example/app-shared'
import { sendByContract } from '@lokalise/frontend-http-client'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'

export default function InvoiceList() {
  // Reactive — re-renders when auth state changes
  const isAuthenticated = useStore('auth', (s) => s.isAuthenticated)

  // Non-reactive — stable reference
  const httpClient = useService('httpClient')

  // Server state via React Query
  const { data: invoices, isLoading, error } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => sendByContract(httpClient, listInvoicesContract, {}),
    enabled: isAuthenticated,
  })

  if (!isAuthenticated) return <p>Please log in.</p>
  if (isLoading) return <p>Loading...</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <ul>
      {invoices?.map((inv) => (
        <li key={inv.id}>
          <Link to="/billing/invoices/$invoiceId" params={{ invoiceId: inv.id }}>
            {inv.id} — ${inv.amount.toFixed(2)}
          </Link>
        </li>
      ))}
    </ul>
  )
}
```

### Module package.json

```json
{
  "name": "@example/billing-module",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@reactive/core": "workspace:*",
    "@example/app-shared": "workspace:*",
    "@lokalise/frontend-http-client": "^7.0.0"
  },
  "peerDependencies": {
    "@tanstack/react-query": "^5.95.0",
    "@tanstack/react-router": "^1.120.0",
    "react": "^19.0.0",
    "zustand": "^5.0.0"
  }
}
```

---

## Defining API Contracts

API contracts use `@lokalise/api-contracts` with zod schemas. Contracts are typically **owned and published by the backend team** as an npm package (e.g., `@myorg/billing-api-contracts`). The frontend consumes them — either by importing the backend's package directly, or by re-exporting contracts through the app-shared package for convenience.

The examples below show contracts defined locally in the app-shared package for illustration.

```typescript
// app-shared/src/contracts/invoices.ts
import { buildRestContract } from '@lokalise/api-contracts'
import { z } from 'zod/v4'

export const invoiceSchema = z.object({
  id: z.string(),
  amount: z.number(),
  status: z.enum(['paid', 'pending', 'overdue']),
  date: z.string(),
})

export type Invoice = z.infer<typeof invoiceSchema>

// GET /api/invoices
export const listInvoicesContract = buildRestContract({
  method: 'get',
  pathResolver: () => '/api/invoices',
  successResponseBodySchema: z.array(invoiceSchema),
})

// GET /api/invoices/:invoiceId
export const getInvoiceContract = buildRestContract({
  method: 'get',
  pathResolver: (params) => `/api/invoices/${params.invoiceId}`,
  requestPathParamsSchema: z.object({ invoiceId: z.string() }),
  successResponseBodySchema: invoiceSchema,
})

// POST /api/invoices
export const createInvoiceContract = buildRestContract({
  method: 'post',
  pathResolver: () => '/api/invoices',
  requestBodySchema: z.object({
    amount: z.number(),
    date: z.string(),
  }),
  successResponseBodySchema: invoiceSchema,
})
```

Contracts define the path, HTTP method, path params, query params, request body, and response body — all with zod schemas. The `@lokalise/frontend-http-client` validates both request and response at runtime.

---

## Fetching Data with React Query

**Zustand** manages client state — things the app owns (auth, UI preferences, config). **React Query** manages server state — data fetched from APIs, including caching, background refetching, loading/error states, and cache invalidation after mutations.

### Queries (GET)

```typescript
import { useService, listInvoicesContract } from '@example/app-shared'
import { sendByContract } from '@lokalise/frontend-http-client'
import { useQuery } from '@tanstack/react-query'

function InvoiceList() {
  const httpClient = useService('httpClient')

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => sendByContract(httpClient, listInvoicesContract, {}),
  })
}
```

### Queries with params

```typescript
import { getInvoiceContract } from '@example/app-shared'

const { data: invoice } = useQuery({
  queryKey: ['invoices', invoiceId],
  queryFn: () => sendByContract(httpClient, getInvoiceContract, {
    pathParams: { invoiceId },
  }),
})
```

### Mutations (POST/PUT/DELETE)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createInvoiceContract } from '@example/app-shared'

function CreateInvoiceForm() {
  const httpClient = useService('httpClient')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (body: { amount: number; date: string }) =>
      sendByContract(httpClient, createInvoiceContract, { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })

  return (
    <button onClick={() => mutation.mutate({ amount: 100, date: '2026-04-01' })}>
      Create Invoice
    </button>
  )
}
```

### Query key conventions

Prefix query keys with the module's domain to avoid collisions across modules:

```typescript
// Billing module
queryKey: ['invoices']
queryKey: ['invoices', invoiceId]

// Users module
queryKey: ['users']
queryKey: ['users', userId]
```

---

## Shared Dependencies (DI)

The framework uses a two-tier dependency injection system based on React Context.

### Zustand stores (reactive)

For state that components subscribe to and re-render on changes.

```typescript
// Access full store state
const auth = useStore('auth')

// Access with selector — re-renders only when selected value changes
const user = useStore('auth', (s) => s.user)
const isAuthenticated = useStore('auth', (s) => s.isAuthenticated)

// Call store actions
const login = useStore('auth', (s) => s.login)
await login({ email: 'user@example.com', password: 'secret' })
```

### Plain services (non-reactive)

For stable instances that don't trigger re-renders: HTTP clients, loggers, analytics.

```typescript
const httpClient = useService('httpClient')
```

### How it works

1. The app-shared package defines `AppDependencies` — the type describing all shared state and services.
2. `createSharedHooks<AppDependencies>()` produces typed `useStore` and `useService` hooks.
3. The host app creates the actual zustand stores and service instances.
4. `createRegistry()` receives them in `{ stores, services }`.
5. `registry.resolve()` validates that all module requirements are met and wraps everything in a `SharedDependenciesContext`.
6. Module components call `useStore('key', selector?)` and `useService('key')`.

### Validation

If a module declares `requires: ['auth', 'httpClient']` and the registry doesn't have `httpClient` in its stores or services, `resolve()` throws:

```
[@reactive/registry] Module "billing" requires dependencies not provided
by the registry: httpClient. Available: auth, config
```

---

## The Shell (Host App)

The shell is a Vite application that creates shared dependencies, registers modules, and mounts the app.

### main.tsx

```typescript
import { createRoot } from 'react-dom/client'
import { createRegistry } from '@reactive/registry'
import type { AppDependencies } from '@example/app-shared'
import billing from '@example/billing-module'
import users from '@example/users-module'
import { authStore } from './stores/auth.js'
import { configStore } from './stores/config.js'
import { httpClient } from './services/http-client.js'
import { Layout } from './components/Layout.js'
import { Home } from './components/Home.js'

const registry = createRegistry<AppDependencies>({
  stores: { auth: authStore, config: configStore },
  services: { httpClient },
})

registry.register(billing)
registry.register(users)

const { App } = registry.resolve({
  rootComponent: Layout,     // Root layout with <Outlet />
  indexComponent: Home,       // Component for /
})

createRoot(document.getElementById('root')!).render(<App />)
```

### Creating zustand stores

Use `zustand/vanilla` so stores can be accessed outside React (e.g., in the HTTP client):

```typescript
// stores/auth.ts
import { createStore } from 'zustand/vanilla'
import type { AuthStore } from '@example/app-shared'

export const authStore = createStore<AuthStore>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  login: async (credentials) => {
    const response = await fetch('/api/login', { /* ... */ })
    const user = await response.json()
    set({ user, token: user.token, isAuthenticated: true })
  },
  logout: () => set({ user: null, token: null, isAuthenticated: false }),
}))
```

### Creating the HTTP client

Use wretch with `defer()` to dynamically attach auth headers:

```typescript
// services/http-client.ts
import wretch from 'wretch'
import { authStore } from '../stores/auth.js'
import { configStore } from '../stores/config.js'

export const httpClient = wretch().defer((w) => {
  const { apiBaseUrl } = configStore.getState()
  const { token } = authStore.getState()
  let instance = w.url(apiBaseUrl)
  if (token) {
    instance = instance.auth(`Bearer ${token}`)
  }
  return instance
})
```

### Vite config with React Compiler

See the [React Compiler](#react-compiler) section for details on why and how to enable it.

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
})
```

---

## Navigation

Modules declare navigation items. The registry collects, sorts, and groups them into a `NavigationManifest`.

### Declaring nav items in a module

```typescript
defineModule<AppDependencies>({
  // ...
  navigation: [
    { label: 'Billing', to: '/billing', icon: 'credit-card', group: 'finance', order: 10 },
    { label: 'Invoices', to: '/billing/invoices', group: 'finance', order: 11 },
  ],
})
```

### NavigationItem fields

| Field | Required | Description |
|---|---|---|
| `label` | Yes | Display text |
| `to` | Yes | Route path |
| `icon` | No | Icon identifier (consumed by the shell's icon system) |
| `group` | No | Grouping key (e.g., `'finance'`, `'admin'`). Items with the same group are rendered together. |
| `order` | No | Sort order within group. Lower = higher priority. Default: `999`. |
| `hidden` | No | If `true`, registered but excluded from default nav rendering. |

### Rendering navigation in the layout

```typescript
import { useNavigation } from '@reactive/registry'
import { Link, useLocation } from '@tanstack/react-router'

function Sidebar() {
  const navigation = useNavigation()
  const location = useLocation()

  return (
    <nav>
      {navigation.groups.map((group) => (
        <div key={group.group}>
          <h3>{group.group}</h3>
          {group.items.filter((item) => !item.hidden).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={location.pathname.startsWith(item.to) ? 'active' : ''}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  )
}
```

### How sorting works

1. Items sorted by `order` ascending (default `999`).
2. Ties broken alphabetically by `label`.
3. Grouped by `group` key. Items without a group go into `navigation.ungrouped`.

---

## Cross-Module Communication

Modules communicate through **shared Zustand stores** (for reactive state) and **React Query cache invalidation** (for server data). No custom event bus is needed — native React patterns handle all cross-module coordination.

### Via shared stores

When one module changes a Zustand store, all components in other modules that subscribe to that store automatically re-render:

```typescript
// Users module — updates the auth store
import { useStore } from '@example/app-shared'

function UserSettings() {
  const logout = useStore('auth', (s) => s.logout)
  return <button onClick={logout}>Log Out</button>
}

// Billing module — reacts to auth changes automatically
import { useStore } from '@example/app-shared'

function BillingDashboard() {
  const isAuthenticated = useStore('auth', (s) => s.isAuthenticated)
  if (!isAuthenticated) return <p>Please log in to view billing.</p>
  // ...
}
```

### Via React Query cache invalidation

When one module mutates server data that another module queries, use `invalidateQueries` to trigger automatic refetching:

```typescript
// Users module — deactivates a user and invalidates related queries
import { useMutation, useQueryClient } from '@tanstack/react-query'

function UserDetail() {
  const httpClient = useService('httpClient')
  const queryClient = useQueryClient()

  const deactivate = useMutation({
    mutationFn: (userId: string) =>
      sendByContract(httpClient, deactivateUserContract, { pathParams: { userId } }),
    onSuccess: () => {
      // Both the users module and billing module will refetch their data
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}
```

### When to use which

| Pattern | Use case | Example |
|---|---|---|
| Zustand store | Client state changes that affect UI across modules | Auth state, feature flags, UI preferences |
| React Query invalidation | Server data changes that other modules also display | User deactivated → billing data needs refresh |

---

## React Compiler

React Compiler is a build-time tool that automatically optimizes React components by inserting memoization where needed. This is particularly valuable in a modular architecture where components are composed dynamically across package boundaries.

### Why it matters for Reactive

In a module-based app, the shell composes a deep provider tree and modules are loaded lazily. Without memoization, a state change in one provider (e.g., auth store) could trigger unnecessary re-renders down through the entire tree. Traditionally you'd prevent this with manual `React.memo()`, `useMemo()`, and `useCallback()` — but this is tedious and error-prone across independently developed modules.

React Compiler eliminates this problem automatically. It analyzes your components at build time and inserts fine-grained memoization, so:

- Module components don't need `React.memo()` wrappers
- Callbacks passed to child components are automatically stable
- Selectors in `useStore('auth', (s) => s.user)` benefit from stable references
- Independently developed modules get optimal re-render behavior without coordination

### How to enable

Enable React Compiler in each shell's Vite config via `@rolldown/plugin-babel`:

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
})
```

The compiler runs at the shell level during bundling, so it optimizes both shell code and all imported module code. Individual module packages don't need their own compiler setup.

### Compatibility

React Compiler requires React 19. All Reactive framework packages target React 19 as a peer dependency.

The framework's hooks (`useStore`, `useService`, `useNavigation`) follow React's rules of hooks and are fully compatible with the compiler. Avoid patterns the compiler cannot optimize:

- Don't mutate variables between renders
- Don't call hooks conditionally
- Don't read or write refs during render

See the [React Compiler documentation](https://react.dev/learn/react-compiler) for the full list of requirements.

---

## Testing Modules

`@reactive/testing` provides `renderModule()` to test a module in isolation with mocked dependencies.

```typescript
import { renderModule, createMockStore } from '@reactive/testing'
import billing from '@example/billing-module'
import type { AuthStore } from '@example/app-shared'
import wretch from 'wretch'

test('billing dashboard shows user name', async () => {
  const result = await renderModule(billing, {
    route: '/billing',
    deps: {
      auth: createMockStore<AuthStore>({
        user: { id: '1', name: 'Test User', email: 'test@example.com', role: 'admin' },
        token: 'mock-token',
        isAuthenticated: true,
        login: async () => {},
        logout: () => {},
      }),
      httpClient: wretch('http://localhost:3000'),
    },
  })

  expect(result.getByText('Test User')).toBeDefined()
})
```

### createMockStore

Creates a zustand store pre-populated with the given state:

```typescript
const authStore = createMockStore<AuthStore>({
  user: null,
  token: null,
  isAuthenticated: false,
  login: async () => {},
  logout: () => {},
})
```

### renderModule options

| Option | Description |
|---|---|
| `route` | Initial route to navigate to (default: `'/'`). |
| `deps` | Partial map of shared dependencies. `StoreApi` values go to stores context, plain values go to services context. |

---

## Lazy Loading Modules

For large modules that shouldn't be in the initial bundle:

```typescript
registry.registerLazy({
  id: 'admin',
  basePath: '/admin',
  load: () => import('@example/admin-module'),
})
```

The module's code is only loaded when the user first navigates to `/admin/*`.

---

## Project Structure

```
reactive/
├── packages/
│   ├── core/                    # @reactive/core — module types, hooks, defineModule()
│   ├── registry/                # @reactive/registry — composition, validation, providers
│   └── testing/                 # @reactive/testing — test harness
├── examples/
│   ├── app-shared/              # @example/app-shared — types, hooks, API contracts
│   ├── shell/                   # Example host app (Vite 8 + React Compiler)
│   └── modules/
│       ├── billing/             # @example/billing-module
│       └── users/               # @example/users-module
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.json
```

### Framework packages

| Package | Purpose | Size |
|---|---|---|
| `@reactive/core` | Module types, `defineModule()`, `createSharedHooks()` | ~1.2 KB |
| `@reactive/registry` | `createRegistry()`, route composition, validation, navigation manifest, `useNavigation()` | ~13.6 KB |
| `@reactive/testing` | `renderModule()`, `createMockStore()` | ~8.9 KB |

### Building packages

All packages use Vite 8 library mode (no tsup/esbuild):

```bash
pnpm build                    # Build all packages + shell
pnpm --filter @reactive/core build   # Build a single package
pnpm --filter shell dev       # Run example shell in dev mode
```

---

## API Reference

### @reactive/core

| Export | Type | Description |
|---|---|---|
| `defineModule(descriptor)` | Function | Identity function for type inference. Returns descriptor unchanged. |
| `createSharedHooks<T>()` | Function | Returns typed `{ useStore, useService }` hooks. Call once in app-shared package. |
| `SharedDependenciesContext` | Context | React context holding stores and services. Used internally. |
| `ReactiveModuleDescriptor<T>` | Type | Module descriptor shape. |
| `LazyModuleDescriptor<T>` | Type | Lazy module descriptor shape. |
| `NavigationItem` | Type | Navigation entry shape. |
| `ModuleLifecycle<T>` | Type | Lifecycle hooks shape. |

### @reactive/registry

| Export | Type | Description |
|---|---|---|
| `createRegistry<T>(config)` | Function | Creates a module registry. Config has `{ stores, services }`. |
| `useNavigation()` | Hook | Access the navigation manifest from any component inside `<App />`. |
| `ModuleErrorBoundary` | Component | Error boundary that isolates module-level crashes. |
| `ReactiveRegistry<T>` | Type | Registry interface with `register()`, `registerLazy()`, `resolve()`. |
| `RegistryConfig<T>` | Type | Registry configuration shape. |
| `ApplicationManifest<T>` | Type | Resolved app shape: `{ App, router, queryClient, navigation }`. |
| `NavigationManifest` | Type | `{ items, groups, ungrouped }`. |
| `NavigationGroup` | Type | `{ group, items }`. |
| `ResolveOptions` | Type | `{ rootComponent, indexComponent, notFoundComponent }`. |

### @reactive/testing

| Export | Type | Description |
|---|---|---|
| `renderModule(module, options)` | Function | Render a module in isolation. Returns `@testing-library/react` RenderResult. |
| `createMockStore<T>(state)` | Function | Create a zustand store pre-populated with given state. |
| `RenderModuleOptions<T>` | Type | Options for `renderModule`. |
