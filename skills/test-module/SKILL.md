---
name: test-module
description: Writes tests for a Reactive module using @tanstack-react-modules/testing with renderModule() and createMockStore(). Use when adding or updating tests for module components.
metadata:
  author: reactive
  version: "1.0"
---

# Test a Reactive Module

`@tanstack-react-modules/testing` provides `renderModule()` to render a module in isolation with mocked shared dependencies. It uses `@testing-library/react` under the hood.

## Step 1: Set up test file

Create test files next to the module or in a `__tests__` directory:

```
modules/<module-name>/
├── src/
│   ├── index.ts
│   └── pages/
│       └── Dashboard.tsx
└── tests/
    └── Dashboard.test.tsx
```

## Step 2: Write a basic test

```typescript
import { test, expect } from "vitest";
import { renderModule, createMockStore } from "@tanstack-react-modules/testing";
import moduleDescriptor from "../src/index.js";
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

## Step 3: Test unauthenticated state

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
})
```

Returns a standard `@testing-library/react` `RenderResult` with `getByText`, `queryByText`, `findByText`, etc.

## Rules

- Only provide the dependencies your module actually uses in `deps`.
- Use `createMockStore` for zustand stores — plain objects won't work (the framework checks for `getState`/`setState`/`subscribe` methods).
- Use plain objects or real instances for services.
- The `route` must match one of the module's declared routes.
- `renderModule` creates an isolated TanStack Router with memory history — no real navigation occurs.
- Run tests with `pnpm test` or `vitest run` from the repo root.
