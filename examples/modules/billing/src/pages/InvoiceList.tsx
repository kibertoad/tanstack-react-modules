import { useStore, useService, listInvoicesContract } from "@example/app-shared";
import { sendByContract } from "@lokalise/frontend-http-client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

export default function InvoiceList() {
  const isAuthenticated = useStore("auth", (s) => s.isAuthenticated);
  const httpClient = useService("httpClient");

  const {
    data: invoices,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => sendByContract(httpClient, listInvoicesContract, {}),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return <p>Please log in to view invoices.</p>;
  }

  if (isLoading) {
    return <p>Loading invoices...</p>;
  }

  if (error) {
    return <p>Error loading invoices: {error.message}</p>;
  }

  return (
    <div>
      <h2>Invoices</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" }}>
              ID
            </th>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" }}>
              Amount
            </th>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" }}>
              Status
            </th>
            <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" }}>
              Date
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices?.map((inv) => (
            <tr key={inv.id}>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                <Link to="/billing/invoices/$invoiceId" params={{ invoiceId: inv.id }}>
                  {inv.id}
                </Link>
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                ${inv.amount.toFixed(2)}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{inv.status}</td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{inv.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
