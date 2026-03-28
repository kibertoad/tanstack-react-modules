# Shell Patterns

This guide covers patterns for building complex shell applications with the reactive framework. A "shell" is the host app that composes modules into a unified UI — from simple sidebar-and-content layouts to multi-zone dashboards like contact center agents or admin consoles.

## Multi-Zone Shell Layout

A basic shell has a sidebar and a content area. A complex shell has multiple zones — a mode rail, a customer banner, a workspace with tabs, a contextual panel, a scratchpad drawer.

### Defining layout zones

The shell's `rootComponent` owns the entire layout. Use CSS Grid to define zones, and populate them from navigation, slots, and shared stores:

```typescript
// shell/src/components/Layout.tsx
import { Outlet } from '@tanstack/react-router'
import { useNavigation, useSlots } from '@reactive-framework/registry'
import type { AppSlots } from '@myorg/app-shared'

export function Layout() {
  const navigation = useNavigation()
  const slots = useSlots<AppSlots>()

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '64px 280px 1fr 320px',
      gridTemplateRows: 'auto 1fr auto',
      minHeight: '100vh',
    }}>
      {/* Zone A: Mode rail — populated from navigation groups */}
      <ModeRail navigation={navigation} />

      {/* Zone B: Banner — driven by shared store state */}
      <CustomerBanner />

      {/* Zone C: Interaction list — driven by shared store */}
      <InteractionList />

      {/* Zone D: Main workspace — routes render here */}
      <main>
        <Outlet />
      </main>

      {/* Zone E: Contextual panel — populated from slots */}
      <ContextualPanel suggestions={slots.suggestions} />

      {/* Zone F: Scratchpad — driven by shared store */}
      <ScratchpadDrawer />
    </div>
  )
}
```

### Which mechanism for which zone

| Zone content | Source |
|---|---|
| Navigation links and mode switches | `useNavigation()` — modules declare `navigation` items |
| Commands, tab types, badges, panel content types | `useSlots()` — modules declare `slots` contributions |
| Route-specific UI for named layout regions (detail panel, header actions) | `useZones()` — active route declares `staticData` with component types |
| Active selection, panel visibility, tab state | Shared Zustand store — runtime state |
| Route-based page content | `<Outlet />` — TanStack Router renders the active module's routes |

## Workspace Tab Management

Many shells use a tabbed workspace where each tab renders different content — a directory page, an iframe, or a native component. Modules can register tab types via slots, and the shell manages tab state in a Zustand store.

### Define the slot types

```typescript
// app-shared/src/index.ts
import type { ComponentType } from 'react'

export interface TabTypeRegistration {
  readonly type: string
  readonly component: ComponentType<TabContentProps>
}

export interface TabContentProps {
  readonly tabId: string
  readonly metadata: Record<string, unknown>
}

export interface AppSlots {
  commands: CommandDefinition[]
  tabTypes: TabTypeRegistration[]
}
```

### Modules register tab types

```typescript
// modules/billing/src/index.ts
import { lazy } from 'react'

export default defineModule<AppDependencies, AppSlots>({
  id: 'billing',
  // ...
  slots: {
    tabTypes: [
      {
        type: 'billing-detail',
        component: lazy(() => import('./tabs/BillingDetailTab.js')),
      },
    ],
  },
})
```

### Shell manages tab state

```typescript
// app-shared/src/index.ts
export interface WorkspaceTab {
  id: string
  type: string        // matches a TabTypeRegistration.type
  title: string
  metadata: Record<string, unknown>
  closeable: boolean
}

export interface ShellStore {
  tabs: WorkspaceTab[]
  activeTabId: string | null
  openTab: (tab: WorkspaceTab) => void
  closeTab: (tabId: string) => void
  switchTab: (tabId: string) => void
}
```

### Shell renders tabs from slots

```typescript
import { useSlots } from '@reactive-framework/registry'
import { useStore } from '@myorg/app-shared'
import type { AppSlots } from '@myorg/app-shared'

function Workspace() {
  const { tabTypes } = useSlots<AppSlots>()
  const tabs = useStore('shell', (s) => s.tabs)
  const activeTabId = useStore('shell', (s) => s.activeTabId)

  const activeTab = tabs.find((t) => t.id === activeTabId)
  const registration = tabTypes.find((r) => r.type === activeTab?.type)

  return (
    <div>
      <TabStrip tabs={tabs} activeTabId={activeTabId} />
      {activeTab && registration && (
        <registration.component tabId={activeTab.id} metadata={activeTab.metadata} />
      )}
    </div>
  )
}
```

