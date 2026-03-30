# tanstack-react-modules

Plug-and-play modular framework for React. Build frontend features as independent npm packages, compose them into a running application via a typed module registry.

**Stack:** React 19 (React Compiler) + TanStack Router + Vite 8 + Zustand

## Table of Contents

- [Philosophy](#philosophy)
- [When You Need Modularization](#when-you-need-modularization)
- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
- [The App-Shared Package](#the-app-shared-package)
- [Creating a Module](#creating-a-module)
- [Defining API Contracts](#defining-api-contracts)
- [Fetching Data with React Query](#fetching-data-with-react-query)
- [Shared Dependencies (DI)](#shared-dependencies-di)
- [The Shell (Host App)](#the-shell-host-app)
- [Navigation](#navigation)
- [Slots](#slots)
- [Zones](#zones)
- [Module Catalog](#module-catalog)
- [Shell Patterns](docs/shell-patterns.md) - layout grids, command palettes, auth guards, cross-store coordination
- [Workspace Patterns](docs/workspace-patterns.md) - tabbed workspaces, component-only modules, descriptor zones
- [Cross-Module Communication](#cross-module-communication)
- [Scoped Stores](#scoped-stores)
- [React Compiler](#react-compiler)
- [Testing Modules](#testing-modules)
- [Lazy Loading Modules](#lazy-loading-modules)
- [Project Structure](#project-structure)
- [AI Skills](#ai-skills)
- [CLI Reference](#cli-reference)
- [E2E Testing](#e2e-testing)
- [API Reference](#api-reference)

---

## Philosophy

This framework does not reinvent routing, state management, or data fetching. React, TanStack Router, Zustand, and React Query are mature, battle-tested tools with excellent documentation, large communities, and proven track records. Replacing any of them with a custom abstraction would mean worse documentation, fewer answered Stack Overflow questions, and harder hiring.

Instead, tanstack-react-modules provides **lightweight glue** on top of the ecosystem you already know. The framework's job is to solve the handful of problems that become genuinely painful when multiple independent teams need to ship features into a single application - without touching the parts that existing tools already handle well.

Concretely, the framework handles:

- **Dependency injection across package boundaries.** Modules need access to shared state (auth, config) and services (HTTP clients) owned by the host app. The `TSharedDependencies` pattern provides compile-time-safe, typed access to these without global singletons or prop drilling through layers of components that don't care about them.
- **Route composition.** Each module declares its own routes. The registry merges them into a single TanStack Router tree. No module needs to know about any other module's routes, and the shell doesn't need a growing import list every time a new feature ships.
- **UI extensibility primitives.** Navigation items, command palette entries, sidebar panels - these are places where every module needs to contribute a piece. Slots and zones provide structured extension points so the shell layout can stay generic while modules fill it with content.
- **Validation at startup.** When a module declares `requires: ['auth', 'httpClient']`, the registry checks that these dependencies are actually provided before the app renders. Typos and missing wiring surface as explicit errors during development, not as undefined-is-not-a-function at runtime.

Everything else - how you write components, how you fetch data, how you manage local state, how you style your UI - is just React. A developer who knows React, TanStack Router, and Zustand can be productive in a tanstack-react-modules codebase on day one, because the framework adds concepts only where vanilla React falls short for multi-team composition.

---

## When You Need Modularization

Not every React application needs a module system. A single team building a single product can ship a well-structured monolith and be perfectly productive. Modularization becomes important when you have **one aggregate, complex system where one team owns the umbrella structure (the "shell") and external teams each want to contribute their distinct pieces (the "modules").**

This is common in:

- **Enterprise platforms** where a platform team maintains the shell (navigation, auth, layout) and domain teams own vertical features (billing, analytics, user management).
- **Product suites** where separately developed products need to appear as one coherent application.
- **White-label or extensible products** where third parties or customer teams add functionality.
- **Large organizations** where frontend ownership is distributed across many teams with independent release cadences.

### Pain points in monolithic architecture

When multiple teams try to work within a single traditional React application, several problems compound:

**Routing conflicts and coordination overhead.** Every team's routes live in the same file or directory. Adding a new page means touching shared routing config, which creates merge conflicts and requires cross-team coordination for something that should be an independent decision. Teams end up blocked waiting for PR reviews from the shell owners just to add a route.

**Implicit coupling through imports.** Without clear boundaries, components inevitably start importing from each other. The billing page imports a helper from the users module, the users module imports a type from analytics, and soon you have a dependency graph that no one fully understands. Refactoring one team's code breaks another team's build. Extracting a feature into its own deployable unit becomes a multi-sprint project.

**Shared state turns into a global grab bag.** A single Redux store or a growing pile of React contexts becomes the de facto communication channel between features. Every team adds their slice, and the store becomes a tightly coupled monolith of its own. Changing the shape of one team's state risks subtle breakage in components owned by other teams that happen to select from the same tree.

**Onboarding and cognitive load scale with the whole codebase.** A new developer on the billing team needs to understand the full application structure just to find where their code lives. Conventions are inconsistent across team boundaries because there's no enforcement mechanism - only tribal knowledge and code review goodwill.

tanstack-react-modules addresses these problems by giving each module a clear contract (`ReactiveModuleDescriptor`), enforcing dependency declarations at compile time, and composing independently developed packages into a running application at the registry level - without requiring teams to coordinate on anything beyond the shared dependency interface.

Note that the framework does **not** solve independent deployment. Modules are composed at build time - they ship in the same bundle as the shell. This is a deliberate trade-off: runtime module federation and micro-frontend loading add significant complexity (shared dependency versioning, runtime failures, CORS, independent CI pipelines) that most teams don't need. tanstack-react-modules optimizes for **development-time independence** - separate packages, isolated testing, clear contracts - while keeping a single, simple build and deploy pipeline.

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
│  │  @tanstack-react-modules/runtime                   │ │
│  │  - Validates dependencies                          │ │
│  │  - Composes TanStack Router route tree             │ │
│  │  - Builds navigation manifest                      │ │
│  │  - Collects slot contributions                     │ │
│  │  - Wires provider tree:                            │ │
│  │    QueryClientProvider                             │ │
│  │      → SharedDependenciesContext                   │ │
│  │        → NavigationContext                         │ │
│  │          → SlotsContext                            │ │
│  │            → RouterProvider                        │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Billing      │  │ Users        │  │ Settings     │   │
│  │ Module       │  │ Module       │  │ Module       │   │
│  │              │  │              │  │              │   │
│  │ Routes       │  │ Routes       │  │ Component    │   │
│  │ Pages        │  │ Pages        │  │ Meta         │   │
│  │ Navigation   │  │ Navigation   │  │ Navigation   │   │
│  │ Slots        │  │ Slots        │  │ Slots        │   │
│  │ Zones        │  │ Zones        │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │  @example/app-shared                               │ │
│  │  - AppDependencies type (auth, config, httpClient) │ │
│  │  - Typed hooks: useStore(), useService()           │ │
│  │  - API contracts (zod schemas)                     │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### What maps to what on screen

| Framework entity              | What the user sees                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| **Shell**                     | The persistent chrome: top bar, sidebar, footer. Always visible.                                    |
| **Module**                    | A feature area. In route-based apps, a set of pages (`/billing/*`). In workspace apps, a unit of content the shell renders — typically in a tab, but could be a panel, drawer, or any shell-managed content area. The module's content can have its own internal navigation (sub-tabs, wizards, etc.). |
| **Route** (`createRoutes`)    | A page within a module. URL changes, content area updates.                                          |
| **Component** (on descriptor) | A module's UI rendered by the shell in a tab, panel, or modal — not tied to a URL.                  |
| **Zone**                      | A named layout region (sidebar, header actions, detail panel) whose content changes per page or tab. |
| **Slot**                      | A global collection rendered once (command palette entries, badge counts). All modules contribute.   |
| **Navigation item**           | A link in the sidebar or mode rail.                                                                 |
| **Shared dependency**         | Invisible. Services and stores modules consume (auth, HTTP client) — no direct UI.                  |

A single module can use routes, zones, slots, and navigation together. A billing module might own `/billing/*` routes, contribute a detail panel zone on its invoice page, add commands to the command palette via slots, and show a "Billing" link in the sidebar via navigation.

**Key principles:**

- Modules are standard npm packages. They can live in the same monorepo or be published to a registry.
- The **host app** defines what shared dependencies exist (auth, config, HTTP client). Modules consume them via typed hooks.
- The framework does not reinvent routing, state management, or data fetching. It wires together TanStack Router, Zustand, React Query, and the Lokalise HTTP client.
- **Zustand** owns client state (auth, UI, preferences). **React Query** owns server state (API data, caching, refetching).

---

## Getting Started

### Prerequisites

- Node.js 24+
- pnpm

### Start a new project

The CLI scaffolds a complete project with shell, app-shared, and a first module:

```bash
npx @tanstack-react-modules/cli init my-app --scope @myorg --module dashboard
cd my-app
pnpm install
pnpm dev
```

This creates:

```
my-app/
├── app-shared/          # AppDependencies, typed hooks, API contracts
├── shell/               # Vite host app with React Compiler
├── modules/
│   └── dashboard/       # First module with two routes
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

### Install and run (framework development)

```bash
pnpm install
pnpm build        # Build all framework packages
pnpm dev           # Start the example shell app
```

Open http://localhost:5173. Click "Login as Demo User" to see the modules in action.

---

## The App-Shared Package

The app-shared package is the **single source of truth** for the types shared between the shell and all modules. It is a standalone npm package (e.g., `@myorg/app-shared`) that:

- Defines `AppDependencies` - the interface describing every zustand store and service the shell provides.
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
import { createSharedHooks } from "@tanstack-react-modules/core";
import type { Wretch } from "wretch";

export interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}

export interface ConfigStore {
  apiBaseUrl: string;
  environment: "dev" | "staging" | "prod";
  appName: string;
}

export interface AppDependencies {
  auth: AuthStore; // Zustand store - reactive
  config: ConfigStore; // Zustand store - reactive
  httpClient: Wretch; // Plain service - non-reactive
}

// These hooks are used by every module
export const { useStore, useService, useReactiveService, useOptional } =
  createSharedHooks<AppDependencies>();
```

**Rules:**

- The app-shared package is the **only** package that both the shell and modules depend on. It is the boundary between them.
- Modules import `useStore` and `useService` from this package - never from `@tanstack-react-modules/core` directly.
- Zustand store types go in `AppDependencies` for reactive state. Non-reactive services (HTTP client, loggers) also go in `AppDependencies`.
- The shell must provide implementations for every key in `AppDependencies`. The registry validates this at `resolve()` time against each module's `requires` list.
- Keep this package lightweight. It should contain only types, hooks, zod schemas, and domain types - no React components, no business logic.

---

## Creating a Module

> **CLI shortcut:** `npx @tanstack-react-modules/cli create module billing` scaffolds the module, wires it into the shell's `main.tsx` and `package.json`, then run `pnpm install`.

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
import { defineModule } from "@tanstack-react-modules/core";
import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import type { AppDependencies } from "@example/app-shared";

export default defineModule<AppDependencies>({
  id: "billing",
  version: "0.1.0",

  createRoutes: (parentRoute) => {
    const billingRoot = createRoute({
      getParentRoute: () => parentRoute,
      path: "billing",
    });

    const billingIndex = createRoute({
      getParentRoute: () => billingRoot,
      path: "/",
      component: lazyRouteComponent(() => import("./pages/BillingDashboard.js")),
    });

    const invoiceList = createRoute({
      getParentRoute: () => billingRoot,
      path: "invoices",
      component: lazyRouteComponent(() => import("./pages/InvoiceList.js")),
    });

    const invoiceDetail = createRoute({
      getParentRoute: () => billingRoot,
      path: "invoices/$invoiceId",
      component: lazyRouteComponent(() => import("./pages/InvoiceDetail.js")),
    });

    return billingRoot.addChildren([billingIndex, invoiceList, invoiceDetail]);
  },

  navigation: [
    { label: "Billing", to: "/billing", icon: "credit-card", group: "finance", order: 10 },
    { label: "Invoices", to: "/billing/invoices", group: "finance", order: 11 },
  ],

  requires: ["auth", "httpClient"],
});
```

### Module descriptor fields

| Field          | Required | Description                                                                                                                                          |
| -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | Yes      | Unique string identifier. Must be unique across all registered modules.                                                                              |
| `version`      | Yes      | SemVer version string.                                                                                                                               |
| `createRoutes` | No       | Receives the root route as parent, returns a TanStack Router route subtree. Use `lazyRouteComponent()` for code splitting.                           |
| `component`    | No       | A React component the shell can render outside of routes - in a tab, modal, or panel. Use for workspace apps where the shell orchestrates rendering. |
| `meta`         | No       | Catalog metadata for discovery UIs. Accepts a `TMeta` generic for type safety - see [Module Catalog](#module-catalog).                               |
| `navigation`   | No       | Array of `NavigationItem` entries contributed to the shell's sidebar/nav.                                                                            |
| `slots`        | No       | Typed slot contributions (e.g. commands, tab types). See [Slots](#slots).                                                                            |
| `requires`     | No       | Array of `AppDependencies` keys this module needs. Validated at registry resolution.                                                                 |
| `lifecycle`    | No       | `{ onRegister, onMount, onUnmount }` hooks.                                                                                                          |

### Writing page components

```typescript
// modules/billing/src/pages/InvoiceList.tsx
import { useStore, useService, listInvoicesContract } from '@example/app-shared'
import { sendByContract } from '@lokalise/frontend-http-client'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'

export default function InvoiceList() {
  // Reactive - re-renders when auth state changes
  const isAuthenticated = useStore('auth', (s) => s.isAuthenticated)

  // Non-reactive - stable reference
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
            {inv.id} - ${inv.amount.toFixed(2)}
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
    "@tanstack-react-modules/core": "^0.1.0",
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

API contracts use `@lokalise/api-contracts` with zod schemas. Contracts are typically **owned and published by the backend team** as an npm package (e.g., `@myorg/billing-api-contracts`).

The examples below show contracts defined locally in the app-shared package for illustration.

```typescript
// app-shared/src/contracts/invoices.ts
import { buildRestContract } from "@lokalise/api-contracts";
import { z } from "zod/v4";

export const invoiceSchema = z.object({
  id: z.string(),
  amount: z.number(),
  status: z.enum(["paid", "pending", "overdue"]),
  date: z.string(),
});

export type Invoice = z.infer<typeof invoiceSchema>;

// GET /api/invoices
export const listInvoicesContract = buildRestContract({
  method: "get",
  pathResolver: () => "/api/invoices",
  successResponseBodySchema: z.array(invoiceSchema),
});

// GET /api/invoices/:invoiceId
export const getInvoiceContract = buildRestContract({
  method: "get",
  pathResolver: (params) => `/api/invoices/${params.invoiceId}`,
  requestPathParamsSchema: z.object({ invoiceId: z.string() }),
  successResponseBodySchema: invoiceSchema,
});

// POST /api/invoices
export const createInvoiceContract = buildRestContract({
  method: "post",
  pathResolver: () => "/api/invoices",
  requestBodySchema: z.object({
    amount: z.number(),
    date: z.string(),
  }),
  successResponseBodySchema: invoiceSchema,
});
```

Contracts define the path, HTTP method, path params, query params, request body, and response body - all with zod schemas. The `@lokalise/frontend-http-client` validates both request and response at runtime.

---

## Fetching Data with React Query

**Zustand** manages client state - things the app owns (auth, UI preferences, config). **React Query** manages server state - data fetched from APIs, including caching, background refetching, loading/error states, and cache invalidation after mutations.

### Queries (GET)

```typescript
import { useService, listInvoicesContract } from "@example/app-shared";
import { sendByContract } from "@lokalise/frontend-http-client";
import { useQuery } from "@tanstack/react-query";

function InvoiceList() {
  const httpClient = useService("httpClient");

  const { data, isLoading, error } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => sendByContract(httpClient, listInvoicesContract, {}),
  });
}
```

### Queries with params

```typescript
import { getInvoiceContract } from "@example/app-shared";

const { data: invoice } = useQuery({
  queryKey: ["invoices", invoiceId],
  queryFn: () =>
    sendByContract(httpClient, getInvoiceContract, {
      pathParams: { invoiceId },
    }),
});
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
queryKey: ["invoices"];
queryKey: ["invoices", invoiceId];

// Users module
queryKey: ["users"];
queryKey: ["users", userId];
```

---

## Shared Dependencies (DI)

The framework uses a two-tier dependency injection system based on React Context.

### Zustand stores (reactive)

For state that components subscribe to and re-render on changes.

```typescript
// Access full store state
const auth = useStore("auth");

// Access with selector - re-renders only when selected value changes
const user = useStore("auth", (s) => s.user);
const isAuthenticated = useStore("auth", (s) => s.isAuthenticated);

// Call store actions
const login = useStore("auth", (s) => s.login);
await login({ email: "user@example.com", password: "secret" });
```

### Plain services (non-reactive)

For stable instances that don't trigger re-renders: HTTP clients, loggers, analytics.

```typescript
const httpClient = useService("httpClient");
```

### How it works

1. The app-shared package defines `AppDependencies` - the type describing all shared state and services.
2. `createSharedHooks<AppDependencies>()` produces typed `useStore` and `useService` hooks.
3. The host app creates the actual zustand stores and service instances.
4. `createRegistry()` receives them in `{ stores, services }`.
5. `registry.resolve()` validates that all module requirements are met and wraps everything in a `SharedDependenciesContext`.
6. Module components call `useStore('key', selector?)` and `useService('key')`.

### Validation

If a module declares `requires: ['auth', 'httpClient']` and the registry doesn't have `httpClient` in its stores or services, `resolve()` throws:

```
[@tanstack-react-modules/runtime] Module "billing" requires dependencies not provided
by the registry: httpClient. Available: auth, config
```

---

## The Shell (Host App)

The shell is a Vite application that creates shared dependencies, registers modules, and mounts the app.

### main.tsx

```typescript
import { createRoot } from 'react-dom/client'
import { createRegistry } from '@tanstack-react-modules/runtime'
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
import { createStore } from "zustand/vanilla";
import type { AuthStore } from "@example/app-shared";

export const authStore = createStore<AuthStore>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  login: async (credentials) => {
    const response = await fetch("/api/login", {
      /* ... */
    });
    const user = await response.json();
    set({ user, token: user.token, isAuthenticated: true });
  },
  logout: () => set({ user: null, token: null, isAuthenticated: false }),
}));
```

### Creating the HTTP client

Use wretch with `defer()` to dynamically attach auth headers:

```typescript
// services/http-client.ts
import wretch from "wretch";
import { authStore } from "../stores/auth.js";
import { configStore } from "../stores/config.js";

export const httpClient = wretch().defer((w) => {
  const { apiBaseUrl } = configStore.getState();
  const { token } = authStore.getState();
  let instance = w.url(apiBaseUrl);
  if (token) {
    instance = instance.auth(`Bearer ${token}`);
  }
  return instance;
});
```

### Vite config with React Compiler

See the [React Compiler](#react-compiler) section for details on why and how to enable it.

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
});
```

---

## Navigation

Modules declare navigation items. The registry collects, sorts, and groups them into a `NavigationManifest`.

### Declaring nav items in a module

```typescript
defineModule<AppDependencies>({
  // ...
  navigation: [
    { label: "Billing", to: "/billing", icon: "credit-card", group: "finance", order: 10 },
    { label: "Invoices", to: "/billing/invoices", group: "finance", order: 11 },
  ],
});
```

### NavigationItem fields

| Field    | Required | Description                                                                                   |
| -------- | -------- | --------------------------------------------------------------------------------------------- |
| `label`  | Yes      | Display text                                                                                  |
| `to`     | Yes      | Route path                                                                                    |
| `icon`   | No       | Icon identifier (`string`) or React component (`React.ComponentType<{ className?: string }>`) |
| `group`  | No       | Grouping key (e.g., `'finance'`, `'admin'`). Items with the same group are rendered together. |
| `order`  | No       | Sort order within group. Lower = higher priority. Default: `999`.                             |
| `hidden` | No       | If `true`, registered but excluded from default nav rendering.                                |

### Rendering navigation in the layout

```typescript
import { useNavigation } from '@tanstack-react-modules/runtime'
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

## Slots

Slots let modules contribute typed data and components to named placeholders in the shell - beyond routes and navigation. Think command palette entries, workspace tab types, status badges, or anything the shell wants to collect from modules.

The pattern mirrors navigation: the shell defines what slots exist (via `AppSlots` in app-shared), modules contribute to them, and the registry concatenates contributions from all modules.

### Defining slots in app-shared

```typescript
// app-shared/src/index.ts

export interface BadgeDefinition {
  readonly id: string;
  readonly label: string;
  readonly color: "info" | "warning" | "error";
  readonly count: () => number;
}

export interface AppSlots {
  badges: BadgeDefinition[];
}
```

Every slot value must be an array type - the registry concatenates contributions across modules.

### Contributing from a module

```typescript
import { defineModule } from "@tanstack-react-modules/core";
import type { AppDependencies, AppSlots } from "@myorg/app-shared";

export default defineModule<AppDependencies, AppSlots>({
  id: "billing",
  version: "0.1.0",
  createRoutes: (parentRoute) => {
    /* ... */
  },

  slots: {
    badges: [
      {
        id: "billing:overdue",
        label: "Overdue",
        color: "error",
        count: () => overdueInvoicesStore.getState().count,
      },
    ],
  },

  // ...
});
```

Modules only contribute to the slots they care about - `slots` is `Partial<AppSlots>`.

### Reading slots in the shell

```typescript
import { useSlots } from '@tanstack-react-modules/runtime'
import type { AppSlots } from '@myorg/app-shared'

function StatusBar() {
  const { badges } = useSlots<AppSlots>()

  return (
    <div>
      {badges.map((badge) => (
        <span key={badge.id} className={badge.color}>
          {badge.label}: {badge.count()}
        </span>
      ))}
    </div>
  )
}
```

### Wiring the registry

Pass `AppSlots` as the second type parameter to `createRegistry`. Provide `slots` with empty arrays for every declared key - this guarantees all keys exist in the manifest even if no module contributes:

```typescript
const registry = createRegistry<AppDependencies, AppSlots>({
  stores: { auth: authStore, config: configStore },
  services: { httpClient },
  slots: { commands: [] },
});
```

Without `slots` defaults, accessing a key that no module contributed to would return `undefined`. The defaults prevent this.

### Lazy modules and slots

Lazy modules (registered via `registerLazy()`) cannot contribute slots at registration time since their descriptors are not loaded yet. Only eager modules contribute to the slots manifest.

### When to use slots vs stores

| Use case                                                                           | Mechanism                 |
| ---------------------------------------------------------------------------------- | ------------------------- |
| Static declarations known at module registration (commands, tab types, badges)     | **Slots**                 |
| Runtime state that changes over time (active tab, notifications, user preferences) | **Shared Zustand stores** |
| Server data (API responses, cached queries)                                        | **React Query**           |

For a detailed guide on building shell applications, see [Shell Patterns](docs/shell-patterns.md). For workspace-style apps with tabbed workspaces and component-only modules, see [Workspace Patterns](docs/workspace-patterns.md).

---

## Zones

Zones let the **currently active content** contribute UI components to named layout regions in the shell - a detail panel, header actions, a contextual sidebar. Unlike slots (which aggregate data from _all_ modules at registration time), zones change based on what the user is currently viewing.

Zones have two contribution paths:

- **Route-based modules** set zones via TanStack Router's `staticData` - different routes contribute different zone content as the user navigates.
- **Tab-based modules** declare zones on their module descriptor - the shell reads them when the module's workspace tab is active.

### Slots vs Zones

|                   | Slots                       | Zones                                 |
| ----------------- | --------------------------- | ------------------------------------- |
| **Source**        | All registered modules      | Active route or active module tab     |
| **When resolved** | Once at `resolve()` time    | On every navigation or tab switch     |
| **Value type**    | Arrays (concatenated)       | Single React component                |
| **Use case**      | Commands, tab types, badges | Detail panel, header actions, sidebar |
| **Hook**          | `useSlots<AppSlots>()`      | `useActiveZones<AppZones>(moduleId?)` |

### Defining zones in app-shared

```typescript
// app-shared/src/index.ts
import type { ComponentType } from "react";

export interface AppZones {
  headerActions?: ComponentType;
  detailPanel?: ComponentType;
}
```

Zone values are optional - not every route populates every zone.

### Setting zones on a route

Modules set zones via TanStack Router's `staticData` on individual routes. Different routes within the same module can contribute different zone components:

```typescript
import { createRoute } from "@tanstack/react-router";
import { UserDetailActions } from "./components/UserDetailActions.js";
import { UserDetailPanel } from "./components/UserDetailPanel.js";

const userDetail = createRoute({
  getParentRoute: () => usersRoot,
  path: "$userId",
  component: UserDetailPage,
  staticData: {
    headerActions: UserDetailActions,
    detailPanel: UserDetailPanel,
  },
});
```

Routes that don't set `staticData` simply contribute no zones - the shell renders nothing in those regions.

### Setting zones on a module descriptor

Tab-based modules (rendered in workspace tabs rather than via routes) declare zones directly on the descriptor:

```typescript
import { PaymentsContextualPanel } from "./PaymentsContextualPanel.js";

export default defineModule<AppDependencies, AppSlots, WorkflowMeta>({
  id: "my-module",
  version: "0.1.0",
  component: lazy(() => import("./MyModuleComponent.js")),
  zones: {
    contextualPanel: PaymentsContextualPanel,
  },
  meta: { name: "Payment Setup", category: "payments", icon: "CreditCard" },
});
```

The shell reads these zones via `useActiveZones(activeModuleId)` when the module's tab is active.

### Reading zones in the shell

Use `useActiveZones` to get a unified view of zones from both routes and the active module tab:

```typescript
import { useActiveZones } from '@tanstack-react-modules/runtime'
import type { AppZones } from '@myorg/app-shared'

function Layout() {
  // activeModuleId comes from the shell's tab state - null when no module tab is active
  const activeModuleId = getActiveTab()?.moduleId ?? null
  const zones = useActiveZones<AppZones>(activeModuleId)
  const HeaderActions = zones.headerActions
  const DetailPanel = zones.detailPanel

  return (
    <div className="layout">
      <header>
        {HeaderActions && <HeaderActions />}
      </header>
      <div style={{ display: 'flex' }}>
        <main><Outlet /></main>
        {DetailPanel && <DetailPanel />}
      </div>
    </div>
  )
}
```

### How it works

**Route zones (`useZones`):**

1. `useZones()` calls TanStack Router's `useMatches()` with a `select` function.
2. The select function walks matched routes from root to leaf, merging `staticData` entries.
3. **Deepest match wins** - a child route can override a parent route's zone. A parent can set a default sidebar, and a specific detail page can replace it.
4. The shell conditionally renders zone components. If a zone is `undefined`, nothing renders.

**Active module zones (`useActiveZones`):**

1. `useActiveZones(moduleId)` first collects route zones via `useZones()`.
2. If `moduleId` is provided, it looks up the module's `zones` field from `useModules()`.
3. Module zones are merged on top of route zones - **active module wins** for the same key.
4. When `moduleId` is `null` or `undefined`, only route zones are returned.

### Performance

- **No extra re-renders.** `staticData` is defined at route creation time - its reference is permanently stable. `useMatches` with `select` only triggers re-renders when the selected value actually changes.
- **No context cascade.** Zones flow through TanStack Router's existing match data, not a custom React context.
- **No mount ordering issues.** Unlike portal-based approaches, zone components are rendered directly by the shell in its own React tree. They have normal access to all contexts (shared dependencies, router, React Query).

### Type-safe staticData

By default, TanStack Router's `staticData` accepts any object. To get compile-time checks on zone keys and component types, augment `StaticDataRouteOption` in app-shared:

```typescript
// app-shared/src/index.ts
export interface AppZones {
  headerActions?: ComponentType;
  detailPanel?: ComponentType;
}

declare module "@tanstack/router-core" {
  interface StaticDataRouteOption extends AppZones {}
}
```

With this augmentation, every `createRoute({ staticData: ... })` call across all modules is checked against `AppZones`. A typo like `detialPanel` or passing a string instead of a component becomes a compile error. This works because `StaticDataRouteOption` is an empty interface designed for declaration merging - the same pattern TanStack Router uses for `Register`.

Add `@tanstack/router-core` as a peer dependency of app-shared so the augmentation resolves.

### Route zones vs descriptor zones

**Route-based modules** set zones on individual routes via `staticData`. A module with 5 routes can have different zone content for each - the user detail page shows a sidebar, the user list page shows nothing. This per-route granularity is the right model for route-based apps.

**Tab-based modules** (component-only, rendered in workspace tabs) use the `zones` field on the module descriptor. Since these modules don't own routes, they can't use `staticData`. The descriptor's zones apply whenever the module's tab is active.

Use `useActiveZones(activeModuleId)` to unify both - one code path in the shell regardless of how the active content is rendered.

### Modules with internal sub-navigation

A module like "Billing" may have its own tabs (invoices, payments, cards) while still being a single module. How zones work depends on the app style:

**Route-based apps** — each sub-page is a child route with its own `staticData`. Zones update automatically as the user navigates between `/billing/invoices` and `/billing/payments`:

```typescript
import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { InvoiceActions } from "./components/InvoiceActions.js";
import { PaymentsSidebar } from "./components/PaymentsSidebar.js";

const billingRoot = createRoute({
  getParentRoute: () => parentRoute,
  path: "billing",
  component: BillingLayout, // renders a tab strip + <Outlet />
});

const invoices = createRoute({
  getParentRoute: () => billingRoot,
  path: "invoices",
  component: lazyRouteComponent(() => import("./pages/Invoices.js")),
  staticData: {
    detailPanel: InvoiceSidebar,
    headerActions: InvoiceActions,
  },
});

const payments = createRoute({
  getParentRoute: () => billingRoot,
  path: "payments",
  component: lazyRouteComponent(() => import("./pages/Payments.js")),
  staticData: {
    detailPanel: PaymentsSidebar,
    // no headerActions — zone is undefined, shell renders fallback
  },
});
```

The module's `BillingLayout` component renders its own tab strip UI and an `<Outlet />`. The router handles the rest — each child route contributes its own zones.

**Workspace apps** — the module is one tab with one `zones` field on the descriptor, but internal navigation is module-owned state. The zone component reads that state and renders the right content:

```typescript
// Module descriptor — one zone component that adapts internally
export default defineModule<AppDependencies, AppSlots>({
  id: "billing",
  version: "0.1.0",
  component: lazy(() => import("./BillingWorkspace.js")),
  zones: {
    contextualPanel: BillingContextPanel,
  },
});
```

```typescript
// BillingContextPanel reads the module's internal tab state
import { useBillingStore } from "./stores/billing.js";

function BillingContextPanel() {
  const activeTab = useBillingStore((s) => s.activeTab);

  switch (activeTab) {
    case "invoices":
      return <InvoiceSidebar />;
    case "payments":
      return <PaymentsSidebar />;
    case "cards":
      return <CardsSidebar />;
    default:
      return null;
  }
}
```

The shell sees one zone component. The module manages its own sub-navigation internally — the zone component is a regular React component and can render whatever it needs based on module state.

---

## Module Catalog

Modules can describe themselves with `meta` - a plain object with catalog metadata like name, description, icon, and category. The shell uses this for discovery UIs: directory pages, search, card grids.

Modules can also export a `component` - a React component the shell renders outside of routes, in tabs, panels, or modals. This is how workspace-style apps render modules without tying them to URL routes. See [Workspace Patterns](docs/workspace-patterns.md) for the full pattern.

### Declaring meta and component

The `meta` field accepts a `TMeta` generic for compile-time validation. Define a meta interface in your app-shared package:

```typescript
// app-shared/src/index.ts
export interface WorkflowMeta {
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly category: string;
  readonly estimatedTime?: string;
}
```

Then use it as the third generic on `defineModule`:

```typescript
import { defineModule } from "@tanstack-react-modules/core";
import { lazy } from "react";
import type { AppDependencies, AppSlots, WorkflowMeta } from "@myorg/app-shared";

export default defineModule<AppDependencies, AppSlots, WorkflowMeta>({
  id: "payments",
  version: "0.1.0",
  component: lazy(() => import("./PaymentsComponent.js")),
  meta: {
    name: "Set up Credit Card",
    description: "Configure a new Credit Card for payments",
    icon: "credit-card",
    category: "payments",
    estimatedTime: "2-3 mins",
  },
  requires: ["auth", "httpClient"],
});
```

TypeScript will error if `meta` is missing required fields or has typos. The `TMeta` generic defaults to `Record<string, unknown>` so existing modules without typed meta continue to work.

### Reading modules in the shell

Use `getModuleMeta<TMeta>()` to read metadata without casts:

```typescript
import { useModules, getModuleMeta } from '@tanstack-react-modules/runtime'
import type { WorkflowMeta } from '@myorg/app-shared'

function DirectoryPage() {
  const modules = useModules()
  const journeys = modules.filter((m) => {
    const meta = getModuleMeta<WorkflowMeta>(m)
    return meta?.category === 'payments'
  })

  return (
    <div>
      {journeys.map((mod) => {
        const meta = getModuleMeta<WorkflowMeta>(mod)!
        return (
          <Card key={mod.id}>
            <h3>{meta.name}</h3>
            <p>{meta.description}</p>
            <button onClick={() => openInTab(mod)}>Start</button>
          </Card>
        )
      })}
    </div>
  )
}
```

### Rendering a module in a tab

```typescript
function WorkspaceTab({ moduleId, context }: { moduleId: string; context: unknown }) {
  const modules = useModules()
  const mod = modules.find((m) => m.id === moduleId)

  if (!mod?.component) return <p>Module not found</p>
  const Component = mod.component
  return <Component {...context} />
}
```

### When to use meta vs navigation vs slots vs commands

| Data                                                  | Mechanism            | Why                                                             |
| ----------------------------------------------------- | -------------------- | --------------------------------------------------------------- |
| Sidebar links                                         | `navigation`         | Framework builds NavigationManifest with grouping/sorting       |
| Module-specific self-executing actions                | `slots.commands`     | "Create Invoice", "Export Report" - the module owns the handler |
| Tab types, badges, other aggregated data              | `slots`              | Aggregated arrays from all modules                              |
| Module identity for directory/catalog/command palette | `meta`               | Per-module descriptive data for discovery UIs                   |
| Route-specific panel/header content                   | `staticData` (zones) | Changes per route within a module                               |
| Tab-active panel/header content                       | Descriptor `zones`   | Shown when the module's tab is active                           |

**Key rule:** Every command must have an `onSelect` handler - the module owns its actions. Don't use `slots.commands` for things the shell handles: journey launching comes from `meta` (discovered via `useModules()`), navigation comes from `navigation` entries, and system launching comes from domain-specific slots. If the module can't execute the action itself, it belongs in a different mechanism.

### Accessing modules outside the manifest

The `modules` array is also available on the `ApplicationManifest` returned by `registry.resolve()`:

```typescript
const { App, modules } = registry.resolve({ ... })
// modules: ModuleEntry[] - same data useModules() returns
```

---

## Cross-Module Communication

Modules communicate through **shared Zustand stores** (for reactive state), **React Query cache invalidation** (for server data), and **shared services** (for imperative actions). No custom event bus is needed.

### Via shared services (imperative actions)

When modules need to trigger actions that cross module boundaries, define a service interface in `AppDependencies`. The shell provides the implementation, modules consume it via `useService`:

```typescript
// app-shared/src/index.ts
export interface NotificationService {
  show: (message: string, severity?: "info" | "warning" | "error") => void;
  dismiss: (id: string) => void;
}

export interface AppDependencies {
  auth: AuthStore;
  httpClient: Wretch;
  notifications: NotificationService;
}
```

```typescript
// Inside any module component
import { useService } from '@myorg/app-shared'

function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const notifications = useService('notifications')

  async function handlePayment() {
    await processPayment(invoiceId)
    notifications.show('Payment processed successfully')
  }

  return <button onClick={handlePayment}>Pay Invoice</button>
}
```

The service pattern works for any imperative cross-cutting concern: notifications, analytics, feature flags, modals. Define the interface in app-shared, implement in the shell, consume via `useService`.

**Rule of thumb:** Zustand stores hold **reactive state** (what's selected, what's visible, user data). Services provide **imperative actions** (show a notification, track an event, send a message). Don't put action methods on stores.

### Via shared stores (reactive state)

When one module changes a Zustand store, all components in other modules that subscribe to that store automatically re-render:

```typescript
// Users module - updates the auth store
import { useStore } from '@example/app-shared'

function UserSettings() {
  const logout = useStore('auth', (s) => s.logout)
  return <button onClick={logout}>Log Out</button>
}

// Billing module - reacts to auth changes automatically
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
// Users module - deactivates a user and invalidates related queries
import { useMutation, useQueryClient } from "@tanstack/react-query";

function UserDetail() {
  const httpClient = useService("httpClient");
  const queryClient = useQueryClient();

  const deactivate = useMutation({
    mutationFn: (userId: string) =>
      sendByContract(httpClient, deactivateUserContract, { pathParams: { userId } }),
    onSuccess: () => {
      // Both the users module and billing module will refetch their data
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
```

### When to use which

| Pattern                  | Use case                                            | Example                                       |
| ------------------------ | --------------------------------------------------- | --------------------------------------------- |
| Zustand store            | Client state changes that affect UI across modules  | Auth state, feature flags, UI preferences     |
| React Query invalidation | Server data changes that other modules also display | User deactivated → billing data needs refresh |

---

## Scoped Stores

`createScopedStore` creates a `Map<string, StoreApi<T>>` with lazy initialization - each scope key gets its own independent Zustand store, created on first access.

Use this for **per-entity state**: per-session tabs, per-conversation messages, per-workspace notes - anywhere you have a dynamic collection of entities that each need independent state.

### The problem

Without scoped stores, per-entity state means a `Record<string, T>` inside a single store, with every operation manually scoping to the right key:

```typescript
// Before: manual scoping - repeated for every entity concern
const useShellStore = create((set, get) => ({
  tabsByInteraction: {} as Record<string, TabState>,

  openTab: (interactionId: string, tab: Tab) =>
    set((state) => {
      const current = state.tabsByInteraction[interactionId] ?? defaultTabState();
      return {
        tabsByInteraction: {
          ...state.tabsByInteraction,
          [interactionId]: { ...current, tabs: [...current.tabs, tab] },
        },
      };
    }),

  // ... 30 more lines of the same pattern for closeTab, switchTab, etc.
}));
```

This boilerplate multiplies with every scoped concern - tabs, notes, workflow state, etc.

### The solution

```typescript
import { createScopedStore } from "@tanstack-react-modules/core";

// Define once - each interaction gets its own independent store
const tabState = createScopedStore<TabState>(() => ({
  tabs: [createDirectoryTab()],
  activeTabId: "directory",
}));
```

### In React components

```typescript
function Workspace({ interactionId }: { interactionId: string }) {
  // Subscribe to this interaction's tab state - re-renders only when it changes
  const { tabs, activeTabId } = tabState.useScoped(interactionId)

  // With selector - re-renders only when tabs change, not activeTabId
  const tabs = tabState.useScoped(interactionId, (s) => s.tabs)

  return <TabStrip tabs={tabs} activeTabId={activeTabId} />
}
```

### Imperative access (actions, event handlers, outside React)

```typescript
function openTab(interactionId: string, tab: Tab) {
  const store = tabState.getOrCreate(interactionId);
  store.setState((prev) => ({
    tabs: [...prev.tabs, tab],
    activeTabId: tab.id,
  }));
}

function closeTab(interactionId: string, tabId: string) {
  const store = tabState.getOrCreate(interactionId);
  store.setState((prev) => {
    const newTabs = prev.tabs.filter((t) => t.id !== tabId);
    return {
      tabs: newTabs,
      activeTabId: prev.activeTabId === tabId ? (newTabs[0]?.id ?? "directory") : prev.activeTabId,
    };
  });
}

// Cleanup when an interaction ends
tabState.remove(interactionId);
```

### API

```typescript
const scoped = createScopedStore<TState>(initializer: () => TState)

scoped.getOrCreate(scopeId)        // StoreApi<TState> - lazy create on first access
scoped.has(scopeId)                // boolean
scoped.remove(scopeId)             // dispose a scope
scoped.clear()                     // dispose all scopes
scoped.useScoped(scopeId)          // React hook - full state
scoped.useScoped(scopeId, selector) // React hook - selected slice
```

### When to use scoped stores vs regular stores

| Pattern                               | Use when                                                                |
| ------------------------------------- | ----------------------------------------------------------------------- |
| Regular Zustand store (`createStore`) | Singleton state shared across the app (auth, config, UI panels)         |
| Scoped store (`createScopedStore`)    | Per-entity state with dynamic keys (per-interaction, per-tab, per-user) |

---

## React Compiler

React Compiler is a build-time tool that automatically optimizes React components by inserting memoization where needed. This is particularly valuable in a modular architecture where components are composed dynamically across package boundaries.

### Why it matters for tanstack-react-modules

In a module-based app, the shell composes a deep provider tree and modules are loaded lazily. Without memoization, a state change in one provider (e.g., auth store) could trigger unnecessary re-renders down through the entire tree. Traditionally you'd prevent this with manual `React.memo()`, `useMemo()`, and `useCallback()` - but this is tedious and error-prone across independently developed modules.

React Compiler eliminates this problem automatically. It analyzes your components at build time and inserts fine-grained memoization, so:

- Module components don't need `React.memo()` wrappers
- Callbacks passed to child components are automatically stable
- Selectors in `useStore('auth', (s) => s.user)` benefit from stable references
- Independently developed modules get optimal re-render behavior without coordination

### How to enable

Enable React Compiler in each shell's Vite config via `@rolldown/plugin-babel`:

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
});
```

The compiler runs at the shell level during bundling, so it optimizes both shell code and all imported module code. Individual module packages don't need their own compiler setup.

### Compatibility

React Compiler requires React 19. All tanstack-react-modules framework packages target React 19 as a peer dependency.

The framework's hooks (`useStore`, `useService`, `useNavigation`) follow React's rules of hooks and are fully compatible with the compiler. Avoid patterns the compiler cannot optimize:

- Don't mutate variables between renders
- Don't call hooks conditionally
- Don't read or write refs during render

See the [React Compiler documentation](https://react.dev/learn/react-compiler) for the full list of requirements.

---

## Testing Modules

`@tanstack-react-modules/testing` provides `renderModule()` to test a module in isolation with mocked dependencies. It supports both route-based modules and component-only modules.

### Route-based module

```typescript
import { renderModule, createMockStore } from "@tanstack-react-modules/testing";
import billing from "@example/billing-module";
import type { AuthStore } from "@example/app-shared";
import wretch from "wretch";

test("billing dashboard shows user name", async () => {
  const result = await renderModule(billing, {
    route: "/billing",
    deps: {
      auth: createMockStore<AuthStore>({
        user: { id: "1", name: "Test User", email: "test@example.com", role: "admin" },
        token: "mock-token",
        isAuthenticated: true,
        login: async () => {},
        logout: () => {},
      }),
      httpClient: wretch("http://localhost:3000"),
    },
  });

  expect(result.getByText("Test User")).toBeDefined();
});
```

### Component-only module

Modules that use `component` instead of `createRoutes` (workspace-style journeys, panels) are rendered directly inside the provider tree - no router needed:

```typescript
import { renderModule, createMockStore } from "@tanstack-react-modules/testing";
import paymentsModule from "@myorg/module-payments";
import type { AuthStore } from "@myorg/app-shared";

test("payments renders and completes", async () => {
  const onComplete = vi.fn();

  const result = await renderModule(paymentsModule, {
    deps: {
      auth: createMockStore<AuthStore>({
        isAuthenticated: true,
        session: { name: "Test", email: "test@example.com" },
        isLoading: false,
        checkSession: async () => {},
        logout: () => {},
      }),
      httpClient: { get: vi.fn() },
    },
    props: {
      customerId: "C001",
      onComplete,
      onCancel: vi.fn(),
    },
  });

  expect(result.getByText("Set up Credit Card")).toBeDefined();
});
```

`useModules()` works inside components rendered by `renderModule` - the test wrapper provides a `ModulesContext` containing the module under test.

### createMockStore

Creates a zustand store pre-populated with the given state:

```typescript
const authStore = createMockStore<AuthStore>({
  user: null,
  token: null,
  isAuthenticated: false,
  login: async () => {},
  logout: () => {},
});
```

### renderModule options

| Option  | Description                                                                                                      |
| ------- | ---------------------------------------------------------------------------------------------------------------- |
| `route` | Initial route to navigate to (default: `'/'`). Only used for route-based modules.                                |
| `deps`  | Partial map of shared dependencies. `StoreApi` values go to stores context, plain values go to services context. |
| `props` | Props passed to the module's `component`. Only used for component-only modules.                                  |
| `slots` | Mock slot data available via `useSlots()` in the test.                                                           |

---

## Lazy Loading Modules

For large modules that shouldn't be in the initial bundle:

```typescript
registry.registerLazy({
  id: "admin",
  basePath: "/admin",
  load: () => import("@example/admin-module"),
});
```

The module's code is only loaded when the user first navigates to `/admin/*`.

---

## Project Structure

```
tanstack-react-modules/
├── packages/
│   ├── cli/                     # @tanstack-react-modules/cli - project scaffolding CLI
│   ├── core/                    # @tanstack-react-modules/core - module types, hooks, defineModule()
│   ├── registry/                # @tanstack-react-modules/runtime - composition, validation, providers
│   └── testing/                 # @tanstack-react-modules/testing - test harness
├── examples/
│   ├── app-shared/              # @example/app-shared - types, hooks, API contracts
│   ├── shell/                   # Example host app (Vite 8 + React Compiler)
│   └── modules/
│       ├── billing/             # @example/billing-module
│       └── users/               # @example/users-module
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.json
```

### Framework packages

| Package                           | Purpose                                                                                   | Size           |
| --------------------------------- | ----------------------------------------------------------------------------------------- | -------------- |
| `@tanstack-react-modules/core`    | Module types, `defineModule()`, `createSharedHooks()`                                     | ~1 KB          |
| `@tanstack-react-modules/runtime` | `createRegistry()`, route composition, validation, navigation manifest, `useNavigation()` | ~5.6 KB        |
| `@tanstack-react-modules/testing` | `renderModule()`, `createMockStore()`                                                     | ~1 KB          |
| `@tanstack-react-modules/cli`     | `reactive init`, `reactive create module`, `reactive create store`                        | N/A (Node CLI) |

### Building packages

Framework packages use Vite 8 library mode (ESM only):

```bash
pnpm build                    # Build all packages + shell
pnpm --filter @tanstack-react-modules/core build   # Build a single package
pnpm --filter shell dev       # Run example shell in dev mode
```

---

## AI Skills

This project ships AI coding skills in the `skills/` directory, following the [skills-npm](https://github.com/antfu/skills-npm) convention. Skills are structured instructions that help AI coding assistants (Claude Code, Cursor, Copilot, etc.) perform framework-specific tasks correctly — creating modules, wiring dependencies, writing tests, and so on.

The `@tanstack-react-modules/skills` package declares the following skills:

| Skill                      | Description                                                                |
| -------------------------- | -------------------------------------------------------------------------- |
| `create-module`            | Scaffold a new module with routes, navigation, and page components         |
| `register-module`          | Wire an existing module into the shell host app                            |
| `wire-shared-dependencies` | Add a zustand store, plain service, or reactive service to AppDependencies |
| `add-slots`                | Define slot types, contribute items from modules, consume via `useSlots()` |
| `add-zones`                | Add dynamic layout regions that modules populate per-route or per-tab      |
| `add-scoped-store`         | Create per-entity state with `createScopedStore()` (tabs, conversations)   |
| `add-api-query`            | Add data fetching with React Query, HTTP client, and API contracts         |
| `test-module`              | Write tests with `renderModule()`, `resolveModule()`, `createMockStore()`  |

Each skill lives in `skills/<skill-name>/SKILL.md` and contains step-by-step instructions with code templates, rules, and framework conventions.

### Using skills

If your AI assistant supports [skills-npm](https://github.com/antfu/skills-npm), install and link them automatically:

```bash
npx skills-npm
```

This scans `node_modules` for packages with skills and symlinks them into your project's `skills/` directory for agent discovery.

---

## CLI Reference

`@tanstack-react-modules/cli` provides commands for scaffolding projects, modules, and stores. All commands support both interactive (prompts) and non-interactive (flags) modes.

### reactive init

Create a new project with shell, app-shared, and a first module.

```bash
# Interactive
reactive init my-app

# Non-interactive (CI-friendly)
reactive init my-app --scope @myorg --module dashboard
```

| Flag       | Description                                |
| ---------- | ------------------------------------------ |
| `--scope`  | npm scope for all packages (e.g. `@myorg`) |
| `--module` | Name of the first module to create         |

### reactive create module

Add a new module to an existing project. Run from anywhere inside the project.

```bash
# Interactive
reactive create module

# Non-interactive
reactive create module billing --route billing --nav-group finance
```

| Flag          | Description                           |
| ------------- | ------------------------------------- |
| `--route`     | Route path (defaults to module name)  |
| `--nav-group` | Navigation group for sidebar grouping |

This command:

1. Scaffolds `modules/<name>/` with descriptor, two page components, package.json, tsconfig
2. Adds the module dependency to `shell/package.json`
3. Adds the import and `registry.register()` call to `shell/src/main.tsx`

### reactive create store

Add a new Zustand store and wire it into AppDependencies.

```bash
reactive create store notifications
```

This command:

1. Creates `shell/src/stores/<name>.ts` with a Zustand store skeleton
2. Adds the store interface to `AppDependencies` in `app-shared/src/index.ts`
3. Wires the store into `createRegistry()` in `shell/src/main.tsx`

---

## E2E Testing

Projects scaffolded by the CLI are ready for Playwright testing out of the box. Each module generates page components with semantic HTML (headings, links, buttons) that work naturally with Playwright's recommended locators.

### Setup

```bash
pnpm add -D @playwright/test
npx playwright install chromium
```

### Writing tests

Use Playwright's semantic locators (`getByRole`, `getByText`) instead of `data-testid` attributes:

```typescript
import { test, expect } from "@playwright/test";

test("navigates to billing module", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Billing" }).click();
  await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
});

test("login flow works", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /login/i }).click();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
});
```

### Running

```bash
# Start dev server in one terminal
pnpm dev

# Run tests in another
npx playwright test
```

---

## API Reference

### @tanstack-react-modules/core

| Export                              | Type     | Description                                                                                    |
| ----------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `defineModule(descriptor)`          | Function | Identity function for type inference. Returns descriptor unchanged.                            |
| `defineSlots(id, slots)`            | Function | Shorthand for headless modules that only contribute slots. No component, routes, or lifecycle. |
| `createSharedHooks<T>()`            | Function | Returns typed `{ useStore, useService, useReactiveService, useOptional }` hooks.               |
| `createScopedStore<T>(initializer)` | Function | Creates a per-key store factory with `getOrCreate`, `useScoped`, and `remove`.                 |
| `isStoreApi(value)`                 | Function | Duck-type check for zustand `StoreApi` instances.                                              |
| `isReactiveService(value)`          | Function | Duck-type check for `ReactiveService` instances (has `subscribe` + `getSnapshot`).             |
| `separateDeps(deps)`                | Function | Splits a flat deps record into `{ stores, services, reactiveServices }` buckets.               |
| `SharedDependenciesContext`         | Context  | React context holding stores, services, and reactive services. Used internally.                |
| `ReactiveModuleDescriptor<T, S>`    | Type     | Module descriptor shape. `T` = shared deps, `S` = slots.                                       |
| `LazyModuleDescriptor<T, S>`        | Type     | Lazy module descriptor shape.                                                                  |
| `NavigationItem`                    | Type     | Navigation entry shape. `icon` accepts `string \| React.ComponentType`.                        |
| `ModuleLifecycle<T>`                | Type     | Lifecycle hooks shape.                                                                         |
| `ReactiveService<T>`                | Type     | External source contract: `{ subscribe, getSnapshot }`. Used with `useSyncExternalStore`.      |
| `SlotMap`                           | Type     | Constraint type for slot definitions: `Record<string, readonly unknown[]>`.                    |
| `SlotMapOf<T>`                      | Type     | F-bounded constraint for slot types — accepts interfaces without index signatures.             |
| `ZoneMap`                           | Type     | Constraint type for zone definitions: `Record<string, ComponentType \| undefined>`.            |
| `ZoneMapOf<T>`                      | Type     | F-bounded constraint for zone types — accepts interfaces without index signatures.             |
| `ScopedStore<T>`                    | Type     | Return type of `createScopedStore`. Provides `getOrCreate`, `useScoped`, `remove`, `clear`.    |

### @tanstack-react-modules/runtime

| Export                                   | Type      | Description                                                                                   |
| ---------------------------------------- | --------- | --------------------------------------------------------------------------------------------- |
| `createRegistry<T, S>(config)`           | Function  | Creates a module registry. `T` = shared deps, `S` = slots. Config has `{ stores, services }`. |
| `buildSlotsManifest(modules, defaults?)` | Function  | Concatenates slot contributions from multiple modules. Used internally and by testing.        |
| `useNavigation()`                        | Hook      | Access the navigation manifest from any component inside `<App />`.                           |
| `useSlots<S>()`                          | Hook      | Access collected slot contributions from all modules.                                         |
| `useZones<Z>()`                          | Hook      | Access zone components from the currently matched route's `staticData`.                       |
| `useActiveZones<Z>(moduleId?)`           | Hook      | Merge route zones with the active module's descriptor zones. Module wins for same key.        |
| `useModules()`                           | Hook      | Access registered module summaries (id, version, meta, component).                            |
| `getModuleMeta<T>(entry)`                | Function  | Type-safe accessor for module metadata. Returns `T \| undefined`.                             |
| `SlotsContext`                           | Context   | React context holding the slots manifest. Used internally.                                    |
| `ModulesContext`                         | Context   | React context holding module entries. Used internally and by testing.                         |
| `ModuleErrorBoundary`                    | Component | Error boundary that isolates module-level crashes.                                            |
| `ReactiveRegistry<T, S>`                 | Type      | Registry interface with `register()`, `registerLazy()`, `resolve()`.                          |
| `RegistryConfig<T>`                      | Type      | Registry configuration shape.                                                                 |
| `ApplicationManifest<T, S>`              | Type      | Resolved app shape: `{ App, router, navigation, slots, modules }`.                            |
| `ModuleEntry`                            | Type      | `{ id, version, meta?, component?, zones? }`.                                                 |
| `NavigationManifest`                     | Type      | `{ items, groups, ungrouped }`.                                                               |
| `NavigationGroup`                        | Type      | `{ group, items }`.                                                                           |
| `ResolveOptions`                         | Type      | `{ rootComponent, indexComponent, notFoundComponent }`.                                       |

### @tanstack-react-modules/testing

| Export                            | Type     | Description                                                                                                               |
| --------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `renderModule(module, options)`   | Function | Render a module in isolation. Returns `@testing-library/react` RenderResult. Options include `deps` and optional `slots`. |
| `resolveModule(module, options?)` | Function | Resolve a module without rendering — runs slot merging and lifecycle hooks. For headless modules.                         |
| `createMockStore<T>(state)`       | Function | Create a zustand store pre-populated with given state.                                                                    |
| `RenderModuleOptions<T>`          | Type     | Options for `renderModule`: `{ route?, deps, slots?, props? }`.                                                           |
| `ResolveModuleOptions<T, S>`      | Type     | Options for `resolveModule`: `{ deps?, defaults? }`.                                                                      |
| `ResolveModuleResult<S>`          | Type     | Result of `resolveModule`: `{ slots, entry, onRegisterCalled }`.                                                          |
