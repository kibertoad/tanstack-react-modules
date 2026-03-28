import { Link, useLocation } from "@tanstack/react-router";
import { useNavigation } from "@tanstack-react-modules/runtime";

export function Sidebar() {
  const navigation = useNavigation();
  const location = useLocation();

  return (
    <aside
      style={{
        width: "240px",
        minHeight: "100vh",
        borderRight: "1px solid #e2e8f0",
        padding: "1rem",
        backgroundColor: "#f7fafc",
      }}
    >
      <h1 style={{ fontSize: "1.25rem", marginBottom: "1.5rem", color: "#2d3748" }}>
        Reactive Shell
      </h1>

      <nav>
        <Link
          to="/"
          style={{
            display: "block",
            padding: "0.5rem 0.75rem",
            borderRadius: "0.375rem",
            textDecoration: "none",
            color: location.pathname === "/" ? "#2b6cb0" : "#4a5568",
            backgroundColor: location.pathname === "/" ? "#ebf8ff" : "transparent",
            marginBottom: "0.25rem",
          }}
        >
          Home
        </Link>

        {navigation.groups.map((group) => (
          <div key={group.group} style={{ marginTop: "1rem" }}>
            <h3
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#a0aec0",
                marginBottom: "0.5rem",
                padding: "0 0.75rem",
              }}
            >
              {group.group}
            </h3>
            {group.items
              .filter((item) => !item.hidden)
              .map((item) => {
                const isActive = location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    style={{
                      display: "block",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.375rem",
                      textDecoration: "none",
                      color: isActive ? "#2b6cb0" : "#4a5568",
                      backgroundColor: isActive ? "#ebf8ff" : "transparent",
                      marginBottom: "0.25rem",
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
          </div>
        ))}

        {navigation.ungrouped.length > 0 && (
          <div style={{ marginTop: "1rem" }}>
            {navigation.ungrouped
              .filter((item) => !item.hidden)
              .map((item) => {
                const isActive = location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    style={{
                      display: "block",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.375rem",
                      textDecoration: "none",
                      color: isActive ? "#2b6cb0" : "#4a5568",
                      backgroundColor: isActive ? "#ebf8ff" : "transparent",
                      marginBottom: "0.25rem",
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
          </div>
        )}
      </nav>
    </aside>
  );
}
