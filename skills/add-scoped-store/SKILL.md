---
name: add-scoped-store
description: Creates a per-entity scoped Zustand store using createScopedStore(). Use when you need independent state instances keyed by ID — per-interaction tabs, per-conversation messages, per-workspace scratchpads, etc.
metadata:
  author: reactive
  version: "1.0"
---

# Add a Scoped Store

`createScopedStore()` creates a factory that manages a `Map<string, StoreApi<T>>` — one independent Zustand store per scope key. Each scope is lazily created on first access and can be cleaned up individually.

Use scoped stores when:

- You need per-entity state (per-interaction, per-conversation, per-tab, per-workspace).
- Multiple instances of the same state shape exist simultaneously.
- Entity lifecycle doesn't match component lifecycle (state survives tab switches, unmounts).

Do NOT use scoped stores for:

- App-wide singleton state — use a regular Zustand store in `AppDependencies`.
- Server data — use React Query.

## Step 1: Define the state type

```typescript
// app-shared/src/index.ts (or a local types file in the module)

export interface TabState {
  tabs: Tab[];
  activeTabId: string;
  addTab: (tab: Tab) => void;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
}

export interface Tab {
  id: string;
  label: string;
  type: "directory" | "detail" | "settings";
}
```

## Step 2: Create the scoped store

```typescript
// shell/src/stores/interaction-tabs.ts (or in the module that owns this state)
import { createScopedStore } from "@tanstack-react-modules/core";
import type { TabState, Tab } from "@example/app-shared";

function createDirectoryTab(): Tab {
  return { id: "directory", label: "Directory", type: "directory" };
}

export const interactionTabs = createScopedStore<TabState>(() => ({
  tabs: [createDirectoryTab()],
  activeTabId: "directory",

  addTab: (tab) => {
    // Note: scoped store actions use the same zustand set() pattern,
    // but you access it via the store instance, not via the initializer's set param.
    // See "Imperative access" below for how to mutate.
  },
  removeTab: (tabId) => {},
  setActiveTab: (tabId) => {},
}));
```

For stores with actions, use the imperative API to define them properly:

```typescript
export const interactionTabs = createScopedStore<TabState>(() => {
  // Return initial state only — actions are added via getOrCreate + setState
  return {
    tabs: [createDirectoryTab()],
    activeTabId: "directory",
    addTab: () => {}, // placeholder — overridden below
    removeTab: () => {},
    setActiveTab: () => {},
  };
});

// Helper to get a fully functional store for a given interaction
export function getInteractionTabs(interactionId: string) {
  const store = interactionTabs.getOrCreate(interactionId);

  // Patch actions on first access (idempotent — setState merges)
  store.setState({
    addTab: (tab: Tab) => store.setState((s) => ({ tabs: [...s.tabs, tab] })),
    removeTab: (tabId: string) =>
      store.setState((s) => ({
        tabs: s.tabs.filter((t) => t.id !== tabId),
        activeTabId: s.activeTabId === tabId ? (s.tabs[0]?.id ?? "") : s.activeTabId,
      })),
    setActiveTab: (tabId: string) => store.setState({ activeTabId: tabId }),
  });

  return store;
}
```

## Step 3: Use in React components

```typescript
import { interactionTabs } from "@example/app-shared"; // or from the module's own code

function InteractionWorkspace({ interactionId }: { interactionId: string }) {
  // Full state — re-renders when any field changes
  const { tabs, activeTabId } = interactionTabs.useScoped(interactionId);

  // With selector — only re-renders when tabs change
  const tabs = interactionTabs.useScoped(interactionId, (s) => s.tabs);

  return (
    <div>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          data-active={tab.id === activeTabId}
          onClick={() => {
            const store = interactionTabs.getOrCreate(interactionId);
            store.setState({ activeTabId: tab.id });
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

## Step 4: Imperative access (outside React)

```typescript
// Get or create the store for a scope
const store = interactionTabs.getOrCreate("interaction-123");

// Read current state
const state = store.getState();

// Update state
store.setState({ activeTabId: "settings" });

// Subscribe to changes
const unsubscribe = store.subscribe((state) => {
  console.log("tabs changed:", state.tabs);
});

// Check if scope exists
interactionTabs.has("interaction-123"); // true

// Cleanup when entity is destroyed
interactionTabs.remove("interaction-123");

// Clear all scopes
interactionTabs.clear();
```

## Step 5: Cleanup

Scoped stores are not garbage-collected automatically. Remove scopes when the entity they belong to is destroyed:

```typescript
// When an interaction ends:
interactionTabs.remove(interactionId);

// When the entire workspace resets:
interactionTabs.clear();
```

Failing to clean up leaks memory proportional to the number of unique scope IDs created over the session lifetime.

## ScopedStore API reference

| Method / Hook             | Description                                                     |
| ------------------------- | --------------------------------------------------------------- |
| `getOrCreate(scopeId)`    | Returns existing store or creates one with the initializer      |
| `has(scopeId)`            | Returns `true` if the scope exists                              |
| `remove(scopeId)`         | Deletes the scope's store. No-op if it doesn't exist            |
| `clear()`                 | Removes all scoped stores                                       |
| `useScoped(scopeId)`      | React hook — subscribe to full state of a scope                 |
| `useScoped(scopeId, sel)` | React hook — subscribe with selector, re-renders only on change |

## Rules

- The initializer function is called once per scope, on first `getOrCreate` or `useScoped` call.
- `useScoped` creates the scope if it doesn't exist — safe to call without prior `getOrCreate`.
- Always call `remove()` or `clear()` when entities are destroyed. Scoped stores are not garbage-collected.
- Scoped stores are independent of `AppDependencies` — they are not registered in the registry. They're created and owned by the code that needs per-entity state.
- Use selectors with `useScoped(id, selector)` to minimize re-renders, same as with regular zustand stores.
- The store instances are standard zustand `StoreApi` objects — all zustand patterns work (middleware, subscribe, getState, setState).
