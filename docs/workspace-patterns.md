# Workspace Patterns

This guide covers patterns for building **workspace-style applications** with the reactive framework — apps where the shell renders modules in tabs, panels, and drawers rather than via URL routes. Contact center agent desktops, trading platforms, and admin consoles are typical examples.

> **Prerequisite:** This guide builds on [Shell Patterns](shell-patterns.md), which covers the shared foundation: layout grids, slots, command palettes, auth guards, cross-store coordination, and module-to-shell communication. Read that first.

## When to use workspace patterns

Use these patterns when your app has:
- **Tabbed workspaces** — users open and close content tabs within a persistent shell
- **Component-only modules** — modules render via the shell (not via URL routes)
- **Per-session state** — each interaction/customer/ticket has its own tab state, scratchpad, etc.
- **Contextual panels that change per tab** — the active tab determines what shows in a sidebar

If your app is a traditional page-navigated SPA where modules own routes, the core framework + [Shell Patterns](shell-patterns.md) are sufficient.

## Architecture overview

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
│  │      │ │ │  (module component)          │  │ │         │ │
│  │      │ │ │                              │  │ │         │ │
│  │      │ │ └──────────────────────────────┘  │ │         │ │
│  └──────┘ └──────────────────────────────────┘ └─────────┘ │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Scratchpad / Drawer                                     ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

The shell owns the layout. Modules contribute content through five channels:

| What | Mechanism | Example |
|---|---|---|
| Navigation items | `navigation` on module descriptor | Mode rail links, sidebar items |
| Global contributions | `slots` on module descriptor | Command palette entries, tab type registrations |
| Route-specific panels | `staticData` on routes (zones) | Detail panel for a route-based page |
| Tab-active panels | `zones` on module descriptor | Contextual panel when a module tab is active |
| Runtime state | Shared Zustand stores | Active tab, interaction state, panel visibility |

## Step 1: Define the contracts in app-shared

```typescript
// app-shared/src/index.ts
import { createSharedHooks } from '@reactive-framework/core'
import type { ComponentType } from 'react'

// ---- Zones (layout regions that change per active content) ----

export interface AppZones {
  contextualPanel?: ComponentType
  headerActions?: ComponentType
}

// Type-safe staticData for route-based modules
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

export interface AppSlots {
  commands: CommandDefinition[]
  systems: SystemRegistration[]
  subNavSections: SubNavSection[]
}

// ---- Services ----

export interface WorkspaceActions {
  openModuleTab: (moduleId: string) => void
  openSectionTab: (sectionId: string) => void
}

// ---- Shared dependencies ----

export interface AppDependencies {
  auth: AuthStore
  interactions: InteractionsStore
  ui: UIStore
  httpClient: { get: (url: string) => Promise<unknown> }
  workspace: WorkspaceActions
}

// ---- Module metadata for catalog discovery ----

export interface JourneyMeta {
  readonly name: string
  readonly description: string
  readonly icon: string
  readonly category: string
  readonly estimatedTime?: string
  readonly keepOpenOnComplete?: boolean
  readonly addScratchpadEntry?: boolean
}

// ---- Typed hooks ----

export const { useStore, useService } = createSharedHooks<AppDependencies>()
```

## Step 2: Workspace tab state

The tab/workspace system is **shell-owned state**, not a framework concern. Use a plain Zustand store:

```typescript
// shell/src/stores/workspace.ts
import { createStore } from 'zustand/vanilla'

export interface WorkspaceTab {
  id: string
  type: 'directory' | 'iframe' | 'native-journey'
  title: string
  journeyId?: string      // for native-journey tabs
  iframeUrl?: string       // for iframe tabs
  closeable: boolean
  lastAccessedAt: number
}

export interface TabStateByInteraction {
  tabs: WorkspaceTab[]
  activeTabId: string
}

export const workspaceTabsStore = createStore<WorkspaceTabsState>((set, get) => ({
  tabStateByInteraction: {},

  getCurrentTabs: (interactionId) => {
    return get().tabStateByInteraction[interactionId]?.tabs ?? [createDirectoryTab()]
  },

  getActiveTab: (interactionId) => {
    const tabState = get().tabStateByInteraction[interactionId]
    if (!tabState) return null
    return tabState.tabs.find((t) => t.id === tabState.activeTabId) ?? null
  },

  openTabForInteraction: (interactionId, tab) =>
    set((state) => {
      // Activate existing tab or append new one, with LRU eviction
      // ...
    }),

  // closeTabForInteraction, switchTab, etc.
}))
```

