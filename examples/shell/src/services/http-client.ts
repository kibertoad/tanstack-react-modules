import wretch from "wretch";
import { authStore } from "../stores/auth.js";
import { configStore } from "../stores/config.js";

export const httpClient = wretch().defer((w) => {
  const { apiBaseUrl } = configStore.getState();
  const { token } = authStore.getState();
  let instance = w.url(apiBaseUrl);
  if (token) {
    instance = instance.auth(`Bearer ${token}`);
  }
  return instance;
});
