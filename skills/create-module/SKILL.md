---
name: create-module
description: Creates a new Reactive module with routes, navigation, page components, and package.json. Use when asked to add a new feature module, section, or domain area to the application.
metadata:
  author: reactive
  version: "1.0"
---

# Create a Reactive Module

A Reactive module is an npm package that exports a `ReactiveModuleDescriptor` via `defineModule()`. It declares its own routes (TanStack Router), navigation items, and shared dependency requirements.

> **Prefer the CLI:** `reactive create module <name>` automates all steps below including shell wiring. Use manual creation only when the CLI doesn't fit your needs.

## Step 1: Create the directory structure

```
examples/modules/<module-name>/
├── src/
│   ├── index.ts          # Module descriptor
│   └── pages/
│       └── <PageName>.tsx
├── package.json
└── tsconfig.json
```

## Step 2: Create package.json

```json
{
  "name": "@example/<module-name>-module",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    }
  },
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
  },
  "devDependencies": {
    "@tanstack/react-query": "^5.95.0",
    "@tanstack/react-router": "^1.120.0",
    "react": "^19.0.0",
    "zustand": "^5.0.0",
    "@types/react": "^19.0.0",
    "typescript": "^6.0.2"
  }
}
```

## Step 3: Create tsconfig.json

```json
{
  "extends": "../../../tsconfig.base.json",
  "include": ["src"]
}
```

## Step 4: Create the module descriptor

```typescript
// src/index.ts
import { defineModule } from "@tanstack-react-modules/core";
import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import type { AppDependencies } from "@example/app-shared";

export default defineModule<AppDependencies>({
  id: "<module-name>",
  version: "0.1.0",

  createRoutes: (parentRoute) => {
    const root = createRoute({
      getParentRoute: () => parentRoute,
      path: "<module-name>",
    });

    const index = createRoute({
      getParentRoute: () => root,
      path: "/",
      component: lazyRouteComponent(() => import("./pages/<PageName>.js")),
    });

    return root.addChildren([index]);
  },

  navigation: [
    {
      label: "<Module Label>",
      to: "/<module-name>",
      icon: "<icon-name>",
      group: "<group>",
      order: 30,
    },
  ],

  requires: ["auth", "httpClient"],
});
```

## Step 5: Create page components

```typescript
// src/pages/<PageName>.tsx
import { useStore } from '@example/app-shared'

export default function <PageName>() {
  const user = useStore('auth', (s) => s.user)

  return (
    <div>
      <h2><Module Title></h2>
      <p>Content goes here.</p>
    </div>
  )
}
```

## Rules

- Every page component must use `lazyRouteComponent(() => import(...))` for code splitting.
- The module `id` must be unique across all registered modules.
- Use `useStore` and `useService` from `@example/app-shared`, never from `@tanstack-react-modules/core` directly.
- Navigation `to` paths must match the routes defined in `createRoutes`.
- The `requires` array is validated when `registry.resolve()` is called - missing deps throw an error.
- Do not import from other modules. Communicate via shared Zustand stores or React Query cache invalidation.

## After creating the module

Register it in the shell's `main.tsx`:

```typescript
import newModule from "@example/<module-name>-module";
registry.register(newModule);
```

Add the workspace dependency to the shell's `package.json`:

```json
"@example/<module-name>-module": "workspace:*"
```

Run `pnpm install` to link the new package.

Or use `reactive create module <name>` which handles registration automatically.