## Command Palette Pattern

A command palette aggregates entries from multiple framework sources into a single searchable overlay. Each source serves a distinct purpose:

| Source | What it provides | Example |
|---|---|---|
| `useSlots().systems` | Iframe-based external systems | "Open Salesforce" |
| `useModules()` + `getModuleMeta()` | Journey/component modules | "Set up Direct Debit" |
| `useSlots().commands` | Module-specific actions | "Create New Invoice" |
| `useNavigation()` | Route-based navigation | "Go to Billing Dashboard" |

### Define the command slot

Commands are always self-executing — the module provides `onSelect` and the shell calls it:

```typescript
// app-shared/src/index.ts
export interface CommandDefinition {
  readonly id: string
  readonly label: string
  readonly group?: string
  readonly icon?: string
  readonly shortcut?: string
  readonly onSelect: () => void
}

export interface AppSlots {
  commands: CommandDefinition[]
}
```

### When to use commands vs other mechanisms

`slots.commands` is for actions the module can execute itself. Don't use it for:
- **Journey launching** — use `meta` instead, the shell discovers journeys via `useModules()`
- **Navigation** — use `navigation` on the module descriptor
- **System launching** — use a domain-specific slot (e.g. `slots.systems`)

```typescript
export default defineModule<AppDependencies, AppSlots>({
  id: 'billing',
  slots: {
    commands: [
      // Module owns the action — it knows what to do
      { id: 'billing:new-invoice', label: 'Create New Invoice', group: 'actions',
        onSelect: () => { /* open modal, navigate, etc. */ } },
    ],
  },
  // Sidebar link — framework builds NavigationManifest
  navigation: [{ label: 'Billing', to: '/billing', group: 'finance' }],
  // Discovery in directory/command palette — shell reads via useModules()
  meta: { name: 'Billing', category: 'finance', icon: 'CreditCard' },
})
```

### How modules trigger workspace actions

Modules should never import store instances directly. Instead, expose a workspace actions service via `AppDependencies`:

```typescript
// app-shared/src/index.ts
export interface WorkspaceActions {
  openModuleTab: (moduleId: string) => void
  openSectionTab: (sectionId: string) => void
}

export interface AppDependencies {
  // ...stores and other services...
  workspace: WorkspaceActions
}
```

The shell provides the implementation (wiring to its internal workspace store). Modules only know the interface:

```typescript
import { useService } from '@myorg/app-shared'

function InvoiceActions({ invoiceId }: { invoiceId: string }) {
  const workspace = useService('workspace')

  return (
    <button onClick={() => workspace.openModuleTab('payments')}>
      Pay Invoice
    </button>
  )
}
```

This applies to any app-specific imperative action. A workspace app might expose `openModuleTab` and `openSectionTab`. A CMS might expose `openEditor` and `publishDraft`. The pattern is the same: define the interface in app-shared, implement in the shell, consume via `useService`.

### What about `onSelect` handlers that need shell context?

`slots.commands` is for actions the module owns end-to-end: opening a module-internal modal, calling an API, exporting data. If a command needs shell actions, the module can capture `deps.shell` from `lifecycle.onRegister`:

```typescript
let workspace: WorkspaceActions

export default defineModule<AppDependencies, AppSlots>({
  id: 'billing',
  lifecycle: {
    onRegister(deps) {
      workspace = deps.workspace
    },
  },
  slots: {
    commands: [{
      id: 'billing:quick-payment',
      label: 'Quick Payment',
      group: 'actions',
      onSelect: () => workspace.openModuleTab('payment-wizard'),
    }],
  },
})
```

For most cases, prefer using `useService('shell')` inside a component over `onRegister` capture. The command palette, directory page, and workspace rendering are all handled by the shell via `useModules()` and `meta` — modules rarely need to open tabs programmatically from `onSelect`.

### Decision guide for module-to-shell actions

