---
name: add-api-query
description: Adds data fetching to a module component using React Query with Lokalise HTTP client and API contracts. Use when a component needs to fetch, create, update, or delete server data, or when integrating a new backend contract.
metadata:
  author: reactive
  version: "1.0"
---

# Add an API Query to a Component

Data fetching uses three layers:

1. **API contract** (`@lokalise/api-contracts`) - defines the endpoint, method, and zod schemas. Typically owned and published by the backend team.
2. **HTTP client** (`@lokalise/frontend-http-client`) - executes the contract with runtime validation.
3. **React Query** (`@tanstack/react-query`) - manages caching, loading states, refetching, and invalidation.

## Understanding API contracts

Contracts are built with `buildRestContract()` from `@lokalise/api-contracts` using zod schemas. They describe the path, HTTP method, path params, query params, request body, and response body for an endpoint.

The **backend team** is the primary owner of contracts. They typically publish a contract package (e.g., `@myorg/billing-api-contracts`) that the frontend consumes. The contract package in this repo (`@example/app-shared/src/contracts/`) re-exports or mirrors these for convenience.

A contract looks like this:

```typescript
import { buildRestContract } from "@lokalise/api-contracts";
import { z } from "zod/v4";

const invoiceSchema = z.object({
  id: z.string(),
  amount: z.number(),
  status: z.enum(["paid", "pending", "overdue"]),
  date: z.string(),
});

// GET /api/invoices
export const listInvoicesContract = buildRestContract({
  method: "get",
  pathResolver: () => "/api/invoices",
  successResponseBodySchema: z.array(invoiceSchema),
});

// GET /api/invoices/:invoiceId
export const getInvoiceContract = buildRestContract({
  method: "get",
  pathResolver: (params) => `/api/invoices/${params.invoiceId}`,
  requestPathParamsSchema: z.object({ invoiceId: z.string() }),
  successResponseBodySchema: invoiceSchema,
});

// POST /api/invoices
export const createInvoiceContract = buildRestContract({
  method: "post",
  pathResolver: () => "/api/invoices",
  requestBodySchema: z.object({ amount: z.number(), date: z.string() }),
  successResponseBodySchema: invoiceSchema,
});
```

When using a backend-published contract package, import directly from it. When contracts are defined locally, they go in `app-shared/src/contracts/` and are re-exported from `app-shared/src/index.ts`.

## Fetching data (GET)

### Basic query

```typescript
import { useService, listInvoicesContract } from '@example/app-shared'
import { sendByContract } from '@lokalise/frontend-http-client'
import { useQuery } from '@tanstack/react-query'

export default function InvoiceList() {
  const httpClient = useService('httpClient')

  const { data: invoices, isLoading, error } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => sendByContract(httpClient, listInvoicesContract, {}),
  })

  if (isLoading) return <p>Loading...</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <ul>
      {invoices?.map((inv) => (
        <li key={inv.id}>{inv.id}</li>
      ))}
    </ul>
  )
}
```

### Query with path params

```typescript
import { getInvoiceContract } from "@example/app-shared";
import { useParams } from "@tanstack/react-router";

export default function InvoiceDetail() {
  const { invoiceId } = useParams({ strict: false }) as { invoiceId: string };
  const httpClient = useService("httpClient");

  const { data: invoice } = useQuery({
    queryKey: ["invoices", invoiceId],
    queryFn: () =>
      sendByContract(httpClient, getInvoiceContract, {
        pathParams: { invoiceId },
      }),
  });
}
```

### Conditional query (e.g., auth-gated)

```typescript
const isAuthenticated = useStore("auth", (s) => s.isAuthenticated);

const { data } = useQuery({
  queryKey: ["invoices"],
  queryFn: () => sendByContract(httpClient, listInvoicesContract, {}),
  enabled: isAuthenticated, // Only fetches when authenticated
});
```

## Creating data (POST)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createInvoiceContract } from '@example/app-shared'

export default function CreateInvoice() {
  const httpClient = useService('httpClient')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (body: { amount: number; date: string }) =>
      sendByContract(httpClient, createInvoiceContract, { body }),
    onSuccess: () => {
      // Invalidate the list so it refetches
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      mutation.mutate({ amount: 100, date: '2026-04-01' })
    }}>
      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating...' : 'Create Invoice'}
      </button>
      {mutation.error && <p>Error: {mutation.error.message}</p>}
    </form>
  )
}
```

## Updating data (PUT/PATCH)

```typescript
const mutation = useMutation({
  mutationFn: ({ entityId, body }: { entityId: string; body: UpdateBody }) =>
    sendByContract(httpClient, updateEntityContract, {
      pathParams: { entityId },
      body,
    }),
  onSuccess: (_, variables) => {
    queryClient.invalidateQueries({ queryKey: ["entities", variables.entityId] });
    queryClient.invalidateQueries({ queryKey: ["entities"] });
  },
});
```

## Deleting data

```typescript
const mutation = useMutation({
  mutationFn: (entityId: string) =>
    sendByContract(httpClient, deleteEntityContract, {
      pathParams: { entityId },
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["entities"] });
  },
});
```

## Query key conventions

Prefix query keys with the domain to avoid collisions between modules:

| Pattern         | Example                               |
| --------------- | ------------------------------------- |
| List            | `['invoices']`                        |
| Detail          | `['invoices', invoiceId]`             |
| Filtered list   | `['invoices', { status: 'pending' }]` |
| Nested resource | `['users', userId, 'invoices']`       |

## Rules

- Always use `sendByContract` from `@lokalise/frontend-http-client` - never raw `fetch`.
- Get the `httpClient` via `useService('httpClient')`, never import it directly.
- Use `useQuery` for GET requests, `useMutation` for POST/PUT/PATCH/DELETE.
- Always invalidate relevant queries in `onSuccess` after mutations.
- Use `enabled` to conditionally fetch (e.g., only when authenticated).
- Contracts are typically published by the backend team. Import them from the backend's contract package or re-export them via the app-shared package.
- Query keys are global across all modules in the app. Use domain-scoped keys to avoid collisions.
