import { useStore } from '@example/app-shared'

export function Home() {
  const appName = useStore('config', (s) => s.appName)
  const isAuthenticated = useStore('auth', (s) => s.isAuthenticated)

  return (
    <div>
      <h2>Welcome to {appName}</h2>
      <p>
        This is a demo of the Reactive modular framework.
        {isAuthenticated
          ? ' Use the sidebar to navigate between modules.'
          : ' Click "Login as Demo User" to get started.'}
      </p>
    </div>
  )
}