| "I want to..." | Use |
|---|---|
| Appear in the directory/command palette | `meta` — shell discovers via `useModules()` |
| Add a sidebar link | `navigation` on module descriptor |
| Open another module's tab from a component | `useService('workspace').openModuleTab(id)` |
| Navigate to a section | `useService('workspace').openSectionTab(id)` |
| Contribute a self-contained action | `slots.commands` with `onSelect` |

### Shell renders the palette

The shell aggregates all sources. Journey modules appear via `useModules()`, not `slots.commands`:

```typescript
import { useSlots, useModules, getModuleMeta, useNavigation } from '@reactive-framework/registry'
import type { AppSlots, JourneyMeta } from '@myorg/app-shared'

function CommandPalette({ search }: { search: string }) {
  const { systems, commands } = useSlots<AppSlots>()
  const modules = useModules()
  const navigation = useNavigation()

  // Journey modules from catalog
  const journeys = modules
    .filter((m) => m.component && getModuleMeta<JourneyMeta>(m)?.category)
    .map((m) => ({ entry: m, meta: getModuleMeta<JourneyMeta>(m)! }))

  // Module-contributed commands (self-executing actions)
  const grouped = Map.groupBy(commands, (cmd) => cmd.group ?? 'other')

  return (
    <div>
      {/* Systems from slots */}
      {systems.map((sys) => (
        <button key={sys.id} onClick={() => openSystem(sys)}>{sys.name}</button>
      ))}

      {/* Journey modules from catalog */}
      {journeys.map(({ entry, meta }) => (
        <button key={entry.id} onClick={() => openJourney(entry, meta)}>{meta.name}</button>
      ))}

      {/* Module-contributed actions */}
      {[...grouped.entries()].map(([group, items]) => (
        <div key={group}>
          <h3>{group}</h3>
          {items.map((cmd) => (
            <button key={cmd.id} onClick={cmd.onSelect}>{cmd.label}</button>
          ))}
        </div>
      ))}

      {/* Navigation from module descriptors */}
      {navigation.items.map((item) => (
        <button key={item.to} onClick={() => navigate(item.to)}>{item.label}</button>
      ))}
    </div>
  )
}
```

## Auth Guard Pattern

The registry follows TanStack Router's recommended `_authenticated` layout route pattern. Auth guards live on a layout route that wraps protected routes, while public routes (login, signup) sit outside the boundary.

### Layout route as auth boundary (recommended)

Use `authenticatedRoute` to create a layout route that guards all module routes and the index route. Shell routes sit outside the boundary:

```typescript
const { App } = registry.resolve({
  rootComponent: RootLayout,
  indexComponent: DashboardPage,

  // Auth boundary — guards module routes and index
  authenticatedRoute: {
    beforeLoad: async () => {
      const res = await fetch('/api/auth/session')
      if (!res.ok) throw redirect({ to: '/login' })
    },
    component: ShellLayout, // optional — defaults to <Outlet />
  },

  // Public routes — outside the auth boundary
  shellRoutes: (root) => [
    createRoute({ getParentRoute: () => root, path: '/login', component: LoginPage }),
    createRoute({ getParentRoute: () => root, path: '/signup', component: SignupPage }),
  ],

  // Runs for ALL routes (including /login) — use for observability, not auth
  beforeLoad: ({ location }) => {
    analytics.trackPageView(location.pathname)
  },
})
```

This produces the route tree:
```
Root (beforeLoad: observability — runs for all routes)
├── /login (public — no auth guard)
├── /signup (public — no auth guard)
└── _authenticated (layout — auth guard protects children)
    ├── / (DashboardPage)
    └── /billing, /users, etc. (module routes)
```

The separation is structural: `beforeLoad` on root is for logic that runs everywhere (observability, feature flags), while `authenticatedRoute.beforeLoad` is strictly for auth.

### Guard in individual module routes

For per-module auth or role-based access, guard at the module level:

```typescript
export default defineModule<AppDependencies, AppSlots>({
  id: 'admin',
  createRoutes: (parentRoute) => {
    const root = createRoute({
      getParentRoute: () => parentRoute,
      path: 'admin',
      beforeLoad: () => {
        // Access auth store directly (not via hook — this runs outside React)
        const { role } = authStore.getState()
        if (role !== 'admin') throw redirect({ to: '/' })
      },
    })
    // ... child routes
  },
})
```

