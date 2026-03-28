import { createSharedHooks } from '@reactive/core'
import type { LoginCredentials, User } from './types.js'
import type { Wretch } from 'wretch'

export type { User, LoginCredentials, Invoice } from './types.js'

// Re-export contracts so modules can import them
export * from './contracts/invoices.js'
export * from './contracts/users.js'

// ---- Zustand store shapes (reactive / client state) ----

export interface AuthStore {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
}

export interface ConfigStore {
  apiBaseUrl: string
  environment: 'dev' | 'staging' | 'prod'
  appName: string
}

// ---- The contract ----

export interface AppDependencies {
  // Zustand stores (reactive client state)
  auth: AuthStore
  config: ConfigStore
  // Wretch instance for making HTTP calls via @lokalise/frontend-http-client
  httpClient: Wretch
}

// ---- Typed hooks (use these in all modules) ----

export const { useStore, useService } = createSharedHooks<AppDependencies>()
