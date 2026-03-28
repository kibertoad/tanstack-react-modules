import { useParams } from "@tanstack/react-router";

export function UserDetailActions() {
  const { userId } = useParams({ strict: false }) as { userId: string };

  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      <button
        style={{
          padding: "0.375rem 0.75rem",
          borderRadius: "0.375rem",
          border: "1px solid #e2e8f0",
          backgroundColor: "white",
          cursor: "pointer",
          fontSize: "0.875rem",
        }}
      >
        Edit User {userId}
      </button>
      <button
        style={{
          padding: "0.375rem 0.75rem",
          borderRadius: "0.375rem",
          border: "none",
          backgroundColor: "#e53e3e",
          color: "white",
          cursor: "pointer",
          fontSize: "0.875rem",
        }}
      >
        Deactivate
      </button>
    </div>
  );
}
