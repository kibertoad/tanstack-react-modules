---
name: register-module
description: Registers an existing module in the shell host app. Use when wiring a new or existing module into the running application.
metadata:
  author: reactive
  version: "1.0"
---

# Register a Module in the Shell

After creating a module, it must be registered in the shell (host app) to appear in the running application.

> **Note:** `reactive create module` handles registration automatically. These manual steps are only needed when registering a module that was created without the CLI.

## Step 1: Add workspace dependency

In `examples/shell/package.json`, add the module to `dependencies`:

```json
{
  "dependencies": {
    "@example/<module-name>-module": "workspace:*"
  }
}
```

Run `pnpm install` to link.

## Step 2: Import and register

In `examples/shell/src/main.tsx`:

```typescript
import newModule from "@example/<module-name>-module";

// After createRegistry and before resolve:
registry.register(newModule);
```

## Step 3: Verify

```bash
pnpm --filter shell dev
```

The module's routes and navigation items should appear immediately. The sidebar auto-generates from the navigation manifest.

## Registering a lazy module

For large modules that should load on demand:

```typescript
registry.registerLazy({
  id: "<module-name>",
  basePath: "/<module-path>",
  load: () => import("@example/<module-name>-module"),
});
```

The module's code is only fetched when the user navigates to the base path.

## Validation

When `registry.resolve()` runs, it validates:

- **No duplicate module IDs** - two modules with `id: 'billing'` will throw.
- **All required dependencies exist** - if a module has `requires: ['auth', 'analytics']` and `analytics` is not in the registry config, it throws with a clear error listing available deps.

If validation fails, the error message tells you exactly what's missing:

```
[@tanstack-react-modules/runtime] Module "billing" requires dependencies not provided
by the registry: analytics. Available: auth, config, httpClient
```

## Order of operations

```typescript
// 1. Create registry with shared dependencies
const registry = createRegistry<AppDependencies>({
  stores: { auth: authStore, config: configStore },
  services: { httpClient },
})

// 2. Register modules (order doesn't matter)
registry.register(billing)
registry.register(users)
registry.register(newModule)

// 3. Resolve - validates everything, builds route tree, returns App
const { App } = registry.resolve({
  rootComponent: Layout,
  indexComponent: Home,
})

// 4. Render
createRoot(document.getElementById('root')!).render(<App />)
```

## Rules

- Modules must be registered **before** calling `resolve()`. Registering after throws an error.
- `resolve()` can only be called **once**. Calling it again throws an error.
- Registration order does not affect route priority or navigation order - those are controlled by the `order` field in navigation items and the route paths themselves.
- The registry is generic over `AppDependencies` - only modules typed with the same contract can be registered.
