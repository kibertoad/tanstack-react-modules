import { MswHelper } from "@lokalise/universal-testing-utils";
import type { SetupServerApi } from "msw/node";
import type { SetupWorkerApi } from "msw/browser";
import {
  listUsersContract,
  getUserContract,
  listInvoicesContract,
  getInvoiceContract,
  type User,
  type Invoice,
} from "@example/app-shared";

const MOCK_USERS: User[] = [
  { id: "usr-001", name: "Alice Johnson", email: "alice@example.com", role: "admin" },
  { id: "usr-002", name: "Bob Smith", email: "bob@example.com", role: "user" },
  { id: "usr-003", name: "Carol Williams", email: "carol@example.com", role: "user" },
];

const MOCK_INVOICES: Invoice[] = [
  { id: "inv-001", amount: 1250.0, status: "paid", date: "2026-03-15" },
  { id: "inv-002", amount: 430.5, status: "pending", date: "2026-03-22" },
  { id: "inv-003", amount: 89.99, status: "overdue", date: "2026-02-28" },
];

export function registerMockHandlers(worker: SetupWorkerApi | SetupServerApi) {
  const msw = new MswHelper("http://localhost:3000");
  // SetupWorkerApi and SetupServerApi share the same .use() interface at runtime
  const server = worker as SetupServerApi;

  msw.mockValidResponse(listUsersContract, server, {
    responseBody: MOCK_USERS,
  });

  msw.mockValidResponseWithAnyPath(getUserContract, server, {
    responseBody: MOCK_USERS[0],
  });

  msw.mockValidResponse(listInvoicesContract, server, {
    responseBody: MOCK_INVOICES,
  });

  msw.mockValidResponseWithAnyPath(getInvoiceContract, server, {
    responseBody: MOCK_INVOICES[0],
  });
}