Note: `beforeLoad` runs outside the React tree, so you access stores via `store.getState()` rather than hooks.

## Module-to-Shell Communication

There are four communication channels. Choose based on what kind of data you're passing:

### Slots: static declarations at registration time

Use for things that don't change at runtime — what tab types exist, what commands are available, what badge types a module supports.

```typescript
// Module declares once at registration
slots: {
  commands: [{ id: 'billing:export', label: 'Export Report', onSelect: () => downloadReport() }],
  tabTypes: [{ type: 'invoice', component: InvoiceTab }],
}
```

The shell reads these via `useSlots()`. They're collected at `resolve()` time and never change.

### Shared stores: runtime state

Use for things that change during the app's lifetime — which tab is active, what notifications are pending, whether the sidebar is collapsed.

```typescript
// Any module can update the shell store
const openTab = useStore('shell', (s) => s.openTab)
openTab({ id: 'inv-123', type: 'invoice', title: 'Invoice #123', metadata: { invoiceId: '123' }, closeable: true })
```

Both the module triggering the change and the shell rendering it subscribe to the same Zustand store.

### React Query: server data

Use for data fetched from APIs. React Query handles caching, deduplication, and background refetching.

```typescript
// Module A invalidates, Module B auto-refetches
queryClient.invalidateQueries({ queryKey: ['invoices'] })
```

### Zones: per-route UI contributions

Use for UI components that the currently active route wants rendered in shell layout regions — a detail sidebar, header actions, a contextual panel. Unlike slots (static, from all modules), zones change on every navigation and come from the active route only.

```typescript
// Module sets zones via TanStack Router's staticData on individual routes
const userDetail = createRoute({
  getParentRoute: () => usersRoot,
  path: '$userId',
  component: UserDetailPage,
  staticData: {
    detailPanel: UserDetailSidebar,
    headerActions: UserDetailActions,
  },
})
```

The shell reads them via `useZones()`:

```typescript
import { useZones } from '@reactive-framework/registry'
import type { AppZones } from '@myorg/app-shared'

function Layout() {
  const zones = useZones<AppZones>()
  const DetailPanel = zones.detailPanel

  return (
    <div style={{ display: 'flex' }}>
      <main><Outlet /></main>
      {DetailPanel && <DetailPanel />}
    </div>
  )
}
```

Deeper routes override shallower ones. A billing section root can set a default sidebar, and the invoice detail page can replace it. Routes that don't set `staticData` contribute no zones — the shell renders nothing in those regions.

### Decision guide

| Question | Answer |
|---|---|
| Is it known at module registration time? | Slots |
| Does it vary per route within a module? | Zones |
| Does it change at runtime? | Shared store |
| Does it come from an API? | React Query |
| Does it need to trigger re-renders across modules? | Shared store (Zustand subscriptions) or React Query (cache invalidation) |

## Cross-Store Coordination

When you split a monolith Zustand store into focused stores, you'll often need one store to react to changes in another. Use Zustand's built-in `subscribe` API — it's the idiomatic pattern and requires no framework involvement.

### The pattern

```typescript
// stores/workspace-tabs.ts
import { interactionsStore } from './interactions-store'
import { workspaceTabsStore } from './workspace-tabs-store'

// React to interaction changes — initialize tab state for new interactions
interactionsStore.subscribe((state, prev) => {
  if (state.activeInteractionId === prev.activeInteractionId) return
  const id = state.activeInteractionId
  if (!id) return

  const tabs = workspaceTabsStore.getState()
  if (!tabs.tabStateByInteraction[id]) {
    workspaceTabsStore.setState({
      tabStateByInteraction: {
        ...tabs.tabStateByInteraction,
        [id]: createDefaultTabState(),
      },
    })
  }
})
```

Key points:
- `subscribe` receives `(currentState, previousState)` — compare to avoid redundant work.
- Place the subscription in the file of the store that **reacts**, not the one that **triggers**. This keeps the triggering store unaware of its dependents.
- Top-level subscriptions (outside React) live for the app's lifetime. That's fine for shell stores.
- For cleanup, `subscribe` returns an unsubscribe function: `const unsub = store.subscribe(...); unsub()`.

### When to use subscribe vs useEffect

