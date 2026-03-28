import { useModules } from "@tanstack-react-modules/runtime";
import { useStore } from "@example/app-shared";

export function Home() {
  const appName = useStore("config", (s) => s.appName);
  const isAuthenticated = useStore("auth", (s) => s.isAuthenticated);
  const modules = useModules();

  return (
    <div>
      <h2>Welcome to {appName}</h2>
      <p>
        This is a demo of the Reactive modular framework.
        {isAuthenticated
          ? " Use the sidebar to navigate between modules."
          : ' Click "Login as Demo User" to get started.'}
      </p>

      {isAuthenticated && modules.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h3>Modules</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "1rem",
              marginTop: "1rem",
            }}
          >
            {modules
              .filter((m) => m.meta)
              .map((mod) => (
                <div
                  key={mod.id}
                  style={{
                    padding: "1rem",
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.5rem",
                  }}
                >
                  <h4 style={{ margin: "0 0 0.5rem" }}>{(mod.meta?.name as string) ?? mod.id}</h4>
                  {mod.meta?.description && (
                    <p style={{ margin: 0, fontSize: "0.875rem", color: "#718096" }}>
                      {mod.meta.description as string}
                    </p>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
