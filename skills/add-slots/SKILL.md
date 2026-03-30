---
name: add-slots
description: Adds slot-based extensibility to the application — defines slot types in app-shared, contributes items from modules, and consumes them in the shell. Use when the shell needs to collect and render contributions from multiple modules (command palettes, system registrations, dashboard widgets, etc.).
metadata:
  author: reactive
  version: "1.0"
---

# Add Slots

Slots are the extensibility primitive for collecting contributions from many modules into a single place. Each slot is a named array — modules contribute items, and the registry concatenates them at resolve time. The shell reads the merged result via `useSlots()`.

Use slots when:

- The shell has a UI region that should display items from multiple modules (command palette, dashboard widgets, system integrations).
- The shell doesn't know at build time what items will exist — modules declare them.

Do NOT use slots for:

- Per-route UI regions — use [zones](#) instead.
- Shared state — use stores.

## Step 1: Define the slot item type in app-shared

```typescript
// app-shared/src/index.ts

export interface CommandDefinition {
  readonly id: string;
  readonly label: string;
  readonly group?: string;
  readonly icon?: string;
  readonly onSelect: () => void;
}
```

## Step 2: Define the AppSlots interface

```typescript
// app-shared/src/index.ts

export interface AppSlots {
  commands: CommandDefinition[];
}
```

Every value in AppSlots must be an array type. Non-array types produce a compile error.

## Step 3: Pass AppSlots to the registry and defineModule

```typescript
// shell/src/main.tsx
import type { AppDependencies, AppSlots } from "@example/app-shared";

const registry = createRegistry<AppDependencies, AppSlots>({
  stores: { auth: authStore, config: configStore },
  services: { httpClient },
  // Default slot values — guarantees every key exists even if no module contributes
  slots: { commands: [] },
});
```

```typescript
// modules/billing/src/index.ts
import type { AppDependencies, AppSlots } from "@example/app-shared";

export default defineModule<AppDependencies, AppSlots>({
  id: "billing",
  version: "0.1.0",
  // ...
});
```

## Step 4: Contribute slot items from modules

```typescript
// modules/billing/src/index.ts
export default defineModule<AppDependencies, AppSlots>({
  id: "billing",
  version: "0.1.0",

  slots: {
    commands: [
      {
        id: "billing:dashboard",
        label: "Open Billing Dashboard",
        group: "navigate",
        onSelect: () => {},
      },
      {
        id: "billing:invoices",
        label: "View Invoices",
        group: "navigate",
        onSelect: () => {},
      },
    ],
  },

  // ... routes, navigation, etc.
});
```

## Step 5: Consume slots in the shell

```typescript
// shell/src/components/CommandPalette.tsx
import { useSlots } from "@tanstack-react-modules/runtime";
import type { AppSlots } from "@example/app-shared";

export function CommandPalette() {
  const slots = useSlots<AppSlots>();

  return (
    <ul>
      {slots.commands.map((cmd) => (
        <li key={cmd.id}>
          <button onClick={cmd.onSelect}>{cmd.label}</button>
        </li>
      ))}
    </ul>
  );
}
```

## Headless modules with defineSlots

For modules that only contribute slot items (no routes, no component, no lifecycle), use the `defineSlots` shorthand:

```typescript
// modules/external-systems/src/index.ts
import { defineSlots } from "@tanstack-react-modules/core";
import type { AppDependencies, AppSlots } from "@example/app-shared";

export default defineSlots<AppDependencies, AppSlots>("external-systems", {
  systems: [{ id: "salesforce", name: "Salesforce", icon: "cloud" }],
});
```

This is equivalent to `defineModule({ id: "external-systems", version: "0.0.0", slots: { ... } })` but more concise.

## Adding a new slot type

When you need a new extensibility point:

1. Define the item interface in `app-shared/src/index.ts`.
2. Add the slot to the `AppSlots` interface.
3. Add a default value in `createRegistry()` config: `slots: { commands: [], newSlot: [] }`.
4. Contribute from modules via the `slots` field in `defineModule()`.
5. Consume in the shell via `useSlots<AppSlots>()`.

## How slot merging works

At `registry.resolve()`:

1. Start with the `slots` defaults from `createRegistry()` config.
2. For each registered module, append its `slots[key]` items to the corresponding array.
3. The final merged object is provided via `SlotsContext`.

Order of items follows module registration order. If you need sorting, sort in the consuming component.

## Rules

- Every slot value must be an array type in `AppSlots`.
- Always provide defaults in `createRegistry()` config to guarantee every slot key exists.
- Pass `AppSlots` as the second generic to both `createRegistry<AppDependencies, AppSlots>()` and `defineModule<AppDependencies, AppSlots>()`.
- Modules can contribute to any subset of slots — omitted keys are simply not merged.
- Slot items are concatenated across modules, not replaced. Every module's contributions are included.
- Consume slots via `useSlots<AppSlots>()` from `@tanstack-react-modules/runtime`, not from core.
- Do not import slot data from other modules directly. The registry merges contributions — modules don't need to know about each other.
