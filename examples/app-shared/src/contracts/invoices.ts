import { buildRestContract } from "@lokalise/api-contracts";
import { z } from "zod/v4";

export const invoiceSchema = z.object({
  id: z.string(),
  amount: z.number(),
  status: z.enum(["paid", "pending", "overdue"]),
  date: z.string(),
});

export type Invoice = z.infer<typeof invoiceSchema>;

export const listInvoicesContract = buildRestContract({
  method: "get",
  pathResolver: () => "/api/invoices",
  successResponseBodySchema: z.array(invoiceSchema),
});

export const getInvoiceContract = buildRestContract({
  method: "get",
  pathResolver: (params) => `/api/invoices/${params.invoiceId}`,
  requestPathParamsSchema: z.object({ invoiceId: z.string() }),
  successResponseBodySchema: invoiceSchema,
});