| Situation | Use |
|---|---|
| Store A reacts to Store B, both are app-level singletons | `store.subscribe()` at module top level |
| Component needs to react to a store change with a side effect | `useEffect` + `useStore` selector inside the component |
| Module lifecycle setup that reads store state once | `onRegister(deps)` — receives a state snapshot |

### Module-scoped subscriptions

If a module sets up a subscription during its lifecycle, clean it up on unmount:

```typescript
defineModule({
  id: 'billing',
  lifecycle: {
    onMount(deps) {
      // Subscribe to auth changes
      this._unsub = authStore.subscribe((state) => {
        if (!state.isAuthenticated) cleanup()
      })
    },
    onUnmount() {
      this._unsub?.()
    },
  },
})
```

### What NOT to build

Don't add event buses, custom pub/sub, or `connectStores()` helpers. Zustand's `subscribe` already provides exactly the right primitive. Adding an abstraction on top would hide what's happening and make debugging harder. If you find yourself wanting an event bus, that's a signal that the cross-cutting concern should be modeled as a shared store instead.

## Building Workspace Apps

Some applications are not traditional page-navigated SPAs. Contact center agent desktops, trading platforms, and admin consoles use a **workspace pattern**: a persistent shell with tabbed workspaces, contextual panels, and per-session state. This section describes how to build workspace-style apps with the reactive framework — using its existing primitives without custom abstractions.

### Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│  Shell Layout (rootComponent)                               │
│                                                             │
│  ┌──────┐ ┌──────────────────────────────────┐ ┌─────────┐ │
│  │ Mode │ │ Workspace                        │ │ Detail  │ │
│  │ Rail │ │ ┌──────────────────────────────┐  │ │ Panel   │ │
│  │      │ │ │ Tab Strip                    │  │ │         │ │
│  │ nav  │ │ ├──────────────────────────────┤  │ │ zones.  │ │
│  │ items│ │ │                              │  │ │ detail  │ │
│  │      │ │ │  Active Tab Content          │  │ │ Panel   │ │
│  │      │ │ │  (module component or        │  │ │         │ │
│  │      │ │ │   <Outlet /> for routes)     │  │ │         │ │
│  │      │ │ │                              │  │ │         │ │
│  │      │ │ └──────────────────────────────┘  │ │         │ │
│  └──────┘ └──────────────────────────────────┘ └─────────┘ │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Scratchpad Drawer                                       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

The shell owns the layout. Modules contribute content through four channels:

| What | Mechanism | Example |
|---|---|---|
| Navigation items | `navigation` on module descriptor | Mode rail links, sidebar items |
| Global contributions | `slots` on module descriptor | Command palette entries, tab type registrations |
| Route-specific panels | `staticData` on routes (zones) | Detail panel, header actions for the active page |
| Runtime state | Shared Zustand stores | Active tab, interaction state, panel visibility |

### Step 1: Define the contracts in app-shared

```typescript
// app-shared/src/index.ts
import { createSharedHooks } from '@reactive-framework/core'
import type { ComponentType } from 'react'

// ---- Zones (per-route layout regions) ----

export interface AppZones {
  /** Contextual panel on the right side of the workspace */
  detailPanel?: ComponentType
  /** Actions rendered in the header bar */
  headerActions?: ComponentType
  /** Content for the bottom drawer */
  drawerContent?: ComponentType
}

// Type-safe staticData across all modules
declare module '@tanstack/router-core' {
  interface StaticDataRouteOption extends AppZones {}
}

// ---- Slots (global contributions from all modules) ----

export interface CommandDefinition {
  readonly id: string
  readonly label: string
  readonly group?: string
  readonly onSelect: () => void
}

export interface TabTypeRegistration {
  readonly type: string
  readonly component: ComponentType<TabContentProps>
}

export interface TabContentProps {
  readonly tabId: string
  readonly metadata: Record<string, unknown>
}

export interface AppSlots {
  commands: CommandDefinition[]
  tabTypes: TabTypeRegistration[]
}

// ---- Shared dependencies ----

export interface AppDependencies {
  auth: AuthStore
  config: ConfigStore
  workspace: WorkspaceStore
  httpClient: Wretch
}

// ---- Typed hooks ----

export const { useStore, useService } = createSharedHooks<AppDependencies>()
```

