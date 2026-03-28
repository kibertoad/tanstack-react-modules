---
name: wire-shared-dependencies
description: Adds a new shared dependency (zustand store or plain service) to the AppDependencies contract and wires it into the shell. Use when adding new cross-cutting concerns like analytics, feature flags, or notification services.
metadata:
  author: reactive
  version: "1.0"
---

# Wire Shared Dependencies

Shared dependencies are how modules access cross-cutting concerns (auth, config, HTTP client, analytics, feature flags). They come in two flavors:

- **Zustand stores** — reactive state that components subscribe to.
- **Plain services** — stable instances (HTTP clients, loggers) that don't trigger re-renders.

## Adding a Zustand store

### Step 1: Define the store type in the contract

```typescript
// examples/app-shared/src/index.ts

export interface NotificationStore {
  notifications: Notification[]
  add: (notification: Notification) => void
  dismiss: (id: string) => void
  clear: () => void
}
```

### Step 2: Add to AppDependencies

```typescript
export interface AppDependencies {
  auth: AuthStore
  config: ConfigStore
  httpClient: Wretch
  notifications: NotificationStore   // ← add here
}
```

The `useStore` and `useService` hooks are already typed against `AppDependencies` — no changes needed there.

### Step 3: Create the store implementation in the shell

```typescript
// examples/shell/src/stores/notifications.ts
import { createStore } from 'zustand/vanilla'
import type { NotificationStore } from '@example/app-shared'

export const notificationStore = createStore<NotificationStore>((set) => ({
  notifications: [],
  add: (notification) =>
    set((state) => ({ notifications: [...state.notifications, notification] })),
  dismiss: (id) =>
    set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),
  clear: () => set({ notifications: [] }),
}))
```

### Step 4: Register in the registry

```typescript
// examples/shell/src/main.tsx
import { notificationStore } from './stores/notifications.js'

const registry = createRegistry<AppDependencies>({
  stores: {
    auth: authStore,
    config: configStore,
    notifications: notificationStore,  // ← add here
  },
  services: { httpClient },
})
```

### Step 5: Use in modules

```typescript
import { useStore } from '@example/app-shared'

function SomeComponent() {
  const notifications = useStore('notifications', (s) => s.notifications)
  const add = useStore('notifications', (s) => s.add)

  return <button onClick={() => add({ id: '1', message: 'Hello' })}>Notify</button>
}
```

## Adding a plain service

### Step 1: Define the service type in the contract

```typescript
export interface AnalyticsService {
  track: (event: string, properties?: Record<string, unknown>) => void
  identify: (userId: string) => void
}
```

### Step 2: Add to AppDependencies

```typescript
export interface AppDependencies {
  // ... existing ...
  analytics: AnalyticsService   // ← add here
}
```

### Step 3: Create the implementation in the shell

```typescript
// examples/shell/src/services/analytics.ts
import type { AnalyticsService } from '@example/app-shared'

export const analytics: AnalyticsService = {
  track: (event, properties) => {
    console.log('[analytics]', event, properties)
    // Send to analytics provider
  },
  identify: (userId) => {
    console.log('[analytics] identify', userId)
  },
}
```

### Step 4: Register in the registry

```typescript
const registry = createRegistry<AppDependencies>({
  stores: { auth: authStore, config: configStore },
  services: {
    httpClient,
    analytics,  // ← add here
  },
})
```

### Step 5: Use in modules

```typescript
import { useService } from '@example/app-shared'

function SomeComponent() {
  const analytics = useService('analytics')
  analytics.track('page_viewed', { page: '/billing' })
}
```

## Rules

- Use a **zustand store** when components need to react to state changes (re-render on update).
- Use a **plain service** when the value is a stable object that doesn't change (HTTP client, logger, analytics).
- Always use `zustand/vanilla` for store creation (not `zustand`), so stores can be accessed outside React components (e.g., in the HTTP client's `defer()` callback).
- Update `requires` in any module that needs the new dependency — this is validated at `registry.resolve()`.
- Never import store/service implementations in modules. Modules only depend on the contract interfaces.

## Choosing between store and service

| Need | Use |
|---|---|
| Components must re-render when value changes | Zustand store |
| Value is a stable object/instance | Plain service |
| Need to read state outside React (e.g., HTTP interceptors) | Zustand store (use `store.getState()`) |
| Singleton with methods, no state changes | Plain service |
