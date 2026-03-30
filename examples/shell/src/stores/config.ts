import { createStore } from "zustand/vanilla";
import type { ConfigStore } from "@example/app-shared";

export const configStore = createStore<ConfigStore>()(() => ({
  apiBaseUrl: "http://localhost:3000",
  environment: "dev" as const,
  appName: "Reactive Shell",
}));
