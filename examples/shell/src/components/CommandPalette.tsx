import { useState } from "react";
import { useSlots } from "@tanstack-react-modules/runtime";
import type { AppSlots } from "@example/app-shared";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const slots = useSlots<AppSlots>();
  const commands = slots.commands ?? [];

  const filtered = commands.filter((cmd) => cmd.label.toLowerCase().includes(search.toLowerCase()));

  const groups = Map.groupBy(filtered, (cmd) => cmd.group ?? "other");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: "0.375rem 0.75rem",
          borderRadius: "0.375rem",
          border: "1px solid #e2e8f0",
          backgroundColor: "white",
          cursor: "pointer",
          fontSize: "0.875rem",
          color: "#718096",
        }}
      >
        Commands
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "20vh",
        backgroundColor: "rgba(0, 0, 0, 0.3)",
        zIndex: 50,
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          width: "400px",
          backgroundColor: "white",
          borderRadius: "0.5rem",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.2)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search commands..."
          style={{
            width: "100%",
            padding: "0.75rem 1rem",
            border: "none",
            borderBottom: "1px solid #e2e8f0",
            outline: "none",
            fontSize: "0.875rem",
          }}
        />
        <div style={{ maxHeight: "300px", overflowY: "auto" }}>
          {[...groups.entries()].map(([group, items]) => (
            <div key={group}>
              <div
                style={{
                  padding: "0.5rem 1rem 0.25rem",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#a0aec0",
                }}
              >
                {group}
              </div>
              {items.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => {
                    cmd.onSelect();
                    setOpen(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "0.5rem 1rem",
                    textAlign: "left",
                    border: "none",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                  }}
                >
                  {cmd.label}
                </button>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "1rem", color: "#a0aec0", textAlign: "center" }}>
              No commands found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
