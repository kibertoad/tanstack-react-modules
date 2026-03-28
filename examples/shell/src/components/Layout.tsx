import { Outlet } from "@tanstack/react-router";
import { useZones } from "@tanstack-react-modules/runtime";
import { useStore } from "@example/app-shared";
import type { AppZones } from "@example/app-shared";
import { Sidebar } from "./Sidebar.js";
import { CommandPalette } from "./CommandPalette.js";

export function Layout() {
  const user = useStore("auth", (s) => s.user);
  const isAuthenticated = useStore("auth", (s) => s.isAuthenticated);
  const login = useStore("auth", (s) => s.login);
  const logout = useStore("auth", (s) => s.logout);

  const zones = useZones<AppZones>();
  const HeaderActions = zones.headerActions;
  const DetailPanel = zones.detailPanel;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            padding: "0.75rem 1.5rem",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          {HeaderActions && <HeaderActions />}
          <div style={{ flex: 1 }} />
          <CommandPalette />
          {isAuthenticated ? (
            <>
              <span style={{ color: "#4a5568" }}>{user?.name}</span>
              <button
                onClick={logout}
                style={{
                  padding: "0.375rem 0.75rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "white",
                  cursor: "pointer",
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={() => login({ email: "demo@example.com", password: "demo" })}
              style={{
                padding: "0.375rem 0.75rem",
                borderRadius: "0.375rem",
                border: "none",
                backgroundColor: "#3182ce",
                color: "white",
                cursor: "pointer",
              }}
            >
              Login as Demo User
            </button>
          )}
        </header>
        <div style={{ flex: 1, display: "flex" }}>
          <main style={{ flex: 1, padding: "1.5rem" }}>
            <Outlet />
          </main>
          {DetailPanel && <DetailPanel />}
        </div>
      </div>
    </div>
  );
}
