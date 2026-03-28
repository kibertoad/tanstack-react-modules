export function modulePackageJson(params: {
  scope: string
  name: string
}): string {
  return JSON.stringify(
    {
      name: `${params.scope}/${params.name}-module`,
      version: '0.1.0',
      type: 'module',
      main: './src/index.ts',
      types: './src/index.ts',
      exports: {
        '.': {
          import: './src/index.ts',
          types: './src/index.ts',
        },
      },
      dependencies: {
        '@reactive/core': '^0.1.0',
        [`${params.scope}/app-shared`]: 'workspace:*',
        '@lokalise/frontend-http-client': '^7.0.0',
      },
      peerDependencies: {
        '@tanstack/react-query': '^5.95.0',
        '@tanstack/react-router': '^1.120.0',
        react: '^19.0.0',
        zustand: '^5.0.0',
      },
      devDependencies: {
        '@tanstack/react-query': '^5.95.0',
        '@tanstack/react-router': '^1.120.0',
        react: '^19.0.0',
        zustand: '^5.0.0',
        '@types/react': '^19.0.0',
        typescript: '^6.0.2',
      },
    },
    null,
    2,
  )
}

export function moduleTsconfig(): string {
  return JSON.stringify(
    {
      extends: '../../tsconfig.base.json',
      include: ['src'],
    },
    null,
    2,
  )
}

export function moduleDescriptor(params: {
  scope: string
  name: string
  route: string
  pageName: string
  listPageName: string
  navGroup?: string
}): string {
  const navItems = params.navGroup
    ? [
        `{ label: '${capitalize(params.name)}', to: '/${params.route}', group: '${params.navGroup}', order: 10 }`,
        `{ label: '${capitalize(params.name)} List', to: '/${params.route}/list', group: '${params.navGroup}', order: 11 }`,
      ]
    : [
        `{ label: '${capitalize(params.name)}', to: '/${params.route}', order: 10 }`,
        `{ label: '${capitalize(params.name)} List', to: '/${params.route}/list', order: 11 }`,
      ]

  return `import { defineModule } from '@reactive/core'
import { createRoute, lazyRouteComponent } from '@tanstack/react-router'
import type { AppDependencies, AppSlots } from '${params.scope}/app-shared'

export default defineModule<AppDependencies, AppSlots>({
  id: '${params.name}',
  version: '0.1.0',

  createRoutes: (parentRoute) => {
    const root = createRoute({
      getParentRoute: () => parentRoute,
      path: '${params.route}',
    })

    const index = createRoute({
      getParentRoute: () => root,
      path: '/',
      component: lazyRouteComponent(() => import('./pages/${params.pageName}.js')),
    })

    const list = createRoute({
      getParentRoute: () => root,
      path: 'list',
      component: lazyRouteComponent(() => import('./pages/${params.listPageName}.js')),
    })

    return root.addChildren([index, list])
  },

  navigation: [
    ${navItems.join(',\n    ')},
  ],

  requires: ['auth', 'httpClient'],
})
`
}

export function modulePage(params: {
  scope: string
  pageName: string
  moduleLabel: string
  moduleName: string
}): string {
  return `import { useStore } from '${params.scope}/app-shared'
import { Link } from '@tanstack/react-router'

export default function ${params.pageName}() {
  const user = useStore('auth', (s) => s.user)

  return (
    <div>
      <h2>${params.moduleLabel}</h2>
      {user ? (
        <p>Welcome, {user.name}.</p>
      ) : (
        <p>Please log in to continue.</p>
      )}
      <nav>
        <Link to="/${params.moduleName}/list">
          View ${params.moduleLabel} List
        </Link>
      </nav>
    </div>
  )
}
`
}

export function moduleListPage(params: {
  scope: string
  pageName: string
  moduleLabel: string
}): string {
  return `import { useStore } from '${params.scope}/app-shared'

export default function ${params.pageName}() {
  const user = useStore('auth', (s) => s.user)

  return (
    <div>
      <h2>${params.moduleLabel} List</h2>
      {user ? (
        <p>Showing items for {user.name}.</p>
      ) : (
        <p>Please log in to view the list.</p>
      )}
    </div>
  )
}
`
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
