import { useStore, useService, listUsersContract } from "@example/app-shared";
import { sendByContract } from "@lokalise/frontend-http-client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

export default function UserList() {
  const isAuthenticated = useStore("auth", (s) => s.isAuthenticated);
  const httpClient = useService("httpClient");

  const {
    data: users,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["users"],
    queryFn: () => sendByContract(httpClient, listUsersContract, {}),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return <p>Please log in to view users.</p>;
  }

  if (isLoading) return <p>Loading users...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <h2>Users</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {users?.map((user) => (
          <li key={user.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #eee" }}>
            <Link to="/users/$userId" params={{ userId: user.id }}>
              {user.name}
            </Link>{" "}
            <span style={{ color: "#888", fontSize: "0.875rem" }}>({user.email})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
