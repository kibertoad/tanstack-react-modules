---
name: test-module
description: Writes tests for a Reactive module using @tanstack-react-modules/testing with renderModule(), resolveModule(), and createMockStore(). Use when adding or updating tests for module components, routes, or slot contributions.
metadata:
  author: reactive
  version: "1.1"
---

# Test a Reactive Module

`@tanstack-react-modules/testing` provides utilities for testing modules in isolation:

- **`renderModule()`** — renders a route-based or component-only module with mocked shared dependencies. Uses `@testing-library/react` under the hood.
- **`resolveModule()`** — resolves a headless module (no component, no routes) without rendering. Tests slot contributions and lifecycle hooks.
- **`createMockStore()`** — creates a zustand store pre-populated with given state.

## Testing route-based modules

### Step 1: Set up test file

Create test files next to the module or in a `__tests__` directory:

```
modules/<module-name>/
├── src/
│   ├── index.ts
│   └── pages/
│       └── Dashboard.tsx
└── src/__tests__/
    └── module-name.test.tsx
```

### Step 2: Write a basic test

```typescript
import { test, expect } from "vitest";
import { renderModule, createMockStore } from "@tanstack-react-modules/testing";
import moduleDescriptor from "../index.js";
import type { AuthStore, ConfigStore } from "@example/app-shared";
import wretch from "wretch";

test("renders dashboard for authenticated user", async () => {
  const result = await renderModule(moduleDescriptor, {
    route: "/<module-path>",
    deps: {
      auth: createMockStore<AuthStore>({
        user: { id: "1", name: "Test User", email: "test@test.com", role: "admin" },
        token: "mock-token",
        isAuthenticated: true,
        login: async () => {},
        logout: () => {},
      }),
      config: createMockStore<ConfigStore>({
        apiBaseUrl: "http://localhost:3000",
        environment: "dev",
        appName: "Test App",
      }),
      httpClient: wretch("http://localhost:3000"),
    },
  });

  expect(result.getByText("Test User")).toBeDefined();
});
```

### Step 3: Test unauthenticated state

```typescript
test("shows login prompt when not authenticated", async () => {
  const result = await renderModule(moduleDescriptor, {
    route: "/<module-path>",
    deps: {
      auth: createMockStore<AuthStore>({
        user: null,
        token: null,
        isAuthenticated: false,
        login: async () => {},
        logout: () => {},
      }),
      httpClient: wretch("http://localhost:3000"),
    },
  });

  expect(result.getByText("Please log in")).toBeDefined();
});
```

## Testing component-only modules

For modules that declare `component` instead of `createRoutes` (workspace-style apps):

```typescript
import { test, expect } from "vitest";
import { renderModule, createMockStore } from "@tanstack-react-modules/testing";
import settingsModule from "../index.js";
import type { AuthStore } from "@example/app-shared";

test("renders settings component with props", async () => {
  const result = await renderModule(settingsModule, {
    deps: {
      auth: createMockStore<AuthStore>({
        user: { id: "1", name: "Test User", email: "test@test.com", role: "admin" },
        token: "mock-token",
        isAuthenticated: true,
        login: async () => {},
        logout: () => {},
      }),
    },
    // Props passed directly to the module's component
    props: { customerId: "123", accountNumber: "A001" },
  });

  expect(result.getByText("Settings")).toBeDefined();
});
```

## Testing headless modules (slot-only)

For modules that have no component and no routes — they only contribute slots:

```typescript
import { test, expect } from "vitest";
import { resolveModule } from "@tanstack-react-modules/testing";
import externalSystemsModule from "../index.js";
import type { AppDependencies, AppSlots } from "@example/app-shared";

test("contributes system registrations to slots", () => {
  const { slots, entry, onRegisterCalled } = resolveModule<AppDependencies, AppSlots>(
    externalSystemsModule,
    {
      // Default slot values (same shape as registry config)
      defaults: { commands: [], systems: [] },
    },
  );

  expect(slots.systems).toHaveLength(1);
  expect(slots.systems[0].id).toBe("salesforce");
  expect(entry.id).toBe("external-systems");
});

test("calls onRegister lifecycle hook with deps", () => {
  const { onRegisterCalled } = resolveModule(externalSystemsModule, {
    deps: { httpClient: wretch("http://localhost:3000") },
    defaults: { commands: [], systems: [] },
  });

  expect(onRegisterCalled).toBe(true);
});
```

## Testing slot contributions with renderModule

If a module has both routes and slots, use `renderModule` with mock slot data:

```typescript
test("renders with slot data from other modules", async () => {
  const result = await renderModule(billingModule, {
    route: "/billing",
    deps: { auth: createMockStore<AuthStore>({ ... }), httpClient },
    // Provide mock slot data that the component reads via useSlots()
    slots: {
      commands: [
        { id: "mock:cmd", label: "Mock Command", onSelect: () => {} },
      ],
    },
  });
});
```

## createMockStore reference

Creates a zustand store pre-populated with the given state:

```typescript
import { createMockStore } from "@tanstack-react-modules/testing";

const store = createMockStore<AuthStore>({
  user: { id: "1", name: "Test", email: "a@b.com", role: "user" },
  token: "token",
  isAuthenticated: true,
  login: async () => {},
  logout: () => {},
});
```

Every field in the store type must be provided — including action functions. Use `async () => {}` or `() => {}` for actions you don't need to verify.

## renderModule reference

```typescript
const result = await renderModule(moduleDescriptor, {
  route: '/billing/invoices',    // Initial route (default: '/')
  deps: {                        // Shared dependencies
    auth: createMockStore(...),  // StoreApi → goes to stores context
    httpClient: wretch(...),     // Plain value → goes to services context
  },
  slots: { commands: [...] },    // Optional mock slot data
  props: { key: 'value' },       // Optional props (component-only modules)
})
```

Returns a standard `@testing-library/react` `RenderResult` with `getByText`, `queryByText`, `findByText`, etc.

## resolveModule reference

```typescript
const { slots, entry, onRegisterCalled } = resolveModule(moduleDescriptor, {
  deps: { httpClient }, // Optional deps passed to onRegister
  defaults: { commands: [] }, // Default slot values
});
```

Returns `{ slots, entry, onRegisterCalled }`. No rendering — tests slot contributions and lifecycle hooks only.

## Rules

- Only provide the dependencies your module actually uses in `deps`.
- Use `createMockStore` for zustand stores — plain objects won't work (the framework checks for `getState`/`setState`/`subscribe` methods).
- Use plain objects or real instances for services.
- The `route` must match one of the module's declared routes.
- `renderModule` creates an isolated TanStack Router with memory history — no real navigation occurs.
- Use `resolveModule` for headless modules that have neither `component` nor `createRoutes`.
- Run tests with `pnpm test` or `vitest run` from the repo root.
