import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRegistry } from "@tanstack-react-modules/runtime";
import type { AppDependencies, AppSlots } from "@example/app-shared";
import billing from "@example/billing-module";
import users from "@example/users-module";
import { authStore } from "./stores/auth.js";
import { configStore } from "./stores/config.js";
import { httpClient } from "./services/http-client.js";
import { Layout } from "./components/Layout.js";
import { Home } from "./components/Home.js";

// Shell owns the QueryClient — not the framework's concern
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000 } },
});

function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Create the registry with shared dependencies
const registry = createRegistry<AppDependencies, AppSlots>({
  stores: { auth: authStore, config: configStore },
  services: { httpClient },
  slots: { commands: [] },
});

// Register modules
registry.register(billing);
registry.register(users);

// Resolve — validates everything and produces the app
const { App } = registry.resolve({
  rootComponent: Layout,
  indexComponent: Home,
  providers: [QueryProvider],
});

async function startApp() {
  if (import.meta.env.DEV) {
    const { worker } = await import("./mocks/browser.js");
    await worker.start({ onUnhandledRequest: "bypass" });
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

startApp();