### Step 2: Workspace state in a Zustand store

The tab/workspace system is **shell-owned state**, not a framework concern. Use a plain Zustand store:

```typescript
// shell/src/stores/workspace.ts
import { createStore } from 'zustand/vanilla'

export interface WorkspaceTab {
  id: string
  type: string        // matches a TabTypeRegistration.type from slots
  title: string
  metadata: Record<string, unknown>
  closeable: boolean
}

export interface WorkspaceStore {
  tabs: WorkspaceTab[]
  activeTabId: string | null
  openTab: (tab: WorkspaceTab) => void
  closeTab: (tabId: string) => void
  switchTab: (tabId: string) => void
}

export const workspaceStore = createStore<WorkspaceStore>((set, get) => ({
  tabs: [],
  activeTabId: null,

  openTab: (tab) => {
    const existing = get().tabs.find((t) => t.id === tab.id)
    if (existing) {
      set({ activeTabId: tab.id })
      return
    }
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
  },

  closeTab: (tabId) =>
    set((s) => {
      const newTabs = s.tabs.filter((t) => t.id !== tabId)
      return {
        tabs: newTabs,
        activeTabId: s.activeTabId === tabId
          ? newTabs[0]?.id ?? null
          : s.activeTabId,
      }
    }),

  switchTab: (tabId) => set({ activeTabId: tabId }),
}))
```

### Step 3: Modules contribute tab types via slots

Each module registers what tab types it can render. The shell uses this to look up the correct component when a tab is opened:

```typescript
// modules/billing/src/index.ts
import { lazy } from 'react'

export default defineModule<AppDependencies, AppSlots>({
  id: 'billing',
  version: '0.1.0',

  createRoutes: (parentRoute) => {
    const root = createRoute({
      getParentRoute: () => parentRoute,
      path: 'billing',
      component: BillingDashboard,
      staticData: {
        detailPanel: BillingOverviewPanel,
      },
    })

    const invoiceDetail = createRoute({
      getParentRoute: () => root,
      path: 'invoices/$invoiceId',
      component: InvoiceDetail,
      staticData: {
        detailPanel: InvoiceDetailPanel,   // overrides parent zone
        headerActions: InvoiceActions,
      },
    })

    return root.addChildren([invoiceDetail])
  },

  slots: {
    commands: [
      { id: 'billing:open', label: 'Open Billing', onSelect: () => {} },
    ],
    tabTypes: [
      {
        type: 'invoice-detail',
        component: lazy(() => import('./tabs/InvoiceDetailTab.js')),
      },
    ],
  },

  navigation: [
    { label: 'Billing', to: '/billing', group: 'finance', order: 10 },
  ],
})
```

### Step 4: Shell layout with zones

The shell defines the layout once. New modules contribute content without touching the shell:

```typescript
// shell/src/components/Layout.tsx
import { Outlet } from '@tanstack/react-router'
import { useNavigation, useSlots, useZones } from '@reactive-framework/registry'
import { useStore } from '@myorg/app-shared'
import type { AppZones, AppSlots } from '@myorg/app-shared'

export function Layout() {
  const navigation = useNavigation()
  const slots = useSlots<AppSlots>()
  const zones = useZones<AppZones>()

  const DetailPanel = zones.detailPanel
  const HeaderActions = zones.headerActions
  const DrawerContent = zones.drawerContent

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '64px 1fr 320px',
      gridTemplateRows: 'auto 1fr auto',
      minHeight: '100vh',
    }}>
      {/* Mode rail — from navigation */}
      <ModeRail navigation={navigation} />

      {/* Header — with route-specific actions from zones */}
      <header style={{ gridColumn: '2 / -1' }}>
        <CustomerBanner />
        {HeaderActions && <HeaderActions />}
        <CommandPalette commands={slots.commands} />
      </header>

      {/* Main workspace — routes render here */}
      <main style={{ gridColumn: '2' }}>
        <Outlet />
      </main>

      {/* Contextual panel — from zones (active route decides content) */}
      {DetailPanel && (
        <aside style={{ gridColumn: '3' }}>
          <DetailPanel />
        </aside>
      )}

      {/* Drawer — from zones */}
      {DrawerContent && (
        <footer style={{ gridColumn: '1 / -1' }}>
          <DrawerContent />
        </footer>
      )}
    </div>
  )
}
```

