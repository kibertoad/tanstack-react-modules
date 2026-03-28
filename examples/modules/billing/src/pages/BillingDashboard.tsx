import { useStore } from "@example/app-shared";
import { Link } from "@tanstack/react-router";

export default function BillingDashboard() {
  const user = useStore("auth", (s) => s.user);

  return (
    <div>
      <h2>Billing Dashboard</h2>
      {user ? (
        <p>Welcome, {user.name}. Manage your billing here.</p>
      ) : (
        <p>Please log in to view billing information.</p>
      )}
      <nav>
        <Link to="/billing/invoices">View Invoices</Link>
      </nav>
    </div>
  );
}
