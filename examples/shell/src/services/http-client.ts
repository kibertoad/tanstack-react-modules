import wretch from "wretch";
import { authStore } from "../stores/auth.js";
import { configStore } from "../stores/config.js";

// Base URL is set once at init; only the auth token needs to be deferred
// (defer runs AFTER .get(path) appends the path, so .url() inside defer would append, not prepend)
const { apiBaseUrl } = configStore.getState();

export const httpClient = wretch(apiBaseUrl).defer((w) => {
  const { token } = authStore.getState();
  if (token) {
    return w.auth(`Bearer ${token}`);
  }
  return w;
});