### Step 5: Directory page from module catalog

The shell builds a browsable directory of available features using `useModules()` and `getModuleMeta()`:

```typescript
// app-shared/src/index.ts
export interface JourneyMeta {
  readonly name: string
  readonly description: string
  readonly icon: string
  readonly category: string
  readonly estimatedTime?: string
}
```

```typescript
// shell/src/components/DirectoryPage.tsx
import { useModules, getModuleMeta } from '@reactive-framework/registry'
import { useStore } from '@myorg/app-shared'
import type { JourneyMeta } from '@myorg/app-shared'

function DirectoryPage() {
  const modules = useModules()
  const openTab = useStore('workspace', (s) => s.openTab)

  // Only show modules that have catalog metadata
  const discoverable = modules.filter((m) => getModuleMeta<JourneyMeta>(m)?.category)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
      {discoverable.map((mod) => {
        const meta = getModuleMeta<JourneyMeta>(mod)!
        return (
          <div key={mod.id}>
            <h3>{meta.name}</h3>
            <p>{meta.description}</p>
            <button onClick={() => openTab({
              id: mod.id,
              moduleId: mod.id,
              title: meta.name,
              closeable: true,
            })}>
              {meta.estimatedTime ? 'Start' : 'Open'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
```

### Step 6: Tab rendering from module catalog

When a tab is active, the shell looks up the module and renders its `component`:

```typescript
// shell/src/components/WorkspaceContent.tsx
import { useModules } from '@reactive-framework/registry'

function WorkspaceContent({ activeTab, interactionContext }) {
  const modules = useModules()

  if (activeTab.type === 'directory') return <DirectoryPage />

  const mod = modules.find((m) => m.id === activeTab.moduleId)
  if (!mod?.component) return <p>Module "{activeTab.moduleId}" not found</p>

  const Component = mod.component
  return (
    <Component
      customerId={interactionContext.customerId}
      accountNumber={interactionContext.accountNumber}
      onComplete={(result) => {
        workspace.closeTab(activeTab.id)
        scratchpad.add(result.summary)
      }}
      onCancel={() => workspace.closeTab(activeTab.id)}
    />
  )
}
```

Modules open tabs by updating the shared workspace store:

```typescript
// Inside any module component
const openTab = useStore('workspace', (s) => s.openTab)

function handleOpenInvoice(invoiceId: string) {
  openTab({
    id: `invoice-${invoiceId}`,
    moduleId: 'billing',
    title: `Invoice #${invoiceId}`,
    closeable: true,
  })
}
```

### Per-interaction state with scoped stores

For apps where each interaction/session has independent state (tabs, scratchpad, etc.), use `createScopedStore`:

```typescript
import { createScopedStore } from '@reactive-framework/core'

const interactionTabs = createScopedStore<TabState>(() => ({
  tabs: [{ id: 'directory', type: 'directory', title: 'Directory', closeable: false }],
  activeTabId: 'directory',
}))

// In a component — subscribe to this interaction's tab state
function Workspace({ interactionId }: { interactionId: string }) {
  const { tabs, activeTabId } = interactionTabs.useScoped(interactionId)
  // ...
}

// Cleanup when interaction ends
interactionTabs.remove(interactionId)
```

### Summary: what goes where

| Concern | Owned by | Mechanism |
|---|---|---|
| Layout grid, zone placement | Shell | `rootComponent` with CSS Grid |
| Module identity and catalog metadata | Modules | `meta` on descriptor → `useModules()` |
| Module renderable component | Modules | `component` on descriptor → `useModules()` |
| Navigation items | Modules | `navigation` on descriptor |
| Command palette entries | Modules | `slots.commands` |
| Route-specific panels/actions | Modules | `staticData` on routes → `useZones()` |
| Directory page | Shell | Reads `useModules()`, filters by `meta` |
| Tab state, active tab | Shell | Zustand store (`workspace`) |
| Per-interaction state | Shell | `createScopedStore` |
| Tab rendering | Shell | Looks up module by id via `useModules()`, renders `component` |

The framework provides the composition primitives. The shell owns the workspace architecture. Modules stay standalone and testable — they declare what they contribute, the shell decides where it goes.
