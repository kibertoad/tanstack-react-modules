# Shell Patterns

This guide covers patterns for building complex shell applications with the reactive framework. A "shell" is the host app that composes modules into a unified UI — from simple sidebar-and-content layouts to multi-zone dashboards like contact center agents or admin consoles.

## Multi-Zone Shell Layout

A basic shell has a sidebar and a content area. A complex shell has multiple zones — a mode rail, a customer banner, a workspace with tabs, a contextual panel, a scratchpad drawer.

### Defining layout zones

The shell's `rootComponent` owns the entire layout. Use CSS Grid to define zones, and populate them from navigation, slots, and shared stores:

```typescript
// shell/src/components/Layout.tsx
import { Outlet } from '@tanstack/react-router'
import { useNavigation, useSlots } from '@reactive/registry'
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
import { useSlots } from '@reactive/registry'
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

A command palette collects actions from all modules and presents them in a searchable overlay.

### Define the command slot

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

### Modules contribute commands

```typescript
export default defineModule<AppDependencies, AppSlots>({
  id: 'billing',
  slots: {
    commands: [
      { id: 'billing:dashboard', label: 'Open Billing Dashboard', group: 'navigate', onSelect: () => {} },
      { id: 'billing:new-invoice', label: 'Create New Invoice', group: 'actions', onSelect: () => {} },
    ],
  },
  // ...
})
```

The `onSelect` callbacks can use the router or shared stores to trigger navigation or state changes. For router access, define `onSelect` lazily inside a component or pass the router via a shared service.

### Shell renders the palette

```typescript
import { useSlots } from '@reactive/registry'
import type { AppSlots } from '@myorg/app-shared'

function CommandPalette({ search }: { search: string }) {
  const { commands } = useSlots<AppSlots>()

  const filtered = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(search.toLowerCase()),
  )

  const groups = Map.groupBy(filtered, (cmd) => cmd.group ?? 'other')

  return (
    <div>
      {[...groups.entries()].map(([group, items]) => (
        <div key={group}>
          <h3>{group}</h3>
          {items.map((cmd) => (
            <button key={cmd.id} onClick={cmd.onSelect}>{cmd.label}</button>
          ))}
        </div>
      ))}
    </div>
  )
}
```

## Auth Guard Pattern

Use TanStack Router's `beforeLoad` to redirect unauthenticated users. This works at the route level, not the framework level — giving you full control.

### Option 1: Guard in the root layout route

If all routes require authentication, guard at the root:

```typescript
// shell/src/main.tsx
import { authStore } from './stores/auth.js'

const { App } = registry.resolve({
  rootComponent: Layout,
  indexComponent: Home,
})
```

```typescript
// In createRoutes, add beforeLoad to the module's root route:
const billingRoot = createRoute({
  getParentRoute: () => parentRoute,
  path: 'billing',
  beforeLoad: () => {
    const { isAuthenticated } = authStore.getState()
    if (!isAuthenticated) {
      throw redirect({ to: '/login' })
    }
  },
})
```

### Option 2: Guard in individual module routes

For mixed public/private routes, guard per-module:

```typescript
export default defineModule<AppDependencies, AppSlots>({
  id: 'billing',
  createRoutes: (parentRoute) => {
    const root = createRoute({
      getParentRoute: () => parentRoute,
      path: 'billing',
      beforeLoad: () => {
        // Access auth store directly (not via hook — this runs outside React)
        const { isAuthenticated } = authStore.getState()
        if (!isAuthenticated) {
          throw redirect({ to: '/login' })
        }
      },
    })
    // ... child routes
  },
})
```

Note: `beforeLoad` runs outside the React tree, so you access stores via `store.getState()` rather than hooks.

## Module-to-Shell Communication

There are three communication channels. Choose based on what kind of data you're passing:

### Slots: static declarations at registration time

Use for things that don't change at runtime — what tab types exist, what commands are available, what badge types a module supports.

```typescript
// Module declares once at registration
slots: {
  commands: [{ id: 'billing:open', label: 'Open Billing', onSelect: () => {} }],
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

### Decision guide

| Question | Answer |
|---|---|
| Is it known at module registration time? | Slots |
| Does it change at runtime? | Shared store |
| Does it come from an API? | React Query |
| Does it need to trigger re-renders across modules? | Shared store (Zustand subscriptions) or React Query (cache invalidation) |