### Cross-store coordination for tab initialization

When a new interaction is selected, initialize its tab state. Use Zustand's `subscribe` API (see [Cross-Store Coordination](shell-patterns.md#cross-store-coordination)):

```typescript
interactionsStore.subscribe((state, prev) => {
  if (state.activeInteractionId === prev.activeInteractionId) return
  const id = state.activeInteractionId
  if (!id) return

  const tabs = workspaceTabsStore.getState()
  if (!tabs.tabStateByInteraction[id]) {
    workspaceTabsStore.setState({
      tabStateByInteraction: {
        ...tabs.tabStateByInteraction,
        [id]: { tabs: [createDirectoryTab()], activeTabId: 'directory' },
      },
    })
  }
})
```

## Step 3: Modules as workspace components

Workspace modules use `component` instead of `createRoutes`. The shell renders them in tabs. They declare `meta` for catalog discovery and `zones` for contextual panels:

```typescript
// modules/dd-setup/src/index.ts
import { defineModule } from '@reactive-framework/core'
import { lazy } from 'react'
import { DDSetupContextualPanel } from './DDSetupContextualPanel.js'

export default defineModule<AppDependencies, AppSlots, JourneyMeta>({
  id: 'dd-setup',
  version: '0.1.0',

  // The shell renders this in a workspace tab
  component: lazy(() => import('./DDSetupJourney.js')),

  // Catalog metadata — shell reads via useModules() + getModuleMeta()
  meta: {
    name: 'Set up Direct Debit',
    description: 'Configure a new Direct Debit mandate',
    icon: 'CreditCard',
    category: 'payments',
    estimatedTime: '2-3 mins',
  },

  // Zones — shell reads via useActiveZones() when this module's tab is active
  zones: {
    contextualPanel: DDSetupContextualPanel,
  },

  requires: ['auth', 'httpClient'],
})
```

### Module components receive standard props

The shell defines a standard props interface for workspace components. Journey-style modules get:

```typescript
export interface JourneyProps {
  customerId: string
  accountNumber: string
  onComplete: (result?: unknown) => void
  onCancel: () => void
  initialState?: unknown
}
```

## Step 4: Descriptor zones and useActiveZones

Tab-based modules can't use `staticData` zones because they're not rendered via routes. Instead, they declare `zones` on the module descriptor:

```typescript
zones: {
  contextualPanel: DDSetupContextualPanel,
  headerActions: DDSetupHeaderActions,
}
```

The shell reads zones from both routes and the active module using `useActiveZones`:

```typescript
import { useActiveZones } from '@reactive-framework/registry'
import type { AppZones } from '@myorg/app-shared'

function ShellLayout() {
  // Derive the active module ID from workspace tab state
  const activeTab = getActiveTabForCurrentInteraction()
  const activeModuleId =
    activeTab?.type === 'native-journey' ? activeTab.journeyId : null

  const zones = useActiveZones<AppZones>(activeModuleId)
  const ContextualPanel = zones.contextualPanel

  return (
    <div className="grid ...">
      {/* ... other zones ... */}
      <aside>
        {ContextualPanel ? <ContextualPanel /> : <DefaultPanel />}
      </aside>
    </div>
  )
}
```

**How `useActiveZones` works:**
1. Collects route zones via `useZones()` (from `staticData` on matched routes)
2. If `activeModuleId` is provided, looks up the module's `zones` field from `useModules()`
3. Merges both — **module wins** for the same key
4. When `activeModuleId` is `null`, returns route zones only

This gives the shell one code path regardless of whether the active content is route-based or tab-based.

## Step 5: Directory page from module catalog

The shell builds a browsable directory of available modules using `useModules()` and `getModuleMeta()`:

```typescript
import { useModules, getModuleMeta } from '@reactive-framework/registry'
import type { JourneyMeta } from '@myorg/app-shared'

function DirectoryPage() {
  const modules = useModules()

  // Only show modules that have catalog metadata
  const discoverable = modules.filter((m) => getModuleMeta<JourneyMeta>(m)?.category)

  // Group by category
  const byCategory = Map.groupBy(discoverable, (m) =>
    getModuleMeta<JourneyMeta>(m)!.category
  )

  return (
    <div>
      {[...byCategory.entries()].map(([category, mods]) => (
        <section key={category}>
          <h2>{capitalize(category)}</h2>
          <div className="grid grid-cols-3 gap-4">
            {mods.map((mod) => {
              const meta = getModuleMeta<JourneyMeta>(mod)!
              return (
                <Card key={mod.id}>
                  <h3>{meta.name}</h3>
                  <p>{meta.description}</p>
                  <button onClick={() => openModuleTab(mod.id)}>
                    {meta.estimatedTime ? 'Start' : 'Open'}
                  </button>
                </Card>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
```

Category labels fall back to `capitalize(category)` — no hardcoded label map needed.

## Step 6: Tab rendering from module catalog

When a tab is active, the shell looks up the module and renders its `component`:

```typescript
import { useModules } from '@reactive-framework/registry'

function WorkspaceContent({ activeTab, customerId, accountNumber, interactionId }) {
  const modules = useModules()

  if (activeTab.type === 'directory') return <DirectoryPage />

  if (activeTab.type === 'iframe') {
    return <IframeContainer url={activeTab.iframeUrl} title={activeTab.title} />
  }

  // native-journey — look up the module
  const mod = modules.find((m) => m.id === activeTab.journeyId)
  if (!mod?.component) return <p>Module "{activeTab.journeyId}" not found</p>

  return (
    <JourneyWrapper
      journeyId={activeTab.journeyId}
      customerId={customerId}
      accountNumber={accountNumber}
      interactionId={interactionId}
      tabId={activeTab.id}
    />
  )
}
```

### Journey wrapper

The journey wrapper handles auto-save, completion behavior, and error boundaries:

```typescript
function JourneyWrapper({ journeyId, customerId, accountNumber, interactionId, tabId }) {
  const modules = useModules()
  const mod = modules.find((m) => m.id === journeyId)
  const meta = getModuleMeta<JourneyMeta>(mod!)

  const handleComplete = (result?: unknown) => {
    saveJourneyState(journeyId, result)

    // Respect module's completion preferences
    if (meta?.addScratchpadEntry !== false) {
      addScratchpadEntry(interactionId, `Journey completed: ${meta?.name ?? journeyId}`)
    }
    if (!meta?.keepOpenOnComplete) {
      closeTab(interactionId, tabId)
    }
  }

  const Component = mod!.component!
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <Component
          customerId={customerId}
          accountNumber={accountNumber}
          onComplete={handleComplete}
          onCancel={() => closeTab(interactionId, tabId)}
          initialState={loadJourneyState(journeyId)}
        />
      </Suspense>
    </ErrorBoundary>
  )
}
```

Modules control their own completion behavior via `JourneyMeta`:
- `keepOpenOnComplete: true` — tab stays open, module shows its own post-completion UI
- `addScratchpadEntry: false` — no automatic scratchpad entry on completion

## Step 7: Per-interaction state with scoped stores

For apps where each interaction/session has independent state, use `createScopedStore`:

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

## How modules trigger workspace actions

Modules should never import store instances directly. Expose a workspace actions service via `AppDependencies`:

```typescript
// app-shared/src/index.ts
export interface WorkspaceActions {
  openModuleTab: (moduleId: string) => void
  openSectionTab: (sectionId: string) => void
}
```

The shell provides the implementation. Modules only know the interface:

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

## Summary: what goes where

| Concern | Owned by | Mechanism |
|---|---|---|
| Layout grid, zone placement | Shell | `rootComponent` with CSS Grid |
| Module identity and catalog metadata | Modules | `meta` on descriptor → `useModules()` |
| Module renderable component | Modules | `component` on descriptor → `useModules()` |
| Tab-active contextual panels | Modules | `zones` on descriptor → `useActiveZones()` |
| Route-specific panels/actions | Modules | `staticData` on routes → `useActiveZones()` |
| Navigation items | Modules | `navigation` on descriptor |
| Command palette entries | Modules | `slots.commands` |
| Directory page | Shell | Reads `useModules()`, filters by `meta` |
| Tab state, active tab | Shell | Zustand store |
| Per-interaction state | Shell | `createScopedStore` |
| Tab rendering | Shell | Looks up module by id via `useModules()`, renders `component` |

The framework provides the composition primitives. The shell owns the workspace architecture. Modules stay standalone and testable — they declare what they contribute, the shell decides where it goes.
