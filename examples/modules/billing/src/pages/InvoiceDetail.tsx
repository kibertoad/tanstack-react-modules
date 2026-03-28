import { useService, getInvoiceContract } from "@example/app-shared";
import { sendByContract } from "@lokalise/frontend-http-client";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "@tanstack/react-router";

export default function InvoiceDetail() {
  const { invoiceId } = useParams({ strict: false }) as { invoiceId: string };
  const httpClient = useService("httpClient");

  const {
    data: invoice,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["invoices", invoiceId],
    queryFn: () =>
      sendByContract(httpClient, getInvoiceContract, {
        pathParams: { invoiceId },
      }),
  });

  if (isLoading) return <p>Loading invoice...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <h2>Invoice: {invoice?.id}</h2>
      {invoice && (
        <dl>
          <dt>Amount</dt>
          <dd>${invoice.amount.toFixed(2)}</dd>
          <dt>Status</dt>
          <dd>{invoice.status}</dd>
          <dt>Date</dt>
          <dd>{invoice.date}</dd>
        </dl>
      )}
      <Link to="/billing/invoices">Back to Invoices</Link>
    </div>
  );
}
