import { useParams } from "@tanstack/react-router";
import { useStore } from "@example/app-shared";

export function UserDetailPanel() {
  const { userId } = useParams({ strict: false }) as { userId: string };
  const user = useStore("auth", (s) => s.user);

  return (
    <div style={{ padding: "1rem", borderLeft: "1px solid #e2e8f0", minWidth: "240px" }}>
      <h3 style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#718096" }}>User Details</h3>
      <dl style={{ margin: 0, fontSize: "0.875rem" }}>
        <dt style={{ color: "#718096", marginBottom: "0.25rem" }}>User ID</dt>
        <dd style={{ margin: "0 0 0.75rem", fontFamily: "monospace" }}>{userId}</dd>
        <dt style={{ color: "#718096", marginBottom: "0.25rem" }}>Viewed by</dt>
        <dd style={{ margin: 0 }}>{user?.name ?? "Anonymous"}</dd>
      </dl>
    </div>
  );
}
