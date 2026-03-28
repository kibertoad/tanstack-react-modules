import { createRoot } from 'react-dom/client'
import { createRegistry } from '@reactive/registry'
import type { AppDependencies } from '@example/app-shared'
import billing from '@example/billing-module'
import users from '@example/users-module'
import { authStore } from './stores/auth.js'
import { configStore } from './stores/config.js'
import { httpClient } from './services/http-client.js'
import { Layout } from './components/Layout.js'
import { Home } from './components/Home.js'

// Create the registry with shared dependencies
const registry = createRegistry<AppDependencies>({
  stores: { auth: authStore, config: configStore },
  services: { httpClient },
})

// Register modules
registry.register(billing)
registry.register(users)

// Resolve — validates everything and produces the app
const { App } = registry.resolve({
  rootComponent: Layout,
  indexComponent: Home,
})

createRoot(document.getElementById('root')!).render(<App />)
