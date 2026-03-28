import { useService, getUserContract } from "@example/app-shared";
import { sendByContract } from "@lokalise/frontend-http-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { userNotes } from "../stores/user-notes.js";

export default function UserDetail() {
  const { userId } = useParams({ strict: false }) as { userId: string };
  const httpClient = useService("httpClient");
  const queryClient = useQueryClient();

  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["users", userId],
    queryFn: () =>
      sendByContract(httpClient, getUserContract, {
        pathParams: { userId },
      }),
  });

  const deactivate = useMutation({
    mutationFn: () =>
      sendByContract(httpClient, getUserContract, {
        pathParams: { userId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  // Per-user notes — each userId gets its own scoped store
  const { notes, lastSaved } = userNotes.useScoped(userId);

  function handleNotesChange(value: string) {
    userNotes.getOrCreate(userId).setState({ notes: value });
  }

  function handleSave() {
    userNotes.getOrCreate(userId).setState({ lastSaved: Date.now() });
  }

  if (isLoading) return <p>Loading user...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <h2>User: {user?.name}</h2>
      {user && (
        <dl>
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Role</dt>
          <dd>{user.role}</dd>
        </dl>
      )}

      <div style={{ marginTop: "1.5rem" }}>
        <h3>Notes</h3>
        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "400px" }}
          placeholder="Add notes about this user..."
        />
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.5rem" }}>
          <button onClick={handleSave}>Save</button>
          {lastSaved && (
            <span style={{ fontSize: "0.875rem", color: "#666" }}>
              Saved {new Date(lastSaved).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
        <Link to="/users">Back to Users</Link>
        <Link to="/billing">View Billing</Link>
        <button onClick={() => deactivate.mutate()}>Deactivate User</button>
      </div>
    </div>
  );
}
