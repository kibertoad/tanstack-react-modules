import { defineModule } from '@reactive/core'
import { createRoute, lazyRouteComponent } from '@tanstack/react-router'
import type { AppDependencies } from '@example/app-shared'

export default defineModule<AppDependencies>({
  id: 'billing',
  version: '0.1.0',

  createRoutes: (parentRoute) => {
    const billingRoot = createRoute({
      getParentRoute: () => parentRoute,
      path: 'billing',
    })

    const billingIndex = createRoute({
      getParentRoute: () => billingRoot,
      path: '/',
      component: lazyRouteComponent(() => import('./pages/BillingDashboard.js')),
    })

    const invoiceList = createRoute({
      getParentRoute: () => billingRoot,
      path: 'invoices',
      component: lazyRouteComponent(() => import('./pages/InvoiceList.js')),
    })

    const invoiceDetail = createRoute({
      getParentRoute: () => billingRoot,
      path: 'invoices/$invoiceId',
      component: lazyRouteComponent(() => import('./pages/InvoiceDetail.js')),
    })

    return billingRoot.addChildren([billingIndex, invoiceList, invoiceDetail])
  },

  navigation: [
    { label: 'Billing', to: '/billing', icon: 'credit-card', group: 'finance', order: 10 },
    { label: 'Invoices', to: '/billing/invoices', group: 'finance', order: 11 },
  ],

  requires: ['auth', 'httpClient'],
})
