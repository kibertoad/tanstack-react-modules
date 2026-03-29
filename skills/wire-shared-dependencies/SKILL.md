---
name: wire-shared-dependencies
description: Adds a new shared dependency (zustand store, plain service, or reactive service) to the AppDependencies contract and wires it into the shell. Use when adding new cross-cutting concerns like analytics, feature flags, call adapters, or notification services.
metadata:
  author: reactive
  version: "1.1"
---

# Wire Shared Dependencies

Shared dependencies are how modules access cross-cutting concerns (auth, config, HTTP client, analytics, feature flags). They come in three flavors:

- **Zustand stores** - reactive state that components subscribe to via `useStore()`.
- **Plain services** - stable instances (HTTP clients, loggers) that don't trigger re-renders. Accessed via `useService()`.
- **Reactive services** - external sources you observe but don't control (call adapters, websockets, presence systems). Accessed via `useReactiveService()`.

> **CLI shortcut for stores:** `reactive create store <name>` automates steps 1-4 for Zustand stores. Use manual wiring for plain services, reactive services, or when the CLI doesn't fit.

## Adding a Zustand store

### Step 1: Define the store type in the contract

```typescript
// app-shared/src/index.ts

export interface NotificationStore {
  notifications: Notification[];
  add: (notification: Notification) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}
```

### Step 2: Add to AppDependencies

```typescript
export interface AppDependencies {
  auth: AuthStore;
  config: ConfigStore;
  httpClient: Wretch;
  notifications: NotificationStore; // ← add here
}
```

The `useStore`, `useService`, `useReactiveService`, and `useOptional` hooks are already typed against `AppDependencies` — no changes needed there.

### Step 3: Create the store implementation in the shell

```typescript
// shell/src/stores/notifications.ts
import { createStore } from "zustand/vanilla";
import type { NotificationStore } from "@example/app-shared";

export const notificationStore = createStore<NotificationStore>((set) => ({
  notifications: [],
  add: (notification) =>
    set((state) => ({ notifications: [...state.notifications, notification] })),
  dismiss: (id) =>
    set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),
  clear: () => set({ notifications: [] }),
}));
```

### Step 4: Register in the registry

```typescript
// shell/src/main.tsx
import { notificationStore } from "./stores/notifications.js";

const registry = createRegistry<AppDependencies>({
  stores: {
    auth: authStore,
    config: configStore,
    notifications: notificationStore, // ← add here
  },
  services: { httpClient },
});
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
  track: (event: string, properties?: Record<string, unknown>) => void;
  identify: (userId: string) => void;
}
```

### Step 2: Add to AppDependencies

```typescript
export interface AppDependencies {
  // ... existing ...
  analytics: AnalyticsService; // ← add here
}
```

### Step 3: Create the implementation in the shell

```typescript
// shell/src/services/analytics.ts
import type { AnalyticsService } from "@example/app-shared";

export const analytics: AnalyticsService = {
  track: (event, properties) => {
    console.log("[analytics]", event, properties);
    // Send to analytics provider
  },
  identify: (userId) => {
    console.log("[analytics] identify", userId);
  },
};
```

### Step 4: Register in the registry

```typescript
const registry = createRegistry<AppDependencies>({
  stores: { auth: authStore, config: configStore },
  services: {
    httpClient,
    analytics, // ← add here
  },
});
```

### Step 5: Use in modules

```typescript
import { useService } from "@example/app-shared";

function SomeComponent() {
  const analytics = useService("analytics");
  analytics.track("page_viewed", { page: "/billing" });
}
```

## Adding a reactive service

Reactive services wrap external sources you subscribe to but don't own — call adapters, websocket connections, presence systems, push notifications. They implement the `ReactiveService<T>` interface (matching React's `useSyncExternalStore` contract).

### Step 1: Define the snapshot type in the contract

```typescript
// app-shared/src/index.ts
export interface CallSnapshot {
  state: "idle" | "ringing" | "active" | "hold";
  caller: { name: string; number: string } | null;
  duration: number;
}
```

### Step 2: Add to AppDependencies

```typescript
export interface AppDependencies {
  // ... existing ...
  call: CallSnapshot; // ← add here
}
```

### Step 3: Create the reactive service in the shell

```typescript
// shell/src/services/call-reactive-service.ts
import type { ReactiveService } from "@tanstack-react-modules/core";
import type { CallSnapshot } from "@example/app-shared";

// Wrap your external adapter into the ReactiveService contract
export function createCallReactiveService(
  callAdapter: YourCallAdapter,
): ReactiveService<CallSnapshot> {
  return {
    subscribe: (callback) => {
      // Subscribe to the external source; return an unsubscribe function
      return callAdapter.onCallEvent(callback);
    },
    getSnapshot: () => ({
      // Must return a stable reference when state hasn't changed
      state: callAdapter.getCallState(),
      caller: callAdapter.getCallerInfo(),
      duration: callAdapter.getDuration(),
    }),
  };
}
```

### Step 4: Register in the registry

```typescript
// shell/src/main.tsx
import { createCallReactiveService } from "./services/call-reactive-service.js";

const callReactiveService = createCallReactiveService(callAdapter);

const registry = createRegistry<AppDependencies>({
  stores: { auth: authStore, config: configStore },
  services: { httpClient },
  reactiveServices: {
    call: callReactiveService, // ← add here
  },
});
```

### Step 5: Use in modules

```typescript
import { useReactiveService } from "@example/app-shared";

function CallBanner() {
  // Full snapshot — re-renders when any field changes
  const call = useReactiveService("call");

  // With selector — only re-renders when call state changes
  const callState = useReactiveService("call", (s) => s.state);

  if (callState === "idle") return null;
  return <div>Call: {callState} — {call.caller?.name}</div>;
}
```

### Using useOptional for optional dependencies

If a dependency may or may not be registered (e.g., analytics in dev vs prod), use `useOptional` instead of `useStore`/`useService`/`useReactiveService`:

```typescript
import { useOptional } from "@example/app-shared";

function SomeComponent() {
  const analytics = useOptional("analytics");
  analytics?.track("page_viewed"); // null if not registered
}
```

Declare these in the module descriptor with `optionalRequires` instead of `requires`:

```typescript
defineModule<AppDependencies>({
  // ...
  requires: ["auth"],
  optionalRequires: ["analytics"],
});
```

## Rules

- Use a **zustand store** when components need to react to state changes (re-render on update).
- Use a **plain service** when the value is a stable object that doesn't change (HTTP client, logger, analytics).
- Use a **reactive service** when the source is external and you need to subscribe to changes but don't own the state (call adapters, websockets, presence).
- Always use `zustand/vanilla` for store creation (not `zustand`), so stores can be accessed outside React components (e.g., in the HTTP client's `defer()` callback).
- Update `requires` (or `optionalRequires`) in any module that needs the new dependency — this is validated at `registry.resolve()`.
- Never import store/service implementations in modules. Modules only depend on the contract interfaces.
- `getSnapshot` in a reactive service must return a **stable reference** when state hasn't changed. If you return a new object every call, components will re-render on every subscription tick.

## Choosing between store, service, and reactive service

| Need                                                       | Use                                    |
| ---------------------------------------------------------- | -------------------------------------- |
| Components must re-render when value changes               | Zustand store                          |
| Value is a stable object/instance                          | Plain service                          |
| Need to read state outside React (e.g., HTTP interceptors) | Zustand store (use `store.getState()`) |
| Singleton with methods, no state changes                   | Plain service                          |
| External source you subscribe to but don't control         | Reactive service                       |
| Dependency may or may not be registered                    | `useOptional()` + `optionalRequires`   |
